'use strict';
/* =========================================================================
   D-STAMP · MVP de estamparia (varejo + operação)
   Servidor Node.js sem dependências externas.
   - API REST em /api/*
   - Arquivos estáticos em /public e /uploads
   - Banco de dados em arquivo JSON (data/db.json) — troca por MySQL/Postgres
     em produção sem mudar o front-end (mesmas rotas).
   ========================================================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
/* DSTAMP_DATA permite apontar o banco e os uploads para um disco persistente
   (ex.: /var/lib/dstamp numa VPS, ou um disco montado no Render/Koyeb). */
const DATA_DIR = process.env.DSTAMP_DATA ? path.resolve(process.env.DSTAMP_DATA) : path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const VERSION = (() => { try { return require('./package.json').version; } catch (e) { return '1.0.0'; } })();

/* ------------------------------ CONSTANTES ------------------------------ */

const STAGES = [
  { id: 'recebido',            label: 'Pedido recebido',        desc: 'Pedido registrado no sistema.' },
  { id: 'conferencia_arte',    label: 'Conferência de arte',    desc: 'Designer analisa viabilidade técnica da arte.' },
  { id: 'aguardando_aprovacao',label: 'Aprovação do cliente',   desc: 'Arte final enviada, aguardando aprovação.' },
  { id: 'pagamento',           label: 'Validação de pagamento', desc: 'Comprovante em análise ou autorizado.' },
  { id: 'fila',                label: 'Na fila de produção',    desc: 'Aguardando a data do lote de produção.' },
  { id: 'estampa',             label: 'Estampando',             desc: 'Sublimação / DTF em produção.' },
  { id: 'acabamento',          label: 'Costura e acabamento',   desc: 'Costura, revisão peça a peça e embalagem.' },
  { id: 'pronto',              label: 'Pronto para retirada',   desc: 'Aguardando retirada na loja.' },
  { id: 'entregue',            label: 'Entregue',               desc: 'Pedido finalizado.' }
];

const CATEGORIES = {
  alteracao:     { prefix: 'ALT', label: 'Alteração',      color: '#FFB020' },
  acompanhamento:{ prefix: 'ACO', label: 'Acompanhamento', color: '#22D3EE' },
  finalizacao:   { prefix: 'FIN', label: 'Finalização',    color: '#3DD68C' },
  erro:          { prefix: 'ERR', label: 'Erro',           color: '#FF5C7A' }
};

/* --------------------------- CONFIGURAÇÃO BASE --------------------------- */
/* ATENÇÃO: valores de demonstração. Tudo abaixo é editável no Painel Admin. */

const DEFAULT_CONFIG = {
  brand: {
    /* avisos da faixa do topo do site (o admin edita em Administração → Marca e contato) */
    announcements: [
      { id: 'an1', text: 'Abadás e uniformes de verão: garanta a sua data no lote de 31/10.', active: true },
      { id: 'an2', text: '', active: false }
    ],
    name: 'D-Stamp',
    tagline: 'Estamparia, confecção e brindes personalizados',
    city: 'Praia Grande – SP',
    address: 'Avenida Presidente Kennedy, 6545 – Praia Grande/SP',
    hours: 'Segunda a sexta, 9h às 18h · sábado, 9h às 13h',
    whatsapp: '5513996699067',
    whatsappLabel: '(13) 99669-9067',
    email: 'contato@d-stamp.art.br',
    instagram: '@dstamp',
    site: 'https://www.dstamp.com.br',
    pickup: 'Retirada na loja'
  },
  maps: { query: 'D-Stamp Estamparia, Avenida Presidente Kennedy 6545, Praia Grande - SP' },

  /* --------------------------- COMO A LOJA FUNCIONA --------------------------- */
  store: {
    focus: 'total',                 // técnica em destaque na vitrine
    localizedSelfService: false,    // estampa localizada NÃO fecha pelo site: só WhatsApp
    showReferencePrices: true,      // mostra os valores de referência da localizada
    externalStore: 'https://www.dstamp.com.br',
    externalStoreLabel: 'dstamp.com.br',
    checkout: 'site_ou_whatsapp',   // o cliente envia o pedido pelo site ou o resumo pelo WhatsApp
    noMinimum: true
  },

  capacity: { totalPerWeek: 250, enforce: true },
  batch: {
    weekday: 6,
    nextDate: '2026-10-31',
    leadMin: 15, leadMax: 20,
    note: 'Estampa total é produzida por lote, sempre aos sábados. O lote fecha conforme o volume de pedidos.'
  },
  rules: {
    installmentMax: 3,          // parcelamento do pedido estampado (site)
    installmentMaxResale: 12,   // parcelamento para revenda (como no dstamp.com.br)
    pixDiscountPercent: 5,      // desconto PIX do site
    editWindow: 'same_week',
    requireArtApproval: true,
    depositPercent: 50,
    noMinimum: true             // não existe quantidade mínima: fazemos de 1 peça a lotes
  },
  leadTimes: {
    total: { min: 15, max: 20, batch: true },
    sublimacao_localizada: { min: 3, max: 4 },
    dtf: { min: 5, max: 7 },
    revenda: { min: 1, max: 2 }
  },
  prices: {
    total: {
      dryfit:  [{ upTo: 10, price: 55 }, { upTo: null, price: 50 }],
      poliflex:[{ upTo: 10, price: 65 }, { upTo: null, price: 60 }]
    },
    print: {
      sublimacao: { '10x10': 6.5, A4: 13, A3: 16 },
      dtf:        { '10x10': 6.5, A4: 15, A3: 20 }
    },
    sizeSurchargeAboveGG: 3,
    sizeOrder: ['PP','P','M','G','GG','EXG','G1','G2','G3','G4','G5','G6'],
    sizeFallback: 'GG'
  },
  totalAddons: [
    { code: 'manga_longa', label: 'Manga longa', price: 5.5 },
    { code: 'gola_v',      label: 'Gola V',      price: 1.5 }
  ],
  extras: [
    { code: 'nome',        label: 'Nome individual',                price: 5,   unit: 'peça', techniques: ['total','sublimacao_localizada','dtf'] },
    { code: 'numero',      label: 'Número (frente/costas)',         price: 3,   unit: 'peça', techniques: ['total','sublimacao_localizada','dtf'] },
    { code: 'etiqueta',    label: 'Etiqueta interna personalizada', price: 2,   unit: 'peça', techniques: ['total','sublimacao_localizada','dtf'] },
    { code: 'embalagem',   label: 'Embalagem individual',           price: 2.5, unit: 'peça', techniques: ['total','sublimacao_localizada','dtf','revenda'] },
    { code: 'ribana',      label: 'Ribana na cor da estampa',       price: 3,   unit: 'peça', techniques: ['total'] },
    { code: 'bolso',       label: 'Bolso aplicado',                 price: 4,   unit: 'peça', techniques: ['total','dtf'] },
    { code: 'patrocinio',  label: 'Patrocínio extra na manga',      price: 4,   unit: 'peça', techniques: ['total'] },
    { code: 'bordado',     label: 'Bordado (sob consulta)',         price: null,unit: 'consulta', techniques: ['total','dtf'] },
    { code: 'silk',        label: 'Silk screen extra (sob consulta)',price: null,unit: 'consulta', techniques: ['total','dtf'] }
  ],

  catalog: {
    categories: [
      { id: 'total',      name: 'Estampa total',            hint: 'Peça inteira estampada: camiseta, baby look, regata, nadador, machão, infantil e calça capoeira', focus: true },
      { id: 'localizada', name: 'Estampa localizada',       hint: 'Sublimação e DTF em peça clara ou escura — orçamento pelo WhatsApp', whatsappOnly: true },
      { id: 'brindes',    name: 'Brindes e objetos',        hint: 'Canecas, garrafas, azulejos, chaveiros, bonés — orçamento pelo WhatsApp', whatsappOnly: true },
      { id: 'lisos',      name: 'Peças lisas e insumos',    hint: 'Compre na loja oficial dstamp.com.br', external: 'https://www.dstamp.com.br' }
    ],
    products: [
      /* ===================== ESTAMPA TOTAL (foco da loja) ===================== */
      { id: 'camiseta', name: 'Camiseta unissex', short: 'Gola redonda ou V · manga curta ou longa',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'total' },
        collar: ['redonda', 'v'], sleeve: ['curta', 'longa'], delta: 0,
        img: '/img/prod-camiseta.jpg', badge: 'Mais vendida',
        desc: 'A modelagem padrão da estampa total. Peça inteira estampada — frente, costas, mangas e gola — em Dry Fit ou Poliflex, feita sob encomenda a partir de 1 unidade.',
        bullets: ['Frente, costas e mangas estampadas', 'Sem quantidade mínima: de 1 peça a lote', 'Toque zero: a tinta entra na fibra do tecido', 'Não descasca, não craquela e não desbota na lavagem'],
        uses: ['Times e escolinhas', 'Abadás e blocos', 'Uniforme de empresa', 'Eventos e formaturas'],
        tags: ['times', 'eventos', 'empresas', 'abadas'] },
      { id: 'babylook', name: 'Baby look', short: 'Modelagem feminina · gola redonda ou V',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'feminino' },
        collar: ['redonda', 'v'], sleeve: ['curta'], delta: 0,
        img: '/img/prod-babylook.jpg', badge: 'Feminina',
        desc: 'Modelagem feminina mais ajustada ao corpo, com cintura marcada e manga curta. Estampa total na peça inteira, em Dry Fit ou Poliflex.',
        bullets: ['Corte feminino (PP ao GG)', 'Manga curta', 'Gola redonda inclusa · gola V + R$1,50', 'Mesma tabela de preço da camiseta'],
        uses: ['Academias e studios', 'Uniforme feminino de empresa', 'Eventos e equipes'],
        tags: ['feminina', 'academia', 'empresas'] },
      { id: 'regata', name: 'Regata unissex', short: 'Sem manga · cavada padrão',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'total' },
        collar: ['redonda'], sleeve: ['regata'], delta: 0,
        img: '/img/prod-regata.jpg', badge: 'Verão',
        desc: 'Regata cavada unissex, a peça mais usada em abadá de bloco, corrida de praia e evento de verão. Estampa total frente e costas.',
        bullets: ['Sem manga (cavada)', 'Ideal para abadá e corrida', 'Do PP ao G6', 'Entra no mesmo lote de sábado'],
        uses: ['Abadás e blocos de carnaval', 'Corridas e beach sports', 'Eventos de verão'],
        tags: ['abadas', 'verao', 'corrida'] },
      { id: 'regata_feminina', name: 'Regata feminina nadador', short: 'Costas nadador · modelagem feminina',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'feminino' },
        collar: ['redonda'], sleeve: ['nadador'], delta: 0,
        img: '/img/prod-nadador.jpg', badge: 'Feminina',
        desc: 'Regata feminina com costas nadador (alças largas que se unem nas costas). Estampa total frente e costas, em Dry Fit ou Poliflex.',
        bullets: ['Costas nadador', 'Corte feminino (PP ao GG)', 'Estampa frente e costas', 'Ótima para academia e beach sports'],
        uses: ['Academias e crossfit', 'Beach tennis e vôlei de praia', 'Equipes femininas'],
        tags: ['feminina', 'academia', 'praia'] },
      { id: 'machao', name: 'Regata machão', short: 'A mesma camiseta, sem manga · corte amplo',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'total' },
        collar: ['redonda', 'v'], sleeve: [], delta: 0,
        img: '/img/prod-machao.jpg', badge: 'Sem manga',
        desc: 'É a camiseta normal, só que sem manga: corpo amplo, ombro caído e cavas largas. Mesmo tecido, mesmo preço e mesmos tamanhos da camiseta (do PP ao G6).',
        bullets: ['Camiseta sem manga, corte amplo', 'Vai do PP ao G6', 'Gola redonda ou V', 'Mesma tabela de preço da camiseta'],
        uses: ['Academia e treino', 'Verão e praia', 'Times e turmas'],
        tags: ['sem manga', 'amplo', 'verão'] },
      { id: 'camiseta_infantil', name: 'Camiseta infantil', short: 'Tamanhos 2 a 14 · gola redonda ou V',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'infantil' },
        collar: ['redonda', 'v'], sleeve: ['curta', 'longa'], delta: 0,
        img: '/img/exemplo-infantil.jpg', badge: 'Infantil',
        desc: 'Camiseta infantil em estampa total, dos tamanhos 2 ao 14. Mesmo valor da tabela de adulto — sem acréscimo de tamanho.',
        bullets: ['Tamanhos 2, 4, 6, 8, 10, 12 e 14', 'Mesmo preço da camiseta adulta', 'Manga curta ou longa (+ R$5,50)', 'Ótima para escola, turma e aniversário'],
        uses: ['Uniforme escolar e de evento', 'Camiseta de turma', 'Aniversários e festas'],
        tags: ['infantil', 'escola', 'festas'] },
      { id: 'regata_infantil', name: 'Regata infantil', short: 'Tamanhos 2 a 14 · sem manga',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'infantil' },
        collar: ['redonda'], sleeve: ['regata'], delta: 0,
        img: '/img/exemplo-abada.jpg', badge: 'Infantil',
        desc: 'Regata infantil em estampa total, dos tamanhos 2 ao 14. Leve, sem manga, para evento de verão, colônia de férias e escolinha de esporte.',
        bullets: ['Tamanhos 2 a 14', 'Sem manga', 'Estampa frente e costas', 'Mesma tabela de preço'],
        uses: ['Colônia de férias', 'Escolinha de esporte', 'Festa infantil'],
        tags: ['infantil', 'verao', 'esporte'] },
      { id: 'calca_capoeira', name: 'Calça capoeira', short: 'Do infantil ao GG por R$55 · EXG R$58',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'calca' },
        collar: [], sleeve: [], delta: 0,
        img: '/img/prod-calca.jpg', badge: 'Uniforme completo',
        desc: 'Calça capoeira em Dry Fit com estampa total, do tamanho infantil ao GG por R$55,00; acima do GG, a EXG sai por R$58,00 (e cada tamanho seguinte soma R$3,00). Cós com elástico e cordão, perna ampla.',
        bullets: ['Tamanho infantil até o GG: R$55,00', 'EXG: R$58,00 (+ R$3,00 por tamanho acima)', 'Elástico + cordão no cós', 'Combina com a camiseta do mesmo lote'],
        uses: ['Capoeira e artes marciais', 'Uniforme de time completo', 'Abadás e blocos'],
        tags: ['capoeira', 'uniforme', 'kit'] },
      { id: 'outros', name: 'Outra modelagem sob medida', short: 'Blusa, cropped, moletom leve, uniforme especial',
        category: 'total', kind: 'textil', techniques: ['total'], sizesKey: { total: 'total' },
        collar: ['redonda', 'v'], sleeve: ['curta', 'longa'], delta: 0, priceOnRequest: true,
        img: '/img/exemplo-total-1.jpg', badge: 'Sob consulta',
        desc: 'Fazemos outras modelagens em estampa total: cropped, blusa, camisa de time com recorte, uniforme com modelagem própria. Valor confirmado pelo WhatsApp conforme modelagem e tecido.',
        bullets: ['Modelagem desenvolvida com você', 'Valor sob consulta', 'Entra no lote de sábado', 'Envie referência ou desenho'],
        uses: ['Marcas e coleções', 'Uniforme com recorte especial', 'Peça de amostra'],
        tags: ['sob medida', 'marca'] },

      /* ================= ESTAMPA LOCALIZADA (só orçamento no WhatsApp) ========= */
      { id: 'camiseta_poli', name: 'Camiseta poliéster (estampa localizada)', short: 'Sublimação em peça clara · DTF em qualquer cor',
        category: 'localizada', kind: 'textil', whatsappOnly: true,
        techniques: ['sublimacao_localizada', 'dtf'], sizesKey: { sublimacao_localizada: 'adulto', dtf: 'adulto', localizada: 'adulto' },
        colors: [
          { id: 'branca',  name: 'Branca',        price: 15.79, light: true },
          { id: 'mescla',  name: 'Cinza mescla',  price: 16.42, light: true },
          { id: 'mescla_clara', name: 'Mescla clara', price: 16.42, light: true },
          { id: 'rosa',    name: 'Rosa claro',    price: 16.42, light: true },
          { id: 'chiclete',name: 'Rosa chiclete', price: 16.42, light: true },
          { id: 'amarelo', name: 'Amarelo',       price: 16.42, light: true },
          { id: 'azul_claro', name: 'Azul claro', price: 16.42, light: true },
          { id: 'preta',   name: 'Preta',         price: 18.42, light: false }
        ],
        printSizes: ['10x10', 'A4', 'A3'], defaultPrint: 'A4',
        desc: 'Estampa localizada: a arte vai apenas onde você escolher (peito, costas, manga). Peça clara aceita sublimação; peça escura só em DTF.',
        note: 'Orçamento fechado pelo WhatsApp — o valor depende da cor da peça, do tamanho e da posição da estampa.' },
      { id: 'camiseta_poli_infantil', name: 'Camiseta infantil poliéster (localizada)', short: 'Sublimação · tamanhos 2 a 14',
        category: 'localizada', kind: 'textil', whatsappOnly: true,
        techniques: ['sublimacao_localizada', 'dtf'], sizesKey: { sublimacao_localizada: 'infantil', dtf: 'infantil', localizada: 'infantil' },
        colors: [{ id: 'branca', name: 'Branca', price: 13.16, light: true },
                 { id: 'mescla_clara', name: 'Mescla clara', price: 13.16, light: true }],
        printSizes: ['10x10', 'A4', 'A3'], defaultPrint: 'A4',
        note: 'Orçamento pelo WhatsApp.' },
      { id: 'promocional', name: 'Camiseta promocional branca', short: 'Peça econômica para ação e evento',
        category: 'localizada', kind: 'textil', whatsappOnly: true,
        techniques: ['sublimacao_localizada', 'dtf'], sizesKey: { sublimacao_localizada: 'promocional', dtf: 'promocional', localizada: 'promocional' },
        colors: [{ id: 'branca', name: 'Branca', price: 10.6, light: true }],
        printSizes: ['10x10', 'A4', 'A3'], defaultPrint: 'A4',
        desc: 'Camiseta branca promocional para ação de rua, evento e campanha. Tamanhos 4 a 14 e PP a EXG.',
        note: 'Orçamento pelo WhatsApp.' },
      { id: 'peca_terceiros', name: 'Sua peça (estampamos o que você trazer)', short: 'DTF em qualquer cor · sublimação só em poliéster claro',
        category: 'localizada', kind: 'textil', whatsappOnly: true, priceOnRequest: true,
        techniques: ['dtf', 'sublimacao_localizada'], sizesKey: { dtf: 'adulto', sublimacao_localizada: 'adulto', localizada: 'adulto' },
        printSizes: ['10x10', 'A4', 'A3'], defaultPrint: 'A4',
        desc: 'Você traz a camiseta, moletom, boné ou tecido e nós estampamos em DTF têxtil (qualquer cor de peça) ou sublimação (só poliéster claro).',
        bullets: ['DTF: qualquer cor de peça, aceita degradê', 'Sublimação: só poliéster branco ou claro', 'Não trabalhamos com polo', 'Envie foto da peça + quantidade + tamanho da estampa'],
        note: 'Orçamento fechado pelo WhatsApp.' },

      /* ============================ BRINDES E OBJETOS ========================== */
      { id: 'caneca_branca', name: 'Caneca branca cerâmica 325ml', short: 'A mais vendida da loja',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 12.32, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', img: '/img/exemplo-caneca.jpg',
        desc: 'Caneca de cerâmica branca 325ml estampada com foto, logo ou arte completa.', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_polimero', name: 'Caneca polímero branca 325ml', short: 'Leve, não quebra',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 6.84, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_interna_alca', name: 'Caneca interna e alça colorida 325ml', short: 'Cerâmica com cor interna',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 16.84, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_coracao', name: 'Caneca alça coração 325ml', short: 'Presente',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 18.95, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_vidro_degrade', name: 'Caneca vidro jateado degradê 325ml', short: 'Vidro com efeito degradê',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 14.74, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_chopp', name: 'Caneca de chopp vidro jateado 475ml', short: 'Chopp e cerveja',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 24.21, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_glitter', name: 'Caneca glitter 325ml', short: 'Efeito brilho',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 18.95, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_preta_tarja', name: 'Caneca preta com tarja branca 325ml', short: 'Área de estampa branca',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 23.68, printSizes: ['10x10'], defaultPrint: '10x10', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caneca_colher', name: 'Caneca cerâmica colorida com colher 325ml', short: 'Acompanha colher',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 24.21, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'squeeze_aluminio_600', name: 'Squeeze alumínio branco 600ml', short: 'Dois bicos',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 25.27, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', img: '/img/exemplo-garrafa.jpg', note: 'Orçamento pelo WhatsApp.' },
      { id: 'squeeze_prata_500', name: 'Squeeze alumínio prata 500ml', short: 'Dois bicos',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 18.94, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'squeeze_mosquetao', name: 'Squeeze prata tampa mosquetão 600ml', short: 'Tampa com mosquetão',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 23.16, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'garrafa_termica_500', name: 'Garrafa térmica inox 500ml', short: 'Parede dupla · tampas branca, prata ou bicolor',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 42.11, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'azulejo_20', name: 'Azulejo cerâmica branco 20x20cm', short: 'Decoração e lembrança',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 11.58, printSizes: ['A4', 'A3'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'azulejo_15', name: 'Azulejo cerâmica branco 15x15cm', short: 'Tamanho menor',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 8.95, printSizes: ['10x10', 'A4'], defaultPrint: '10x10', note: 'Orçamento pelo WhatsApp.' },
      { id: 'toalha_lavabo', name: 'Toalha lavabo para sublimação', short: 'Bordado personalizado',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 8.0, printSizes: ['10x10', 'A4'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'chaveiro', name: 'Chaveiro personalizado', short: 'Lembrancinha de evento',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, priceOnRequest: true,
        techniques: ['sublimacao_localizada'], printSizes: ['10x10'], defaultPrint: '10x10', note: 'Orçamento pelo WhatsApp.' },
      { id: 'mousepad', name: 'Mouse pad personalizado', short: 'Brinde corporativo',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, priceOnRequest: true,
        techniques: ['sublimacao_localizada'], printSizes: ['A4', 'A3'], defaultPrint: 'A4', note: 'Orçamento pelo WhatsApp.' },
      { id: 'mdf', name: 'Peça em MDF personalizada', short: 'Caixas, placas e topos',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, priceOnRequest: true,
        techniques: ['sublimacao_localizada'], printSizes: ['A4', 'A3'], defaultPrint: 'A3', note: 'Orçamento pelo WhatsApp.' },
      { id: 'bone', name: 'Boné personalizado', short: 'DTF ou bordado',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, priceOnRequest: true,
        techniques: ['dtf'], printSizes: ['10x10'], defaultPrint: '10x10', note: 'Orçamento pelo WhatsApp.' },
      { id: 'chinelo', name: 'Chinelo personalizado', short: 'Adulto e infantil',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, priceOnRequest: true,
        techniques: ['sublimacao_localizada'], printSizes: ['10x10'], defaultPrint: '10x10', note: 'Orçamento pelo WhatsApp.' },
      { id: 'caixinha_caneca', name: 'Caixinha branca para caneca', short: 'Embalagem de presente',
        category: 'brindes', kind: 'objeto', whatsappOnly: true, techniques: ['sublimacao_localizada'],
        blank: 2.63, printSizes: ['10x10'], defaultPrint: '10x10', modeOnly: 'revenda', note: 'Orçamento pelo WhatsApp.' }
    ]
  },

  sizes: {
    total:      ['PP', 'P', 'M', 'G', 'GG', 'EXG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
    adulto:     ['PP', 'P', 'M', 'G', 'GG', 'EXG'],
    feminino:   ['PP', 'P', 'M', 'G', 'GG'],
    infantil:   ['2', '4', '6', '8', '10', '12', '14'],
    promocional:['4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'EXG'],
    calca:      ['2', '4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'EXG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']
  },

  /* ------------------------- GUIA EXPLICATIVO DO SITE ------------------------ */
  /* Cada bloco vira uma seção da página "Como funciona". Editável no Admin → Guia. */
  info: [
    { id: 'o-que-e', group: 'Entenda a estampa', icon: 'shirt', tags: ['estampa total', 'básico'],
      title: 'O que é estampa total (personalização total)',
      lead: 'É a peça inteira estampada: frente, costas, mangas e gola. O tecido é impresso antes da costura, então a arte pode cobrir 100% da camiseta — com degradê, foto, pattern e cor de fundo — sem limite de cores.',
      bullets: [
        'A tinta entra na fibra do poliéster: a estampa tem toque zero, não é uma "etiqueta" colada na peça.',
        'Não descasca, não craquela e não desbota na lavagem comum.',
        'Feita sob encomenda para você: não é peça de estoque.',
        'Serve para camiseta, baby look, regata, regata feminina nadador, regata machão, infantil e calça capoeira.'
      ],
      note: 'Estampa total só é possível em tecido de poliéster (Dry Fit ou Poliflex). Em algodão a tinta não fixa — por isso não trabalhamos com algodão nem com polo.' },

    { id: 'tecidos', group: 'Entenda a estampa', icon: 'layers', tags: ['dry fit', 'poliflex', 'tecido'],
      title: 'Dry Fit × Poliflex: qual tecido escolher',
      lead: 'Os dois são 100% poliéster e aceitam estampa total. A diferença é o toque e o uso.',
      table: {
        head: ['', 'Dry Fit', 'Poliflex'],
        rows: [
          ['Toque', 'Leve, esportivo, secagem rápida', 'Mais macio e encorpado, caimento de malha'],
          ['Melhor para', 'Times, corrida, abadá, praia, calor', 'Uniforme de empresa, uso diário, moda'],
          ['Transparência', 'Um pouco mais fina', 'Mais fechada'],
          ['Preço até 10 peças', 'R$ 55,00', 'R$ 65,00'],
          ['Preço acima de 10 peças', 'R$ 50,00', 'R$ 60,00'],
          ['Adicionais', 'Manga longa + R$5,50 · Gola V + R$1,50', 'Manga longa + R$5,50 · Gola V + R$1,50']
        ]
      },
      note: 'Na dúvida, Dry Fit para esporte e calor; Poliflex para uniforme de empresa e uso diário.' },

    { id: 'modelagens', group: 'Entenda a estampa', icon: 'palette', tags: ['modelagem', 'baby look', 'regata', 'nadador', 'machão'],
      title: 'Modelagens disponíveis',
      lead: 'Todas entram na mesma tabela de preço. O que muda é o corte, a gola, a manga e a grade de tamanhos.',
      table: {
        head: ['Modelagem', 'Gola', 'Manga', 'Tamanhos'],
        rows: [
          ['Camiseta unissex', 'Redonda (inclusa) ou V (+ R$1,50)', 'Curta (inclusa) ou longa (+ R$5,50)', 'PP ao G6'],
          ['Baby look', 'Redonda (inclusa) ou V (+ R$1,50)', 'Curta', 'PP ao GG'],
          ['Regata unissex', 'Redonda', 'Sem manga (cavada)', 'PP ao G6'],
          ['Regata feminina nadador', 'Redonda', 'Sem manga · costas nadador', 'PP ao GG'],
          ['Camiseta machão (oversized)', 'Redonda (inclusa) ou V (+ R$1,50)', 'Curta (inclusa) ou longa (+ R$5,50)', 'PP ao G6'],
          ['Camiseta infantil', 'Redonda (inclusa) ou V (+ R$1,50)', 'Curta (inclusa) ou longa (+ R$5,50)', '2 ao 14'],
          ['Regata infantil', 'Redonda', 'Sem manga', '2 ao 14'],
          ['Short / bermuda', '—', '—', 'PP ao G6'],
          ['Outra modelagem', 'Sob medida', 'Sob medida', 'Sob medida (valor no WhatsApp)']
        ]
      },
      note: 'Não trabalhamos com polo nem com algodão. Outra modelagem (cropped, blusa, camisa com recorte) é feita sob consulta.' },

    { id: 'tamanhos', group: 'Preço e prazo', icon: 'check', tags: ['tamanho', 'grade', 'plus size', 'GG'],
      title: 'Tamanhos e acréscimo acima do GG',
      lead: 'A grade vai do PP ao GG sem acréscimo. Acima do GG existem EXG e G1 a G6 — cada tamanho acima do GG soma R$3,00 por peça.',
      table: {
        head: ['Tamanho', 'Acréscimo por peça', 'Exemplo em Dry Fit até 10 peças'],
        rows: [
          ['PP · P · M · G · GG', 'incluso', 'R$ 55,00'],
          ['EXG', '+ R$ 3,00', 'R$ 58,00'],
          ['G1', '+ R$ 6,00', 'R$ 61,00'],
          ['G2', '+ R$ 9,00', 'R$ 64,00'],
          ['G3', '+ R$ 12,00', 'R$ 67,00'],
          ['G4', '+ R$ 15,00', 'R$ 70,00'],
          ['G5', '+ R$ 18,00', 'R$ 73,00'],
          ['G6', '+ R$ 21,00', 'R$ 76,00'],
          ['Infantil 2 a 14', 'incluso', 'R$ 55,00 (mesma tabela)']
        ]
      },
      note: 'Na hora de montar o pedido, o site já mostra o preço de cada tamanho ao lado do campo de quantidade. A tabela de medidas (cm) é enviada pelo WhatsApp antes da produção.' },

    { id: 'preco', group: 'Preço e prazo', icon: 'money', tags: ['preço', 'faixa', 'desconto'],
      title: 'Como o preço é formado',
      lead: 'O valor da peça estampada é a soma de 4 coisas — todas visíveis antes de você enviar o pedido.',
      steps: [
        'Tecido: Dry Fit (R$55 até 10 peças · R$50 acima de 10) ou Poliflex (R$65 · R$60).',
        'Adicionais de modelagem: manga longa + R$5,50 · gola V + R$1,50.',
        'Tamanho acima do GG: + R$3,00 por tamanho (EXG, G1 … G6).',
        'Extras que agregam valor: nome individual R$5, número R$3, etiqueta interna R$2, embalagem individual R$2,50, ribana na cor da estampa R$3, bolso aplicado R$4, patrocínio na manga R$4.'
      ],
      bullets: [
        'Não existe quantidade mínima: fazemos de 1 peça a lote. Acima de 10 peças do mesmo tecido, o preço cai automaticamente.',
        'A faixa de preço é calculada por tecido somando todos os itens do pedido.',
        'Bordado e silk screen são sob consulta.'
      ],
      note: 'Exemplo: 12 camisetas Dry Fit gola redonda manga curta com número = 12 × (R$50,00 + R$3,00) = R$636,00.' },

    { id: 'prazo', group: 'Preço e prazo', icon: 'clock', tags: ['prazo', 'lote', 'sábado', '15 a 20 dias'],
      title: 'Prazo e lote de produção',
      lead: 'A estampa total é produzida em lotes, aos sábados. O prazo é de 15 a 20 dias e começa a contar com a arte aprovada e o pagamento autorizado.',
      steps: [
        'Você envia o pedido e a arte.',
        'O designer devolve a arte final para você aprovar no site.',
        'Com a arte aprovada e o pagamento autorizado, o pedido entra no lote.',
        'O site marca "Pronto para retirada" e avisa você.'
      ],
      bullets: [
        'Estampa total: 15 a 20 dias.',
        'Localizada em sublimação: 3 a 4 dias.',
        'Localizada em DTF: 5 a 7 dias.',
        'Peça lisa (revenda): 1 a 2 dias.'
      ],
      note: 'Em lotes cheios o prazo pode passar um pouco de 20 dias. A data do topo do site é a previsão atualizada pela equipe.' },

    { id: 'janela', group: 'Preço e prazo', icon: 'layers', tags: ['lote', 'data', 'produção'],
      title: 'Como funcionam os lotes',
      lead: 'Cada lote tem uma data de produção. O site mostra a próxima data disponível e, quando aquele lote enche, passa a oferecer a data seguinte.',
      bullets: [
        'A próxima data disponível aparece no topo do site.',
        'Você não compra hoje para receber em um lote futuro: vale sempre a data aberta.',
        'Localizada, brindes e peças lisas têm prazo próprio.',
        'Pedido acima de 100 peças: fale antes no WhatsApp para reservar a data.'
      ],
      note: 'Para abadá ou evento com data marcada, envie o pedido com pelo menos 25 dias de antecedência.' },

    { id: 'arte', group: 'Pedido e pagamento', icon: 'upload', tags: ['arte', 'arquivo', 'aprovação'],
      title: 'Como enviar a sua arte',
      lead: 'Você pode anexar a arte no pedido, mandar depois pelo WhatsApp, ou pedir para a nossa equipe criar. De qualquer forma, nada vai para produção sem a sua aprovação.',
      bullets: [
        'Formatos aceitos: PNG, JPG, PDF, SVG, AI, PSD, CDR — ou apenas a foto que você tem no celular.',
        'Quanto maior o arquivo, melhor: mínimo recomendado 300 dpi no tamanho real da estampa.',
        'Em estampa total a arte é aplicada no molde da peça, com sangria — o designer ajusta isso para você.',
        'Se a arte tiver branco, na estampa total o branco sai branco (a peça é impressa por inteiro).',
        'Cores: trabalhamos em perfil para sublimação. Pode haver pequena variação de tom entre tela e tecido.',
        'Criação de arte: enviamos o layout para aprovação; alterações depois de aprovada podem gerar novo prazo.'
      ],
      steps: [
        'Você envia a arte principal (site ou WhatsApp).',
        'Designer confere e prepara a arte final.',
        'Você aprova aqui no site (fica registrado data e hora).',
        'Só então o pedido entra no lote.'
      ],
      note: 'A arte é indexada no pedido: você sempre consegue ver e baixar a versão aprovada.' },

    { id: 'pagamento', group: 'Pedido e pagamento', icon: 'money', tags: ['pix', 'cartão', 'comprovante', '3x'],
      title: 'Formas de pagamento',
      lead: 'Três caminhos, todos com liberação de produção somente depois do pagamento autorizado.',
      table: {
        head: ['Forma', 'Como funciona', 'Quando produz'],
        rows: [
          ['PIX 50% + 50%', 'Entrada de 50% para reservar o lote; saldo na retirada', 'Após a entrada autorizada'],
          ['PIX integral', 'Pagamento cheio no PIX, com 5% de desconto', 'Imediatamente após autorizado'],
          ['Cartão de crédito', 'Em até 3x pelo site', 'Após autorização'],
          ['Dinheiro / débito na retirada', 'Combinado com o atendente', 'Pedido pronto']
        ]
      },
      bullets: [
        'Você envia o comprovante aqui no pedido: ele recebe um código (REC-0001, REC-0002…) e é validado pela equipe.',
        'Comprovante validado = pagamento autorizado = pedido liberado para o lote.',
        'Pedidos de revenda (peça lisa) podem parcelar em até 12x, como na loja oficial.'
      ],
      note: 'Nunca liberamos produção com comprovante em análise. Isso protege você e a nossa fila.' },

    { id: 'retirada', group: 'Pedido e pagamento', icon: 'map', tags: ['retirada', 'entrega', 'frete', 'endereço'],
      title: 'Retirada na loja e entrega',
      lead: 'A retirada é na loja, em Praia Grande/SP. Para outras cidades, enviamos por transportadora ou Correios com frete por conta do cliente.',
      bullets: [
        'Endereço: Avenida Presidente Kennedy, 6545 – Praia Grande/SP.',
        'Horário: segunda a sexta, 9h às 18h · sábado, 9h às 13h.',
        'O site marca "Pronto para retirada" e você recebe o aviso.',
        'Envio para outras cidades: consulte prazo e frete no WhatsApp antes de fechar o pedido.',
        'Pedido grande (time, empresa, evento): combinamos entrega fracionada.'
      ],
      note: 'Leve o número do pedido (ex.: D-2026-0912) na retirada.' },

    { id: 'localizada', group: 'Outros serviços', icon: 'palette', tags: ['sublimação', 'DTF', 'localizada', 'whatsapp'],
      title: 'Estampa localizada (sublimação e DTF) — orçamento no WhatsApp',
      lead: 'Na estampa localizada a arte vai só onde você escolher (peito, costas, manga). Ela depende de cor da peça, tamanho e posição da arte — por isso o valor é fechado na conversa do WhatsApp, em minutos.',
      table: {
        head: ['', 'Sublimação localizada', 'DTF têxtil'],
        rows: [
          ['Onde funciona', 'Só em poliéster branco ou claro', 'Em qualquer cor de peça'],
          ['Se a arte tem branco', 'Aparece a cor da peça', 'Sai branco de verdade'],
          ['Toque', 'Zero', 'Leve película'],
          ['Estampa 10×10 cm', 'R$ 6,50', 'R$ 6,50'],
          ['Estampa A4', 'R$ 13,00', 'R$ 15,00'],
          ['Estampa A3', 'R$ 16,00', 'R$ 20,00'],
          ['Prazo', '3 a 4 dias', '5 a 7 dias']
        ]
      },
      bullets: [
        'Camiseta poliéster lisa: branca R$15,79 · mescla, mescla clara, rosa, rosa chiclete R$16,42 · preta R$18,42 (preta só em DTF).',
        'Camiseta infantil branca R$13,16 · promocional branca R$10,60.',
        'Canecas, garrafas, azulejos, toalhas, chaveiros, bonés e chinelos também são feitos em sublimação.',
        'Valores de referência: o total fechado depende da peça + estampa + quantidade e é confirmado no WhatsApp.'
      ],
      note: 'Clique em "Falar no WhatsApp" e mande: peça, cor, quantidade, tamanho da estampa e a arte. Respondemos com o valor fechado.' },

    { id: 'terceiros', group: 'Outros serviços', icon: 'shirt', tags: ['sua peça', 'DTF', 'terceiros'],
      title: 'Estampamos a peça que você trouxer',
      lead: 'Você manda a camiseta, o moletom, o boné ou o tecido e nós estampamos.',
      bullets: [
        'DTF têxtil: funciona em qualquer cor de peça, aceita degradê e detalhe fino.',
        'Sublimação: só em peça de poliéster branca ou clara.',
        'Não trabalhamos com polo.',
        'Envie pelo WhatsApp: foto da peça, composição (na etiqueta), quantidade, tamanho e posição da estampa.',
        'Peça de terceiros: o prazo é contado a partir da chegada das peças aqui.'
      ],
      note: 'Risco de peça do cliente: se a peça não suportar a temperatura da prensa, avisamos antes de produzir.' },

    { id: 'cuidados', group: 'Pós-venda', icon: 'note', tags: ['lavagem', 'cuidados', 'durabilidade'],
      title: 'Cuidados com a peça estampada',
      lead: 'Estampa total em poliéster é muito resistente, mas alguns cuidados fazem a peça durar anos.',
      bullets: [
        'Lave do avesso, em água fria e com sabão neutro.',
        'Não use alvejante nem cloro.',
        'Não deixe de molho por horas.',
        'Seque à sombra — não use secadora em temperatura alta.',
        'Não passe ferro direto sobre a estampa (se precisar, use pano por cima e ferro morno).',
        'Poliéster amassa pouco: normalmente basta estender bem a peça.'
      ] },

    { id: 'trocas', group: 'Pós-venda', icon: 'ticket', tags: ['troca', 'garantia', 'chamado'],
      title: 'Trocas, garantia e chamados',
      lead: 'Produto personalizado é feito sob encomenda com a sua arte e a sua grade — por isso não tem troca por arrependimento. Mas tem garantia contra defeito.',
      bullets: [
        'Garantia contra defeito de produção ou de estampa: refazemos a peça.',
        'Prazo para apontar defeito: até 7 dias depois da retirada.',
        'Erro nosso (tamanho, cor, arte diferente da aprovada): refazemos sem custo.',
        'Erro de informação enviado pelo cliente (grade, nome, arte aprovada): refazemos com custo do material.',
        'Você abre um chamado aqui no pedido: alteração (ALT), acompanhamento (ACO), finalização (FIN) ou erro (ERR), com opção de urgência.'
      ],
      note: 'Confira a arte aprovada antes de autorizar a produção: é ela que vale.' },

    { id: 'quem', group: 'Outros serviços', icon: 'user', tags: ['empresa', 'time', 'escola', 'evento'],
      title: 'Para quem fazemos',
      lead: 'De 1 peça ao lote completo, sempre sem quantidade mínima.',
      bullets: [
        'Times, escolinhas e academias: uniforme com nome, número e patrocinador.',
        'Blocos, festas e eventos: abadá, regata e camiseta de turma.',
        'Empresas e comércio: uniforme, brinde de fim de ano, kit de boas-vindas.',
        'Escolas e formaturas: camiseta de turma e infantil 2 a 14.',
        'Revendedores: peça lisa e insumo na loja oficial dstamp.com.br, peça estampada aqui.',
        'Pessoa física: 1 camiseta de presente, caneca, garrafa.'
      ] }
  ],

  examples: [
    { id: 'ex1', title: 'Uniforme de time — camiseta estampa total', technique: 'total', fabric: 'Dry Fit',
      product: 'Camiseta unissex', color: 'Estampa total multicolor', qty: '20 a 250 peças', leadTime: '15–20 dias (lote de sábado)',
      img: '/img/exemplo-total-1.jpg',
      desc: 'Peça inteira estampada: frente, costas e mangas, com escudo, número e patrocinador. A partir de 1 peça, com preço melhor acima de 10.',
      tags: ['Times', 'Escolinhas', 'Empresas'] },
    { id: 'ex2', title: 'Abadá de bloco — regata estampa total', technique: 'total', fabric: 'Dry Fit',
      product: 'Regata unissex', color: 'Estampa total sunset', qty: 'lote de evento', leadTime: '15–20 dias',
      img: '/img/exemplo-abada.jpg',
      desc: 'Abadás e regatas de evento entram no lote de estampa total. Degradê, foto e cor de fundo sem limite de cores.',
      tags: ['Abadás', 'Blocos', 'Festas'] },
    { id: 'ex3', title: 'Kit academia — baby look e nadador', technique: 'total', fabric: 'Poliflex',
      product: 'Baby look + regata feminina nadador', color: 'Estampa total da marca', qty: 'a partir de 1 peça', leadTime: '15–20 dias',
      img: '/img/exemplo-total-2.jpg',
      desc: 'Modelagem feminina com costas nadador e baby look, no mesmo lote e na mesma arte — uniforme completo da equipe.',
      tags: ['Academias', 'Equipes', 'Beach sports'] },
    { id: 'ex4', title: 'Camiseta infantil de turma', technique: 'total', fabric: 'Dry Fit',
      product: 'Camiseta infantil', color: 'Estampa total colorida', qty: 'tamanhos 2 a 14', leadTime: '15–20 dias',
      img: '/img/exemplo-infantil.jpg',
      desc: 'Camiseta de turma, escola e festa infantil: mesma tabela de preço do adulto, sem acréscimo de tamanho.',
      tags: ['Escolas', 'Turmas', 'Festas'] },
    { id: 'ex5', title: 'Estampa localizada em peça escura — DTF', technique: 'dtf', fabric: 'Poliéster (ou a sua peça)',
      product: 'Camiseta preta + DTF A3', color: 'Preta', qty: 'sem mínimo', leadTime: '5–7 dias · orçamento no WhatsApp',
      img: '/img/exemplo-dtf.jpg',
      desc: 'DTF funciona em qualquer cor de peça, com degradê e detalhes finos. Referência: 10x10 R$6,50 · A4 R$15 · A3 R$20.',
      tags: ['Moda', 'Presentes', 'Peça de terceiros'] },
    { id: 'ex6', title: 'Canecas e garrafas personalizadas', technique: 'sublimacao_localizada', fabric: 'Cerâmica / polímero / inox',
      product: 'Caneca branca 325ml · garrafa térmica 500ml', color: 'Branca', qty: 'sem mínimo', leadTime: '3–4 dias · orçamento no WhatsApp',
      img: '/img/exemplo-caneca.jpg',
      desc: 'Brindes em sublimação: caneca de cerâmica, polímero, vidro jateado, chopp, squeezes de alumínio e garrafa térmica inox.',
      tags: ['Presentes', 'Empresas', 'Lembranças'] }
  ],

  faq: [
    { q: 'O que é estampa total?', a: 'É a peça inteira estampada — frente, costas, mangas e gola — em tecido de poliéster (Dry Fit ou Poliflex). A tinta entra na fibra, então a estampa tem toque zero, não descasca e não craquela. É o formato de abadá, uniforme de time e camiseta de evento.' },
    { q: 'Existe quantidade mínima?', a: 'Não. Fazemos de 1 peça até o lote completo. O preço tem duas faixas: até 10 peças e acima de 10 peças (mais barato).' },
    { q: 'Quanto custa uma camiseta em estampa total?', a: 'Dry Fit: R$55,00 até 10 peças e R$50,00 acima de 10. Poliflex: R$65,00 e R$60,00. Manga longa soma R$5,50 e gola V soma R$1,50. Cada tamanho acima do GG (EXG, G1 a G6) soma R$3,00 por peça.' },
    { q: 'Quais modelagens vocês fazem?', a: 'Camiseta unissex, baby look, regata unissex, regata feminina nadador, regata machão (a camiseta sem manga), camiseta infantil, regata infantil e calça capoeira. Outra modelagem (cropped, blusa, recorte especial) é feita sob consulta. Não trabalhamos com polo nem com algodão.' },
    { q: 'Qual é o prazo?', a: 'Estampa total: 15 a 20 dias, produzida em lote nos sábados. O prazo começa depois da arte aprovada e do pagamento autorizado. Sublimação localizada: 3 a 4 dias. DTF: 5 a 7 dias.' },
    { q: 'Por que a estampa localizada só é orçada no WhatsApp?', a: 'Porque o valor depende da cor da peça, do tamanho e da posição da estampa (10x10, A4 ou A3) e de quantas artes são. No WhatsApp fechamos isso em minutos. O site mostra os valores de referência para você já ter uma ideia.' },
    { q: 'Vocês estampam a peça que eu levar?', a: 'Sim, em DTF têxtil (qualquer cor de peça) ou sublimação (só poliéster branco ou claro). Envie foto da peça, composição, quantidade e tamanho da estampa pelo WhatsApp.' },
    { q: 'Como funciona o pagamento?', a: 'PIX com 50% de entrada e saldo na retirada, PIX integral com 5% de desconto, ou cartão de crédito em até 3x pelo site. Você envia o comprovante no pedido, ele recebe um código (REC-####) e é validado pela equipe. Só depois disso o pedido entra no lote.' },
    { q: 'Como sei quando fica pronto?', a: 'Você acompanha o pedido aqui no site pelo número (ex.: D-2026-0912) e pelo seu WhatsApp cadastrado. Quando a produção termina, o pedido aparece como "Pronto para retirada".' },
    { q: 'Posso mudar o pedido depois de enviar?', a: 'Pode, até a data do lote (quantidade e comprovante). Depois disso a alteração é feita pelo atendente, se o pedido ainda não tiver entrado em produção.' },
    { q: 'Como envio a arte?', a: 'Anexando no pedido, mandando no WhatsApp ou pedindo para a nossa equipe criar. Aceitamos PNG, JPG, PDF, SVG, AI, PSD e CDR. Nada vai para produção sem a sua aprovação registrada no site.' },
    { q: 'Onde retiro? Vocês entregam?', a: 'Retirada na loja: Avenida Presidente Kennedy, 6545 – Praia Grande/SP. Para outras cidades enviamos por Correios ou transportadora, com frete por conta do cliente — consulte antes de fechar.' }
  ],

  integrations: {
    olist:  { enabled: false, note: 'Importação de pedidos via URL de notificação (order-received / order-confirmed). Exportação usa SKU + variação.' },
    sysloja:{ enabled: false, note: 'Integração de grade (tamanho × cor) e pedidos de venda por referência de produto.' }
  }
};

/* ------------------------------- SEEDS ---------------------------------- */

function isoWeek(dateInput) {
  const d = new Date(dateInput);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const y0 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((t - y0) / 86400000) + 1) / 7);
  return year + '-W' + String(week).padStart(2, '0');
}
function weekEnd(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDay() || 7;                // segunda=1 ... domingo=7
  const end = new Date(d);
  end.setDate(d.getDate() + (7 - day));
  end.setHours(23, 59, 59, 999);
  return end;
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function item(over) {
  return Object.assign({
    id: 'it_' + crypto.randomBytes(3).toString('hex'),
    productId: 'camiseta', technique: 'total', mode: 'estampa',
    fabricId: 'dryfit', collar: 'redonda', sleeve: 'curta',
    colorId: null, colorName: '', prints: [], sizes: {}, qty: 0,
    extras: [], observation: ''
  }, over);
}

function seedOrder(cfg, p) {
  const items = (p.items || [p.item]).filter(Boolean).map(it => item(it));
  const totals = computeTotals(cfg, items);
  const ratio = p.payment && p.payment.ratio != null ? p.payment.ratio : 0;
  const paid = Number((totals.total * ratio).toFixed(2));
  const pm = (p.payment && p.payment.method) || (ratio > 0 && ratio < 1 ? 'pix_50' : ratio >= 1 ? 'pix_total' : 'pix_50');
  const o = {
    id: 'ord_' + crypto.randomBytes(3).toString('hex'),
    code: p.code,
    weekId: isoWeek(p.createdAt),
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
    customer: { name: p.customer.name, phone: p.customer.phone, email: p.customer.email || '', doc: p.customer.doc || '', city: p.customer.city || 'Praia Grande/SP' },
    items: items,
    qtyTotal: totals.qty,
    techniqueMain: (items.find(i => i.mode !== 'revenda') || items[0] || {}).technique || 'revenda',
    payment: {
      method: pm,
      status: (p.payment && p.payment.status) || (paid > 0 ? 'autorizado' : 'aguardando_comprovante'),
      paid: paid,
      receipts: (p.payment && p.payment.receipts) || []
    },
    art: Object.assign({ status: 'pendente', main: null, final: null, approvals: [], notes: '' }, p.art || {}),
    stage: p.stage,
    timeline: p.timeline || [{ at: p.createdAt, label: 'Pedido recebido', by: 'site' }],
    tickets: [],
    internalNotes: [],
    notes: p.notes || []
  };
  (o.payment.receipts || []).forEach(r => { if (r.amount == null) r.amount = paid; });
  return o;
}

/* Banco de produção: sem pedidos, clientes e usuários de demonstração.
   Ative com DSTAMP_NO_DEMO=1. O administrador vem de DSTAMP_ADMIN_EMAIL /
   DSTAMP_ADMIN_PASSWORD; sem senha definida, uma é gerada e impressa uma única vez. */
function buildEmptyDb() {
  const email = String(process.env.DSTAMP_ADMIN_EMAIL || 'admin@dstamp.com.br').toLowerCase().trim();
  let pass = String(process.env.DSTAMP_ADMIN_PASSWORD || '');
  const generated = !pass;
  if (generated) pass = crypto.randomBytes(9).toString('base64url');
  console.log('Banco novo em MODO PRODUÇÃO (DSTAMP_NO_DEMO=1): nenhum dado de demonstração.');
  console.log('  Administrador: ' + email + ' · senha: ' + pass + (generated ? '   ← GERADA AGORA, anote e troque depois' : '   ← vinda de DSTAMP_ADMIN_PASSWORD'));
  return {
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    counters: { order: 900, ticket_alteracao: 0, ticket_acompanhamento: 0, ticket_finalizacao: 0, ticket_erro: 0 },
    sessions: {},
    users: [{ id: 'u1', name: 'Administrador', email, password: pass, role: 'admin', active: true }],
    customers: [], orders: [], tickets: [], notifications: [], logs: []
  };
}

function buildSeed() {
  if (process.env.DSTAMP_NO_DEMO) return buildEmptyDb();
  const now = new Date();
  const db = {
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    counters: { order: 919, ticket_alteracao: 1, ticket_acompanhamento: 1, ticket_finalizacao: 1, ticket_erro: 1, 'receipt_D-2026-0912': 1 },
    sessions: {},
    users: [
      { id: 'u1', name: 'Administrador',    email: 'admin@dstamp.com.br',     password: 'admin123',  role: 'admin',     active: true },
      { id: 'u2', name: 'Ana Ribeiro',      email: 'atendente@dstamp.com.br', password: 'atende123', role: 'atendente', active: true },
      { id: 'u3', name: 'Bruno Lima',       email: 'bruno@dstamp.com.br',     password: 'atende123', role: 'atendente', active: true },
      { id: 'u4', name: 'Camila Prado',     email: 'designer@dstamp.com.br',  password: 'arte123',   role: 'designer',  active: true }
    ],
    customers: [
      { id: 'c1', name: 'Arena Beach Sports', phone: '13999990001', email: 'compras@arenabeach.com.br', doc: '12.345.678/0001-90', city: 'Praia Grande/SP', note: 'Cliente recorrente — times de praia' },
      { id: 'c2', name: 'Studio Fit PG',      phone: '13999990002', email: 'contato@studiofit.com.br',  doc: '98.765.432/0001-11', city: 'Praia Grande/SP', note: 'Academia — pedidos mensais' },
      { id: 'c3', name: 'Colégio Nova Geração', phone: '13999990003', email: 'secretaria@ng.com.br',    doc: '11.222.333/0001-44', city: 'São Vicente/SP', note: 'Uniforme de evento anual' }
    ],
    orders: [],
    tickets: [],
    notifications: [],
    logs: []
  };

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0912', createdAt: daysAgo(9), stage: 'estampa',
    customer: { name: 'Arena Beach Sports', phone: '13999990001', email: 'compras@arenabeach.com.br', doc: '12.345.678/0001-90' },
    items: [{ productId: 'camiseta', technique: 'total', fabricId: 'dryfit', collar: 'redonda', sleeve: 'curta',
              sizes: { P: 40, M: 100, G: 70, GG: 30 }, extras: [{ code: 'numero' }] }],
    payment: { method: 'pix_50', ratio: 0.5, status: 'autorizado', receipts: [
      { id: 'rec_seed1', seq: 'REC-0001', name: 'comprovante-50.png', file: null, method: 'pix', status: 'autorizado',
        uploadedAt: daysAgo(9), decidedAt: daysAgo(8), decidedBy: 'Ana Ribeiro', identification: 'REC-0001 · PIX · 50% do pedido D-2026-0912' }] },
    art: { status: 'aprovada', main: null, final: { name: 'arte-final-arena.png', url: null },
           approvals: [{ id: 'ap1', message: 'Arte final com degradê aprovada. Entra no lote de sábado.', sentAt: daysAgo(8), decision: 'aprovada', decisionAt: daysAgo(7), decisionMessage: 'Aprovado, pode seguir!' }],
           notes: 'Degradê laranja → azul. Número nas costas conforme a lista.' },
    timeline: [
      { at: daysAgo(9), label: 'Pedido recebido', by: 'site' },
      { at: daysAgo(9), label: 'Conferência de arte', by: 'Camila Prado' },
      { at: daysAgo(8), label: 'Aprovação do cliente', by: 'cliente' },
      { at: daysAgo(8), label: 'Pagamento autorizado (REC-0001)', by: 'Ana Ribeiro' },
      { at: daysAgo(6), label: 'Na fila do lote', by: 'Ana Ribeiro' },
      { at: daysAgo(2), label: 'Estampando', by: 'Ana Ribeiro' }
    ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0913', createdAt: daysAgo(3), stage: 'aguardando_aprovacao',
    customer: { name: 'Studio Fit PG', phone: '13999990002', email: 'contato@studiofit.com.br', doc: '98.765.432/0001-11' },
    items: [{ productId: 'babylook', technique: 'total', fabricId: 'poliflex', collar: 'v', sleeve: 'curta',
              sizes: { PP: 20, P: 30, M: 40, G: 30, GG: 10 } }],
    payment: { method: 'pix_50', ratio: 0, status: 'aguardando_comprovante' },
    art: { status: 'aguardando_aprovacao', main: { name: 'logo-studiofit.ai', url: null },
           final: { name: 'studiofit-final-v2.png', url: null },
           approvals: [{ id: 'ap2', message: 'Ajustei o contraste do logo como combinado. Confere a gola V? Aprovando hoje, entra no próximo lote.', sentAt: daysAgo(1), decision: null }],
           notes: 'Logo enviado em .ai. Mantivemos o azul institucional (Pantone 286). Baby look gola V em Poliflex.' },
    timeline: [
      { at: daysAgo(3), label: 'Pedido recebido', by: 'site' },
      { at: daysAgo(2), label: 'Conferência de arte', by: 'Camila Prado' },
      { at: daysAgo(1), label: 'Arte final enviada para aprovação', by: 'Camila Prado' }
    ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0914', createdAt: daysAgo(2), stage: 'pagamento',
    customer: { name: 'Colégio Nova Geração', phone: '13999990003', email: 'secretaria@ng.com.br', doc: '11.222.333/0001-44', city: 'São Vicente/SP' },
    items: [{ productId: 'camiseta_poli', technique: 'dtf', colorId: 'preta', colorName: 'Preta',
              prints: [{ size: 'A3', position: 'costas' }, { size: '10x10', position: 'peito' }],
              sizes: { P: 20, M: 25, G: 15 }, extras: [{ code: 'nome' }] }],
    payment: { method: 'cartao_3x', ratio: 0, status: 'em_analise', receipts: [
      { id: 'rec_seed2', seq: null, name: 'comprovante-transacao.jpg', file: null, method: 'cartao_3x', status: 'em_analise',
        uploadedAt: daysAgo(1), note: 'Pagamento integral em 3x no cartão — aguardando conferência' }] },
    art: { status: 'em_analise', main: null, final: null, approvals: [], notes: 'DTF A3 nas costas + 10x10 no peito. Peça preta: DTF obrigatório (sublimação não pega em cor escura).' },
    timeline: [ { at: daysAgo(2), label: 'Pedido recebido', by: 'site' } ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0915', createdAt: daysAgo(1), stage: 'conferencia_arte',
    customer: { name: 'Time Areia Azul', phone: '13999990004', email: 'timeareia@email.com' },
    items: [
      { productId: 'caneca_branca', technique: 'sublimacao_localizada', prints: [{ size: 'A4', position: 'caneca' }], qty: 12, observation: 'Nome de cada jogador' },
      { productId: 'garrafa_termica_500', technique: 'sublimacao_localizada', prints: [{ size: 'A4', position: 'garrafa' }], qty: 5, observation: 'Escudo do time' }
    ],
    payment: { method: 'pix_total', ratio: 0, status: 'aguardando_comprovante' },
    art: { status: 'em_analise', main: { name: 'escudo-areia-azul.pdf', url: null }, final: null, approvals: [], notes: 'Cliente pediu urgência — evento dia 25.' },
    timeline: [ { at: daysAgo(1), label: 'Pedido recebido', by: 'site' } ],
    notes: [{ id: 'n1', at: daysAgo(1), by: 'cliente', role: 'cliente', text: 'Preciso para o dia 25, é possível?', internal: false },
            { id: 'n2', at: daysAgo(1), by: 'Ana Ribeiro', role: 'atendente', text: 'Brindes em sublimação: prazo 3–4 dias. Confirmar estoque de canecas antes de prometer a data.', internal: true }]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0916', createdAt: daysAgo(0), stage: 'recebido',
    customer: { name: 'Maria Fernanda', phone: '13999990005', email: 'mfe@email.com' },
    items: [{ productId: 'camiseta_poli', technique: 'sublimacao_localizada', colorId: 'branca', colorName: 'Branca',
              prints: [{ size: 'A4', position: 'peito' }], sizes: { M: 1 },
              observation: '1 peça só — presente de aniversário' }],
    payment: { method: 'pix_total', ratio: 0, status: 'aguardando_comprovante' },
    art: { status: 'pendente', main: null, final: null, approvals: [], notes: '' },
    timeline: [ { at: daysAgo(0), label: 'Pedido recebido', by: 'site' } ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0917', createdAt: daysAgo(0), stage: 'recebido',
    customer: { name: 'Papelaria Ki-Festa', phone: '13999990006', email: 'compras@kifesta.com.br', doc: '22.333.444/0001-55' },
    items: [
      { productId: 'caneca_branca', technique: 'revenda', mode: 'revenda', qty: 24, observation: 'Revenda — canecas lisas para a loja estampar' },
      { productId: 'caneca_polimero', technique: 'revenda', mode: 'revenda', qty: 12 }
    ],
    payment: { method: 'pix_total', ratio: 1, status: 'autorizado', receipts: [
      { id: 'rec_seed3', seq: 'REC-0002', name: 'pix-kifesta.png', file: null, method: 'pix', status: 'autorizado',
        uploadedAt: daysAgo(0), decidedAt: daysAgo(0), decidedBy: 'Administrador', identification: 'REC-0002 · PIX integral · pedido D-2026-0917' }] },
    art: { status: 'nao_se_aplica', main: null, final: null, approvals: [], notes: 'Pedido de revenda — sem arte.' },
    timeline: [ { at: daysAgo(0), label: 'Pedido recebido', by: 'site' },
                { at: daysAgo(0), label: 'Pagamento autorizado (REC-0002)', by: 'Administrador' } ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0918', createdAt: daysAgo(0), stage: 'conferencia_arte',
    customer: { name: 'Rafaela Souza', phone: '13999990007', email: 'rafaela@email.com' },
    items: [{ productId: 'regata_feminina', technique: 'total', fabricId: 'poliflex', collar: 'redonda', sleeve: 'nadador',
              sizes: { P: 2, M: 3, G: 1 }, observation: 'Regata nadador para a equipe de beach tennis — mesma arte nas 6 peças.' }],
    payment: { method: 'pix_total', ratio: 0, status: 'aguardando_comprovante' },
    art: { status: 'pendente', main: null, final: null, approvals: [], notes: 'Cliente vai mandar a arte pelo WhatsApp.' },
    timeline: [ { at: daysAgo(0), label: 'Pedido recebido', by: 'site' } ]
  }));

  db.orders.push(seedOrder(db.config, {
    code: 'D-2026-0919', createdAt: daysAgo(0), stage: 'fila',
    customer: { name: 'Bloco Maré Alta', phone: '13999990008', email: 'bloco.marealta@email.com', doc: '33.444.555/0001-66' },
    items: [
      { productId: 'regata', technique: 'total', fabricId: 'dryfit', collar: 'redonda', sleeve: 'regata',
        sizes: { P: 30, M: 60, G: 40, GG: 20 }, extras: [{ code: 'numero' }], observation: 'Abadá do bloco — número do folião nas costas.' },
      { productId: 'camiseta_infantil', technique: 'total', fabricId: 'dryfit', collar: 'redonda', sleeve: 'curta',
        sizes: { '4': 10, '6': 12, '8': 8 }, observation: 'Ala infantil do bloco.' }
    ],
    payment: { method: 'pix_50', ratio: 0.5, status: 'autorizado', receipts: [
      { id: 'rec_seed4', seq: 'REC-0003', name: 'pix-bloco-50.png', file: null, method: 'pix', status: 'autorizado',
        uploadedAt: daysAgo(0), decidedAt: daysAgo(0), decidedBy: 'Administrador', identification: 'REC-0003 · PIX · 50% do pedido D-2026-0919' }] },
    art: { status: 'aprovada', main: { name: 'abada-mare-alta.png', url: null }, final: { name: 'abada-mare-alta-final.png', url: null },
           approvals: [{ id: 'ap3', message: 'Arte final do abadá com degradê e número nas costas.', sentAt: daysAgo(0), decision: 'aprovada', decisionAt: daysAgo(0), decisionMessage: 'Aprovado!' }],
           notes: 'Degradê azul → verde. Número individual nas costas (extra).' },
    timeline: [
      { at: daysAgo(0), label: 'Pedido recebido', by: 'site' },
      { at: daysAgo(0), label: 'Arte aprovada', by: 'cliente' },
      { at: daysAgo(0), label: 'Pagamento autorizado (REC-0003)', by: 'Administrador' },
      { at: daysAgo(0), label: 'Na fila do lote', by: 'Ana Ribeiro' }
    ]
  }));

  const tickets = [
    { code: 'ALT-0001', orderCode: 'D-2026-0912', category: 'alteracao', priority: 'normal', title: 'Trocar 20 peças G por GG (acréscimo de R$3/peça)', body: 'Antes de entrar no lote, trocar 20 unidades de G para GG. GG não tem acréscimo; confirmar com o cliente.', status: 'resolvido', by: 'Ana Ribeiro', createdAt: daysAgo(5) },
    { code: 'FIN-0001', orderCode: 'D-2026-0915', category: 'finalizacao', priority: 'normal', title: 'Embalagem individual das canecas', body: 'Cliente pediu caixinha branca para cada caneca (R$2,63/un na revenda).', status: 'aberto', by: 'Ana Ribeiro', createdAt: daysAgo(2) },
    { code: 'ERR-0001', orderCode: 'D-2026-0914', category: 'erro', priority: 'urgente', title: 'Arquivo de arte sem sangria', body: 'PDF do DTF A3 veio sem sangria de 5mm — pedir arquivo novo ao cliente.', status: 'aberto', by: 'Camila Prado', createdAt: daysAgo(1) },
    { code: 'ACO-0001', orderCode: 'D-2026-0915', category: 'acompanhamento', priority: 'urgente', title: 'Cliente cobrando prazo dia 25', body: 'Verificar capacidade da semana antes de prometer data.', status: 'em_andamento', by: 'Ana Ribeiro', createdAt: daysAgo(1) }
  ];

  db.tickets = tickets.map((t, i) => Object.assign({
    id: 'tk_' + (i + 1), orderId: null, urgent: t.priority === 'urgente', updatedAt: t.createdAt, messages: []
  }, t));

  db.notifications = [
    { id: 'nt1', to: 'admin', type: 'comprovante', title: 'Novo comprovante aguardando conferência', body: 'Pedido D-2026-0914 · Colégio Nova Geração · cartão 3x', orderCode: 'D-2026-0914', createdAt: daysAgo(1), read: false },
    { id: 'nt4', to: 'admin', type: 'lote', title: 'Lote de estampa total de 31/10', body: 'Janela desta semana: 250 peças de estampa total. Feche o lote conforme o volume de pedidos.', orderCode: null, createdAt: daysAgo(0), read: false },
    { id: 'nt2', to: 'admin', type: 'chamado_urgente', title: 'Chamado URGENTE #ERR-0001', body: 'Arte sem sangria no pedido D-2026-0914', orderCode: 'D-2026-0914', createdAt: daysAgo(1), read: false },
    { id: 'nt3', to: 'designer', type: 'arte', title: 'Arte aguardando aprovação do cliente', body: 'Pedido D-2026-0913 · Studio Fit PG · enviada há 1 dia', orderCode: 'D-2026-0913', createdAt: daysAgo(1), read: false }
  ];

  return db;
}

/* ------------------------------ PERSISTÊNCIA ----------------------------- */

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  db = buildSeed();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.error('save error', e); }
  }, 120);
}
function saveNow() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) {} }

function nextSeq(key, prefix, width) {
  db.counters[key] = (db.counters[key] || 0) + 1;
  return prefix + '-' + String(db.counters[key]).padStart(width, '0');
}
function rid(p) { return (p || 'x_') + crypto.randomBytes(4).toString('hex'); }
function phoneDigits(p) { return String(p || '').replace(/\D/g, ''); }
function samePhone(a, b) {
  const x = phoneDigits(a), y = phoneDigits(b);
  if (!x || !y) return false;
  return x === y || (y.length >= 4 && x.endsWith(y)) || (x.length >= 4 && y.endsWith(x));
}
function findOrder(code) { return db.orders.find(o => String(o.code).toUpperCase() === String(code || '').trim().toUpperCase()); }
function teamAuth(req, roles) {
  const h = req.headers.authorization || '';
  const token = h.replace(/^Bearer\s+/i, '');
  const s = db.sessions[token];
  if (!s) return null;
  if (roles && roles.length && !roles.includes(s.role)) return null;
  return s;
}
function pushNotification(n) {
  db.notifications.unshift(Object.assign({ id: rid('nt_'), createdAt: new Date().toISOString(), read: false }, n));
  if (db.notifications.length > 400) db.notifications.length = 400;
}
function log(action, data, by) {
  db.logs.unshift({ id: rid('lg_'), at: new Date().toISOString(), action, data, by: by || 'sistema' });
  if (db.logs.length > 800) db.logs.length = 800;
}
function approveReceiptsUrl() { return db.config.brand.whatsapp; }

/* --------------------------- CÁLCULO / PRAZO ----------------------------- */

const TECHNIQUE_LABEL = {
  total: 'Estampa total (personalização total)',
  sublimacao_localizada: 'Estampa localizada em sublimação',
  dtf: 'Estampa localizada em DTF têxtil',
  revenda: 'Revenda (peça lisa, sem estampa)'
};

const SLEEVE_LABEL = { curta: 'Manga curta', longa: 'Manga longa', regata: 'Regata (sem manga)', nadador: 'Nadador (costas nadador)' };
const COLLAR_LABEL = { redonda: 'Gola redonda', v: 'Gola V' };
function findProduct(cfg, id) { return (cfg.catalog.products || []).find(p => p.id === id) || {}; }
function sleeveLabel(it) { return (it && it.technique === 'total') ? (SLEEVE_LABEL[it.sleeve] || SLEEVE_LABEL.curta) : '—'; }
function collarLabel(it) { return (it && it.technique === 'total' && it.collar) ? (COLLAR_LABEL[it.collar] || COLLAR_LABEL.redonda) : '—'; }
function productDelta(prod) { return Number((prod || {}).delta || 0); }
function findColor(prod, colorId) { return (prod.colors || []).find(c => c.id === colorId) || (prod.colors || [])[0] || null; }
function catalogCategory(cfg, id) { return (cfg.catalog.categories || []).find(c => c.id === id) || {}; }

function tierPrice(tiers, qty) {
  const list = (tiers || []).slice().sort((a, b) => (a.upTo == null ? 1e9 : a.upTo) - (b.upTo == null ? 1e9 : b.upTo));
  const t = list.find(x => x.upTo == null || qty <= x.upTo);
  return t ? t.price : (list.length ? list[list.length - 1].price : 0);
}
function blankPrice(cfg, it) {
  const prod = findProduct(cfg, it.productId);
  if (prod.priceOnRequest) return null;
  if ((prod.colors || []).length) {
    const c = findColor(prod, it.colorId);
    return c ? c.price : null;
  }
  return prod.blank != null ? prod.blank : null;
}
function printTableKey(cfg, it) {
  const prod = findProduct(cfg, it.productId);
  if (it.technique === 'dtf') return 'dtf';
  if (it.technique === 'sublimacao_localizada') return 'sublimacao';
  return null;
}
function printUnitPrice(cfg, it) {
  const key = printTableKey(cfg, it);
  if (!key) return 0;
  const table = (cfg.prices.print || {})[key] || {};
  return (it.prints || []).reduce((a, p) => a + (Number(table[p.size]) || 0), 0);
}
function extrasFor(cfg, it) {
  const list = (cfg.extras || []).concat((cfg.totalAddons || []).map(a => ({ code: a.code, label: a.label, price: a.price, unit: 'peça', totalOnly: true })));
  return (it.extras || []).map(e => {
    const x = list.find(v => v.code === e.code);
    if (!x) return null;
    return { code: x.code, label: x.label, price: x.price, unit: x.unit || 'peça', qty: e.qty || null };
  }).filter(Boolean);
}
function sizeSurchargeTotal(cfg, it) {
  const order = cfg.prices.sizeOrder || [];
  const gg = order.indexOf(cfg.prices.sizeFallback || 'GG');
  let sum = 0;
  Object.entries(it.sizes || {}).forEach(([size, q]) => {
    const idx = order.indexOf(size);
    if (gg > -1 && idx > gg) sum += (idx - gg) * (Number(cfg.prices.sizeSurchargeAboveGG) || 0) * Number(q || 0);
  });
  return sum;
}
function productSizesKey(cfg, it) {
  const prod = findProduct(cfg, it.productId);
  const map = prod.sizesKey || {};
  if (it.mode === 'revenda') return map.total || map.localizada || null;
  return map[it.technique] || map.localizada || map.total || null;
}
function sizeList(cfg, it) {
  const key = productSizesKey(cfg, it);
  return key ? (cfg.sizes[key] || []) : [];
}
function itemQty(it) {
  const hasSizes = it.sizes && Object.keys(it.sizes).length;
  if (hasSizes) return Object.values(it.sizes).reduce((a, b) => a + Number(b || 0), 0);
  return Number(it.qty || 0);
}

/* Preço de um item com detalhamento (quebra por peça, estampa, extras e tamanho) */
function priceItem(cfg, it, ctx) {
  const qty = itemQty(it);
  if (it.unitPriceOverride != null && Number(it.unitPriceOverride) > 0) {
    const u = Number(it.unitPriceOverride);
    const extras = extrasFor(cfg, it);
    const extrasSum = Number((extras.reduce((a, e) => a + (e.price || 0), 0) * qty).toFixed(2));
    return { qty: qty, onRequest: false, unit: u, subtotal: Number((u * qty + extrasSum).toFixed(2)), extrasSum: extrasSum, extras: extras,
             breakdown: [{ label: 'Preço ajustado manualmente', value: u, unit: true }], technique: it.mode === 'revenda' ? 'revenda' : it.technique };
  }
  const prod = findProduct(cfg, it.productId);
  const extras = extrasFor(cfg, it);
  const out = { qty: qty, onRequest: !!prod.priceOnRequest, breakdown: [], unit: 0, extrasSum: 0, subtotal: 0, technique: it.mode === 'revenda' ? 'revenda' : it.technique };

  if (it.mode === 'revenda') {
    const blank = blankPrice(cfg, it);
    if (blank == null) { out.onRequest = true; return out; }
    out.unit = Number(blank.toFixed(2));
    out.breakdown.push({ label: 'Peça lisa (revenda) — ' + (findColor(prod, it.colorId) || {}).name || 'peça', value: out.unit, unit: true });
    const extrasPerPiece = extras.reduce((a, e) => a + (e.price || 0), 0);
    out.extrasSum = Number((extrasPerPiece * qty).toFixed(2));
    out.subtotal = Number((out.unit * qty + out.extrasSum).toFixed(2));
    return out;
  }

  if (it.technique === 'total') {
    const tiers = (cfg.prices.total || {})[it.fabricId] || [];
    const addons = (cfg.totalAddons || []).filter(a => (a.code === 'gola_v' && it.collar === 'v') || (a.code === 'manga_longa' && it.sleeve === 'longa'));
    const agg = (ctx && ctx.totalByFabric && ctx.totalByFabric[it.fabricId]) || qty;
    const base = tierPrice(tiers, agg);
    const delta = productDelta(prod);
    const addonsSum = addons.reduce((a, x) => a + (x.price || 0), 0);
    const surcharge = sizeSurchargeTotal(cfg, it);
    out.unit = Number((base + addonsSum + delta).toFixed(2));
    out.surcharge = Number(surcharge.toFixed(2));
    out.breakdown.push({ label: 'Peça ' + (it.fabricId === 'poliflex' ? 'Poliflex' : 'Dry Fit') + ' — ' + (agg > 10 ? 'acima de 10 peças' : 'até 10 peças'), value: base, unit: true });
    if (delta) out.breakdown.push({ label: 'Adicional da modelagem (' + (prod.name || 'peça') + ')', value: delta, unit: true });
    addons.forEach(a => out.breakdown.push({ label: a.label, value: a.price, unit: true }));
    if (surcharge > 0) out.breakdown.push({ label: 'Tamanhos acima do GG (total do item)', value: out.surcharge, unit: false });
    /* preço fechado por tamanho (para o cliente ver "EXG = R$58,00") */
    const ord = cfg.prices.sizeOrder || [];
    const ggIdx = ord.indexOf(cfg.prices.sizeFallback || 'GG');
    const step = Number(cfg.prices.sizeSurchargeAboveGG) || 0;
    out.sizePrices = {};
    Object.keys(it.sizes || {}).concat(sizeList(cfg, it)).forEach(sz => {
      const idx = ord.indexOf(sz);
      const add = (ggIdx > -1 && idx > ggIdx) ? (idx - ggIdx) * step : 0;
      out.sizePrices[sz] = Number((base + addonsSum + delta + add).toFixed(2));
    });
  } else {
    const blank = blankPrice(cfg, it);
    const print = printUnitPrice(cfg, it);
    if (blank == null) { out.onRequest = true; return out; }
    out.unit = Number((blank + print).toFixed(2));
    const color = findColor(prod, it.colorId);
    out.breakdown.push({ label: 'Peça lisa' + (color ? ' (' + color.name + ')' : ''), value: blank, unit: true });
    out.breakdown.push({ label: 'Estampa ' + (it.technique === 'dtf' ? 'DTF' : 'sublimação') + ' ' + ((it.prints || []).map(p => p.size).join(' + ') || '—'), value: print, unit: true });
  }

  const extrasPerPiece = extras.reduce((a, e) => a + (e.price || 0), 0);
  out.extrasSum = Number((extrasPerPiece * qty).toFixed(2));
  out.subtotal = Number((out.unit * qty + (out.surcharge || 0) + out.extrasSum).toFixed(2));
  out.extras = extras;
  return out;
}

function computeTotals(cfg, items) {
  const totalByFabric = {};
  (items || []).forEach(it => {
    if (it.mode !== 'revenda' && it.technique === 'total') totalByFabric[it.fabricId] = (totalByFabric[it.fabricId] || 0) + itemQty(it);
  });
  const lines = (items || []).map(it => {
    const p = priceItem(cfg, it, { totalByFabric: totalByFabric });
    return Object.assign({ itemId: it.id }, p);
  });
  const total = Number(lines.reduce((a, l) => a + (l.subtotal || 0), 0).toFixed(2));
  const qty = lines.reduce((a, l) => a + (l.qty || 0), 0);
  return { lines: lines, total: total, qty: qty, totalByFabric: totalByFabric, pixDiscount: Number(cfg.rules.pixDiscountPercent || 0) };
}

function addBusinessDays(date, days) {
  const d = new Date(date);
  let n = 0;
  while (n < days) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return d;
}
/* Próximo lote de estampa total: sempre no dia da semana configurado (sábado),
   a partir da data de lote definida no painel — e nunca antes da data-base
   (hoje, ou a data em que a arte foi aprovada / o pagamento autorizado). */
function nextBatchAfter(cfg, date) {
  const b = cfg.batch || {};
  const target = typeof b.weekday === 'number' ? b.weekday : 6;
  let d = new Date(b.nextDate || Date.now());
  if (isNaN(d.getTime())) d = new Date();
  const floor = date ? new Date(date) : new Date();
  floor.setHours(0, 0, 0, 0);
  if (d < floor) d = new Date(floor);
  let guard = 0;
  while (d.getDay() !== target && guard < 400) { d.setDate(d.getDate() + 1); guard++; }
  return d;
}
function nextBatchDate(cfg) { return nextBatchAfter(cfg, new Date()); }
function leadFor(cfg, it) {
  if (it.mode === 'revenda') return Object.assign({ min: 1, max: 2, batch: false }, cfg.leadTimes.revenda || {});
  return cfg.leadTimes[it.technique] || { min: 5, max: 7 };
}
function leadSummaryForOrder(cfg, o) {
  const items = o.items || [];
  const hasBatch = items.some(i => i.mode !== 'revenda' && i.technique === 'total');
  /* vale o prazo do item mais demorado: o pedido só fica pronto quando o último item sai */
  const outs = items.map(i => leadFor(cfg, i));
  const slowest = outs.slice().sort((a, b) => b.max - a.max)[0] || { min: 1, max: 2 };
  return { min: slowest.min, max: slowest.max, batch: hasBatch, batchDate: hasBatch ? nextBatchDate(cfg).toISOString() : null };
}
function weekLoadTotal(weekId, ignoreOrderId) {
  return db.orders
    .filter(o => o.weekId === weekId && o.stage !== 'entregue' && (!ignoreOrderId || o.id !== ignoreOrderId))
    .reduce((a, o) => a + (o.items || []).filter(i => i.mode !== 'revenda' && i.technique === 'total').reduce((x, i) => x + itemQty(i), 0), 0);
}
/* Status público da semana: o cliente vê o nível ("lote aberto / últimas vagas / lote completo")
   e a data do próximo lote. O contador de peças (186/250) é informação interna da equipe. */
function weekStatus(load, limit) {
  const ratio = limit > 0 ? (load || 0) / limit : 0;
  const level = ratio >= 1 ? 'fechado' : (ratio >= 0.8 ? 'ultimas' : 'aberto');
  const label = level === 'fechado' ? 'Lote completo' : (level === 'ultimas' ? 'Últimas vagas' : 'Lote aberto');
  return { level, label };
}
function capacityPublic(cfg, load, incoming) {
  const limit = ((cfg.capacity || {}).totalPerWeek) || 250;
  const enforce = cfg.capacity ? cfg.capacity.enforce !== false : true;
  const total = (load || 0) + (incoming || 0);
  const ok = !enforce || total <= limit;
  const st = weekStatus(total, limit);
  /* se a semana encheu, o pedido cai no lote SEGUINTE (sábado + 7 dias) */
  const next = ok ? nextBatchDate(cfg) : new Date(nextBatchDate(cfg).getTime() + 7 * 864e5);
  return {
    ok: ok,
    level: st.level,
    label: st.label,
    nextBatch: next.toISOString(),
    nextBatchLabel: next.toLocaleDateString('pt-BR')
  };
}

function orderView(o, audience) {
  const cfg = db.config;
  const totals = computeTotals(cfg, o.items);
  const v = JSON.parse(JSON.stringify(o));
  v.totals = totals;
  v.techniques = [...new Set(o.items.filter(i => i.mode !== 'revenda').map(i => i.technique))];
  v.techniquesLabel = v.techniques.map(t => TECHNIQUE_LABEL[t] || t);
  v.hasRevenda = o.items.some(i => i.mode === 'revenda');
  v.lead = leadSummaryForOrder(cfg, o);
  v.leadDays = v.lead.max;
  const anchor = [
    new Date(o.createdAt),
    o.art && o.art.approvals && o.art.approvals.some(a => a.decision === 'aprovada') ? new Date(o.art.approvals.filter(a => a.decision === 'aprovada').slice(-1)[0].decisionAt || o.updatedAt) : null,
    o.payment && o.payment.status === 'autorizado' ? new Date(o.payment.updatedAt || o.updatedAt) : null
  ].filter(Boolean).sort((a, b) => b - a)[0];
  const batch = nextBatchAfter(cfg, anchor);
  v.predictedDate = (v.lead.batch ? batch : addBusinessDays(anchor, v.lead.max)).toISOString();
  v.predictedLabel = v.lead.batch
    ? 'Lote de ' + batch.toLocaleDateString('pt-BR') + ' · 15 a 20 dias'
    : 'Prazo de ' + v.lead.min + ' a ' + v.lead.max + ' dias';
  v.editableUntil = weekEnd(o.createdAt).toISOString();
  v.editable = new Date() <= weekEnd(o.createdAt);
  v.stageIndex = Math.max(0, STAGES.findIndex(s => s.id === o.stage));
  v.stages = STAGES;
  v.balance = Number(Math.max(0, totals.total - (o.payment.paid || 0)).toFixed(2));
  v.paid = Number((o.payment.paid || 0).toFixed(2));
  if (audience === 'cliente') {
    v.internalNotes = [];
    v.notes = (v.notes || []).filter(n => !n.internal);
    v.logs = [];
  }
  return v;
}
function catalog() {
  const cfg = db.config;
  return {
    catalog: cfg.catalog, sizes: cfg.sizes, prices: cfg.prices, extras: cfg.extras, totalAddons: cfg.totalAddons,
    leadTimes: cfg.leadTimes, capacity: cfg.capacity, batch: Object.assign({}, cfg.batch, { nextDate: nextBatchDate(cfg).toISOString() }),
    rules: cfg.rules, stages: STAGES, ticketCategories: CATEGORIES, techniqueLabels: TECHNIQUE_LABEL, faq: cfg.faq,
    info: cfg.info || [], store: cfg.store || {}, sleeveLabels: SLEEVE_LABEL, collarLabels: COLLAR_LABEL,
    minimums: { total: 1, sublimacao_localizada: 1, dtf: 1, revenda: 1 }
  };
}

/* --------------------------------- HTTP ---------------------------------- */

const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8' };

function send(res, code, data, type) {
  const body = type === 'raw' ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': type === 'raw' ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendFile(res, file, headers) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }, headers || {}));
    res.end(buf);
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 30 * 1024 * 1024) { reject(new Error('payload muito grande (máx. 30MB)')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
function saveUpload(upload, prefix) {
  if (!upload || !upload.dataUrl) return null;
  const m = /^data:([^;]+);base64,(.*)$/.exec(upload.dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  const safe = String(upload.name || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(-60);
  const fname = prefix + '_' + Date.now() + '_' + safe;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
  return { name: upload.name || safe, file: fname, url: '/uploads/' + fname, size: buf.length, at: new Date().toISOString() };
}

const routes = [];
function route(method, pattern, handler, roles) {
  const pnames = [];
  const src = pattern.source.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => { pnames.push(name); return '([^/]+)'; });
  if (!pnames.length) {
    /* nomeia automaticamente os grupos de captura conforme o recurso da rota */
    if (src.includes('orders')) pnames.push('code');
    else if (src.includes('receipts')) pnames.push('id');
    else if (src.includes('tickets')) pnames.push('id');
    else if (src.includes('customers')) pnames.push('id');
    else if (src.includes('users')) pnames.push('id');
  }
  routes.push({ method, pattern: new RegExp(src), handler, roles, pnames });
}

/* ------------------------------- ROTAS API ------------------------------- */

/* Health check para a hospedagem (Render/Koyeb/VPS) e para o ping anti-sleep. */
route('GET', /^\/api\/health$/, () => ({
  ok: true, version: VERSION, uptime: Math.round(process.uptime()),
  orders: db.orders.length, week: isoWeek(new Date())
}));

route('GET', /^\/api\/bootstrap$/, (ctx) => {
  const week = isoWeek(new Date());
  const load = weekLoadTotal(week);
  const limit = db.config.capacity.totalPerWeek;
  const st = weekStatus(load, limit);
  return {
    config: db.config,
    catalog: catalog(),
    examples: db.config.examples,
    /* contador de peças só para a equipe logada */
    week: Object.assign({ id: week, level: st.level, label: st.label },
      ctx.session ? { loadTotal: load, limit, orders: db.orders.filter(o => o.weekId === week).length } : {}),
    session: ctx.session ? { name: ctx.session.name, role: ctx.session.role, email: ctx.session.email } : null
  };
});

route('POST', /^\/api\/auth\/login$/, (ctx) => {
  const email = String(ctx.body.email || '').toLowerCase().trim();
  const pass = String(ctx.body.password || '');
  const u = db.users.find(x => x.email.toLowerCase() === email && x.password === pass && x.active !== false);
  if (!u) return { status: 401, data: { error: 'E-mail ou senha inválidos.' } };
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { id: u.id, name: u.name, email: u.email, role: u.role, at: new Date().toISOString() };
  save();
  return { token, user: { name: u.name, email: u.email, role: u.role } };
});

route('POST', /^\/api\/auth\/logout$/, (ctx) => {
  const h = (ctx.req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (h) delete db.sessions[h];
  save();
  return { ok: true };
});

function normalizeItem(cfg, it) {
  const prod = findProduct(cfg, it.productId);
  const out = Object.assign({
    id: it.id || rid('it_'), productId: it.productId, mode: it.mode === 'revenda' ? 'revenda' : 'estampa',
    technique: it.mode === 'revenda' ? 'revenda' : (it.technique || (prod.techniques || [])[0] || 'sublimacao_localizada'),
    fabricId: it.fabricId || (prod.kind === 'textil' && it.technique === 'total' ? 'dryfit' : null),
    collar: it.collar || 'redonda', sleeve: it.sleeve || 'curta', modelagem: prod.name || '',
    colorId: it.colorId || (prod.colors && prod.colors[0] ? prod.colors[0].id : null),
    colorName: it.colorName || (findColor(prod, it.colorId) || {}).name || it.color || '',
    prints: (it.prints || []).filter(x => x && x.size),
    sizes: it.sizes || {}, qty: Number(it.qty || 0), extras: it.extras || [],
    observation: it.observation || '', unitPriceOverride: it.unitPriceOverride != null ? Number(it.unitPriceOverride) : null
  }, {});
  /* a modelagem define quais opções existem (regata/machão não têm manga, calça não tem gola...) */
  const collars = prod.collar || [], sleeves = prod.sleeve || [];
  if (out.technique === 'total') {
    out.collar = collars.length ? (collars.includes(out.collar) ? out.collar : collars[0]) : '';
    out.sleeve = sleeves.length ? (sleeves.includes(out.sleeve) ? out.sleeve : sleeves[0]) : '';
  }
  const sizes = sizeList(cfg, out);
  if (!sizes.length) { out.sizes = {}; if (!out.qty) out.qty = 1; }
  else {
    const clean = {};
    sizes.forEach(sz => { const v = Math.max(0, Math.floor(Number((out.sizes || {})[sz] || 0))); if (v > 0) clean[sz] = v; });
    out.sizes = clean;
    out.qty = 0;
  }
  return out;
}

/* ---- Orçamento (carrinho) ---- */
route('POST', /^\/api\/quote$/, (ctx) => {
  const cfg = db.config;
  const items = (ctx.body.items || []).map(it => Object.assign({ sizes: {}, extras: [], prints: [] }, it));
  const totals = computeTotals(cfg, items);
  const week = isoWeek(new Date());
  const load = weekLoadTotal(week);
  const totalPieces = items.filter(i => i.mode !== 'revenda' && i.technique === 'total').reduce((a, i) => a + itemQty(i), 0);
  const alerts = [];
  items.forEach((it, idx) => {
    const prod = findProduct(cfg, it.productId);
    const color = findColor(prod, it.colorId);
    if (it.mode !== 'revenda' && it.technique === 'sublimacao_localizada' && color && color.light === false)
      alerts.push({ level: 'err', item: idx, msg: `Sublimação não pega em ${color.name}. Para peça escura use DTF Têxtil (mesma estampa, qualquer cor).` });
    if (it.mode !== 'revenda' && it.technique === 'sublimacao_localizada' && color && color.light)
      alerts.push({ level: 'info', item: idx, msg: 'Sublimação em peça clara: onde a arte tiver branco, aparece a cor da camiseta.' });
    if ((prod.techniques || []).length && it.mode !== 'revenda' && !(prod.techniques || []).includes(it.technique))
      alerts.push({ level: 'err', item: idx, msg: `${prod.name || it.productId} não é produzido com ${TECHNIQUE_LABEL[it.technique] || it.technique}.` });
    if (prod.priceOnRequest) alerts.push({ level: 'info', item: idx, msg: `${prod.name}: valor sob consulta — o atendente confirma pelo WhatsApp.` });
    if (prod.whatsappOnly && !ctx.session) alerts.push({ level: 'err', item: idx, msg: `${prod.name || it.productId}: este item é orçado pelo WhatsApp (estampa localizada). Envie a peça, a cor, a quantidade e o tamanho da estampa.` });
  });
  const batch = nextBatchAfter(cfg, new Date());
  const capacity = capacityPublic(cfg, load, totalPieces);
  capacity.week = week;
  if (ctx.session) Object.assign(capacity, { used: load, incoming: totalPieces, limit: cfg.capacity.totalPerWeek });
  if (!capacity.ok) alerts.push({ level: 'err', msg: `O lote de estampa total desta semana fechou. Seu pedido entra no lote de ${capacity.nextBatchLabel} — fale com o atendente no WhatsApp para reservar a data.` });
  const hasBatch = items.some(i => i.mode !== 'revenda' && i.technique === 'total');
  const leads = items.map(i => leadFor(cfg, i));
  const lead = leads.length ? leads.slice().sort((a, b) => b.max - a.max)[0] : { min: 1, max: 2 };
  const predicted = hasBatch ? batch : addBusinessDays(new Date(), lead.max);
  return {
    totals, capacity, alerts, leadDays: lead,
    leadLabel: hasBatch ? `Lote de ${batch.toLocaleDateString('pt-BR')} · ${cfg.leadTimes.total.min} a ${cfg.leadTimes.total.max} dias` : `${lead.min} a ${lead.max} dias`,
    batchDate: hasBatch ? batch.toISOString() : null,
    predictedDate: predicted.toISOString()
  };
});

/* ---- Criar pedido (cliente pelo site) ---- */
route('POST', /^\/api\/orders$/, (ctx) => {
  const cfg = db.config;
  const b = ctx.body;
  const team = ctx.session;
  const items = (b.items || []).map(it => normalizeItem(cfg, it));
  if (!items.length) return { status: 400, data: { error: 'Inclua ao menos 1 item no pedido.' } };
  if (!b.customer || !String(b.customer.name || '').trim() || !phoneDigits(b.customer.phone))
    return { status: 400, data: { error: 'Informe nome e WhatsApp do cliente.' } };

  if (!team) {
    const blocked = items.map(i => findProduct(cfg, i.productId)).filter(pr => pr.whatsappOnly);
    if (blocked.length) return { status: 400, data: { error: `${blocked[0].name} é orçado pelo WhatsApp. Chame a gente com a peça, a cor, a quantidade e o tamanho da estampa — devolvemos o valor fechado em minutos.` } };
  }
  const week = isoWeek(new Date());
  const piecesTotal = items.filter(i => i.mode !== 'revenda' && i.technique === 'total').reduce((a, i) => a + itemQty(i), 0);
  const load = weekLoadTotal(week);
  if (cfg.capacity.enforce && !b.force && (load + piecesTotal) > cfg.capacity.totalPerWeek) {
    const cap = capacityPublic(cfg, load, piecesTotal);
    return { status: 409, data: {
      error: `O lote de estampa total desta semana fechou. Seu pedido entra no lote de ${cap.nextBatchLabel}. Fale com o atendente pelo WhatsApp para reservar a data.`,
      capacity: team ? Object.assign({ week, load, limit: cfg.capacity.totalPerWeek, incoming: piecesTotal }, cap) : cap
    } };
  }

  const totals = computeTotals(cfg, items);
  db.counters.order = (db.counters.order || 0) + 1;
  const code = 'D-' + new Date().getFullYear() + '-' + String(db.counters.order).padStart(4, '0');
  const customer = {
    id: (db.customers.find(c => samePhone(c.phone, b.customer.phone)) || {}).id || rid('c_'),
    name: b.customer.name, phone: phoneDigits(b.customer.phone), email: b.customer.email || '', doc: b.customer.doc || '', city: b.customer.city || ''
  };
  if (!db.customers.find(c => c.id === customer.id)) db.customers.push({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, doc: customer.doc, city: customer.city, note: 'Cadastrado pelo site' });

  const order = {
    id: rid('ord_'), code, weekId: week, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    customer, items, qtyTotal: totals.qty, techniqueMain: items[0].technique,
    payment: { method: b.paymentMethod || 'pix_50', status: 'aguardando_comprovante', paid: 0, receipts: [] },
    art: { status: 'pendente', main: null, final: null, approvals: [], notes: '' },
    stage: 'recebido',
    timeline: [{ at: new Date().toISOString(), label: 'Pedido recebido', by: team ? team.name : 'site' }],
    tickets: [], internalNotes: [],
    notes: (b.notes ? [{ id: rid('n_'), at: new Date().toISOString(), by: customer.name, role: 'cliente', text: b.notes, internal: false }] : [])
  };
  db.orders.unshift(order);
  pushNotification({ to: 'admin', type: 'pedido', title: 'Novo pedido pelo site · ' + code, body: `${customer.name} · ${totals.qty} peças · R$ ${totals.total.toFixed(2)}`, orderCode: code });
  pushNotification({ to: 'atendente', type: 'pedido', title: 'Novo pedido pelo site · ' + code, body: `${customer.name} · ${totals.qty} peças`, orderCode: code });
  log('pedido_criado', { code, qty: totals.qty, total: totals.total }, team ? team.name : 'site');
  save();
  return { order: orderView(order, 'cliente'), code };
});

/* ---- Acesso do cliente ao pedido ---- */
route('POST', /^\/api\/orders\/access$/, (ctx) => {
  const o = findOrder(ctx.body.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado. Confira o número (ex.: D-2026-0913).' } };
  if (!samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Telefone não confere com o cadastro do pedido.' } };
  return { order: orderView(o, 'cliente') };
});

/* ---- Lista de pedidos (equipe) ---- */
route('GET', /^\/api\/orders$/, (ctx) => {
  const q = (ctx.query.q || '').toLowerCase().trim();
  const stage = ctx.query.stage, technique = ctx.query.technique, art = ctx.query.art;
  let list = db.orders.slice();
  if (q) list = list.filter(o => (o.code + ' ' + o.customer.name + ' ' + o.customer.phone + ' ' + (o.customer.email || '')).toLowerCase().includes(q));
  if (stage) list = list.filter(o => o.stage === stage);
  if (technique) list = list.filter(o => o.items.some(i => i.technique === technique));
  if (art) list = list.filter(o => (o.art.status || 'pendente') === art);
  return {
    orders: list.map(o => orderView(o, 'equipe')),
    stages: STAGES,
    week: { id: isoWeek(new Date()), load: weekLoadTotal(isoWeek(new Date())), limit: db.config.capacity.totalPerWeek }
  };
}, ['admin', 'atendente', 'designer']);

route('POST', /^\/api\/orders\/([^/]+)\/view$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  if (ctx.session) return { order: orderView(o, 'equipe') };
  if (samePhone(o.customer.phone, ctx.body.phone)) return { order: orderView(o, 'cliente') };
  return { status: 403, data: { error: 'Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido.' } };
});

/* ---- Editar pedido (equipe) ---- */
route('PATCH', /^\/api\/orders\/([^/]+)$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  const b = ctx.body || {};
  const me = ctx.session.name;
  if (b.items) { o.items = b.items.map(it => Object.assign({ id: rid('it_'), sizes: {}, extras: [] }, it)); o.qtyTotal = computeTotals(db.config, o.items).qty; }
  if (b.customer) o.customer = Object.assign({}, o.customer, b.customer);
  if (b.payment) o.payment = Object.assign({}, o.payment, b.payment);
  if (b.art) o.art = Object.assign({}, o.art, b.art);
  if (b.stage && b.stage !== o.stage) {
    o.stage = b.stage;
    const st = STAGES.find(s => s.id === b.stage);
    o.timeline.push({ at: new Date().toISOString(), label: st ? st.label : b.stage, by: me });
    if (b.stage === 'pronto') pushNotification({ to: 'cliente:' + o.code, type: 'retirada', title: 'Pedido pronto para retirada!', body: `${o.code} está pronto para retirada na loja.`, orderCode: o.code });
  }
  if (b.internalNote) o.internalNotes.push({ id: rid('n_'), at: new Date().toISOString(), by: me, role: ctx.session.role, text: b.internalNote, internal: true });
  if (b.publicNote) o.notes.push({ id: rid('n_'), at: new Date().toISOString(), by: me, role: ctx.session.role, text: b.publicNote, internal: false });
  o.updatedAt = new Date().toISOString();
  log('pedido_editado', { code: o.code, campos: Object.keys(b) }, me);
  save();
  return { order: orderView(o, 'equipe') };
}, ['admin', 'atendente']);

/* ---- Cliente altera quantidade/comprovante na mesma semana ---- */
route('POST', /^\/api\/orders\/([^/]+)\/client-edit$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  if (!samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Telefone não confere.' } };
  if (new Date() > weekEnd(o.createdAt)) {
    return { status: 409, data: { error: 'O prazo de alteração pelo site (mesma semana do pedido) terminou. Fale com o atendente pelo WhatsApp — ele pode ajustar para você.' } };
  }
  const b = ctx.body;
  if (b.items) {
    const next = b.items.map(it => Object.assign({}, it, { sizes: it.sizes || {} }));
    const week = o.weekId;
    const otherLoad = db.orders.filter(x => x.weekId === week && x.id !== o.id).reduce((a, x) => a + (x.items || []).filter(i => i.technique === 'total').reduce((s, i) => s + itemQty(i), 0), 0);
    const mine = next.filter(i => i.technique === 'total').reduce((a, i) => a + itemQty(i), 0);
    if (db.config.capacity.enforce && (otherLoad + mine) > db.config.capacity.totalPerWeek) {
      return { status: 409, data: { error: 'Essa alteração passa da capacidade de produção desta semana. Fale com o atendente no WhatsApp para encaixar no próximo lote.' } };
    }
    o.items = next; o.qtyTotal = computeTotals(db.config, next).qty;
  }
  if (b.observation != null) o.notes.push({ id: rid('n_'), at: new Date().toISOString(), by: o.customer.name, role: 'cliente', text: b.observation, internal: false });
  o.updatedAt = new Date().toISOString();
  o.timeline.push({ at: new Date().toISOString(), label: 'Pedido alterado pelo cliente (mesma semana)', by: o.customer.name });
  pushNotification({ to: 'atendente', type: 'alteracao', title: 'Cliente alterou o pedido ' + o.code, body: 'Nova quantidade/composição enviada pelo site. Confira e reenvie comprovante se houve diferença.', orderCode: o.code });
  log('cliente_alterou_pedido', { code: o.code }, o.customer.name);
  save();
  return { order: orderView(o, 'cliente') };
});

/* ---- Comprovantes ---- */
route('POST', /^\/api\/orders\/([^/]+)\/receipts$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  const team = ctx.session;
  const clientOk = samePhone(o.customer.phone, ctx.body.phone);
  if (!team && !clientOk) return { status: 403, data: { error: 'Acesso não autorizado: informe o número do pedido e o WhatsApp cadastrado.' } };
  if (!team && new Date() > weekEnd(o.createdAt) && o.payment.status !== 'aguardando_comprovante')
    return { status: 409, data: { error: 'Envio de novo comprovante pelo site encerrado nesta semana. Fale com o atendente.' } };
  const file = saveUpload(ctx.body.upload, 'comp_' + o.code);
  if (!file) return { status: 400, data: { error: 'Anexe o comprovante (imagem ou PDF).' } };
  const receipt = {
    id: rid('rec_'), seq: null, name: file.name, file: file.file, url: file.url, size: file.size,
    amount: Number(ctx.body.amount || 0), method: ctx.body.method || o.payment.method, status: 'em_analise',
    uploadedAt: new Date().toISOString(), note: ctx.body.note || '', by: team ? team.name : o.customer.name, identification: null
  };
  o.payment.receipts.push(receipt);
  o.payment.status = 'em_analise';
  o.updatedAt = new Date().toISOString();
  o.timeline.push({ at: new Date().toISOString(), label: 'Comprovante enviado (em análise)', by: team ? team.name : o.customer.name });
  pushNotification({ to: 'admin', type: 'comprovante', title: 'Novo comprovante para conferir', body: `${o.code} · ${o.customer.name} · R$ ${receipt.amount.toFixed(2)} · ${receipt.method}`, orderCode: o.code });
  pushNotification({ to: 'atendente', type: 'comprovante', title: 'Novo comprovante para conferir', body: `${o.code} · ${o.customer.name}`, orderCode: o.code });
  log('comprovante_enviado', { code: o.code, amount: receipt.amount, method: receipt.method }, receipt.by);
  save();
  return { receipt, order: orderView(o, team ? 'equipe' : 'cliente') };
});

route('POST', /^\/api\/receipts\/([^/]+)\/decision$/, (ctx) => {
  let found = null;
  db.orders.forEach(o => o.payment.receipts.forEach(r => { if (r.id === ctx.params.id) found = { o, r }; }));
  if (!found) return { status: 404, data: { error: 'Comprovante não encontrado.' } };
  const { o, r } = found;
  const approve = !!ctx.body.approve;
  r.status = approve ? 'autorizado' : 'recusado';
  r.decidedAt = new Date().toISOString();
  r.decidedBy = ctx.session.name;
  r.decisionNote = ctx.body.note || '';
  if (approve) {
    r.seq = nextSeq('receipt_' + o.code, 'REC', 4);
    r.identification = `${r.seq} · ${String(r.method).toUpperCase()} · R$ ${Number(r.amount).toFixed(2)} · autorizado por ${ctx.session.name}`;
    o.payment.paid = Number((o.payment.receipts.filter(x => x.status === 'autorizado').reduce((a, x) => a + Number(x.amount || 0), 0)).toFixed(2));
    o.payment.status = 'autorizado';
    o.payment.updatedAt = new Date().toISOString();
    o.payment.creditedReceipt = r.seq;
    if (o.stage === 'recebido' || o.stage === 'conferencia_arte' || o.stage === 'aguardando_aprovacao' || o.stage === 'pagamento') {
      // mantém a etapa atual; a equipe avança manualmente
    }
    pushNotification({ to: 'admin', type: 'identificacao', title: `Identificação ${r.seq} autorizada`, body: `Pedido ${o.code} · ${o.customer.name} · R$ ${Number(r.amount).toFixed(2)} creditado automaticamente.`, orderCode: o.code });
    pushNotification({ to: 'cliente:' + o.code, type: 'pagamento', title: 'Pagamento autorizado', body: `Identificação ${r.seq} — seu pagamento foi confirmado.`, orderCode: o.code });
    o.timeline.push({ at: new Date().toISOString(), label: `Comprovante autorizado (${r.seq})`, by: ctx.session.name });
    log('comprovante_autorizado', { code: o.code, seq: r.seq, amount: r.amount }, ctx.session.name);
  } else {
    r.identification = 'recusado';
    pushNotification({ to: 'cliente:' + o.code, type: 'pagamento', title: 'Comprovante recusado', body: ctx.body.note || 'O comprovante não pôde ser validado. Verifique e reenvie.', orderCode: o.code });
    o.timeline.push({ at: new Date().toISOString(), label: 'Comprovante recusado', by: ctx.session.name });
    log('comprovante_recusado', { code: o.code, motivo: ctx.body.note }, ctx.session.name);
  }
  o.updatedAt = new Date().toISOString();
  save();
  return { receipt: r, order: orderView(o, 'equipe'), adminWhatsAppText: `D-Stamp · Identificação ${r.identification || r.status} — pedido ${o.code} (${o.customer.name}).` };
}, ['admin', 'atendente']);

route('GET', /^\/api\/receipts$/, (ctx) => {
  const out = [];
  db.orders.forEach(o => o.payment.receipts.forEach(r => out.push(Object.assign({}, r, { orderCode: o.code, customer: o.customer.name, stage: o.stage, orderId: o.id }))));
  out.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const status = ctx.query.status;
  return { receipts: status ? out.filter(r => r.status === status) : out, total: out.length };
}, ['admin', 'atendente']);

/* ---- Artes ---- */
route('POST', /^\/api\/orders\/([^/]+)\/art$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  const team = ctx.session;
  if (!team && !samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido.' } };
  const kind = ctx.body.kind === 'final' ? 'final' : 'main';
  const file = saveUpload(ctx.body.upload, 'arte_' + kind + '_' + o.code);
  if (!file) return { status: 400, data: { error: 'Anexe o arquivo da arte.' } };
  const entry = {
    name: file.name, url: file.url, file: file.file, size: file.size, at: new Date().toISOString(),
    by: team ? team.name : o.customer.name, note: ctx.body.note || ''
  };
  o.art[kind] = entry;
  o.art.status = kind === 'final' ? 'em_analise' : 'em_analise';
  o.art.history = (o.art.history || []).concat([Object.assign({ kind }, entry)]);
  o.updatedAt = new Date().toISOString();
  o.timeline.push({ at: new Date().toISOString(), label: kind === 'final' ? 'Arte final anexada pelo designer' : 'Arte principal anexada ao pedido', by: entry.by });
  pushNotification({ to: 'designer', type: 'arte', title: (kind === 'final' ? 'Arte final anexada' : 'Nova arte para conferência') + ' · ' + o.code, body: `${o.customer.name} · ${file.name}`, orderCode: o.code });
  log('arte_anexada', { code: o.code, kind, name: file.name }, entry.by);
  save();
  return { art: o.art, order: orderView(o, team ? 'equipe' : 'cliente') };
});

route('POST', /^\/api\/orders\/([^/]+)\/art\/send$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  if (!o.art.final) return { status: 400, data: { error: 'Anexe a arte final antes de enviar para aprovação.' } };
  const msg = String(ctx.body.message || '').trim();
  if (!msg) return { status: 400, data: { error: 'Escreva a mensagem que o cliente vai receber junto da arte.' } };
  const appr = { id: rid('ap_'), message: msg, file: o.art.final.name, url: o.art.final.url, sentAt: new Date().toISOString(), sentBy: ctx.session.name, decision: null };
  o.art.approvals.push(appr);
  o.art.status = 'aguardando_aprovacao';
  o.art.notes = ctx.body.notes != null ? ctx.body.notes : o.art.notes;
  o.stage = 'aguardando_aprovacao';
  o.timeline.push({ at: new Date().toISOString(), label: 'Arte final enviada para aprovação do cliente', by: ctx.session.name });
  o.updatedAt = new Date().toISOString();
  pushNotification({ to: 'cliente:' + o.code, type: 'arte', title: 'Sua arte está pronta para aprovação', body: msg, orderCode: o.code });
  pushNotification({ to: 'atendente', type: 'arte', title: 'Arte enviada ao cliente · ' + o.code, body: o.customer.name, orderCode: o.code });
  log('arte_enviada_cliente', { code: o.code }, ctx.session.name);
  save();
  return { art: o.art, order: orderView(o, 'equipe'), whatsappText: `D-Stamp · ${o.customer.name}, a arte final do pedido ${o.code} está pronta: ${msg}` };
}, ['admin', 'atendente', 'designer']);

route('POST', /^\/api\/orders\/([^/]+)\/art\/decision$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  const team = ctx.session;
  if (!team && !samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido.' } };
  const appr = o.art.approvals.filter(a => !a.decision).slice(-1)[0];
  if (!appr) return { status: 400, data: { error: 'Nenhuma arte pendente de aprovação.' } };
  const decision = ctx.body.decision === 'aprovada' ? 'aprovada' : 'ajuste';
  appr.decision = decision;
  appr.decisionAt = new Date().toISOString();
  appr.decisionMessage = String(ctx.body.message || '').trim();
  o.art.status = decision === 'aprovada' ? 'aprovada' : 'ajuste_solicitado';
  if (decision === 'aprovada') o.timeline.push({ at: new Date().toISOString(), label: 'Arte aprovada pelo cliente', by: team ? team.name : o.customer.name });
  else {
    o.stage = 'conferencia_arte';
    o.timeline.push({ at: new Date().toISOString(), label: 'Cliente pediu ajuste na arte', by: team ? team.name : o.customer.name });
    pushNotification({ to: 'designer', type: 'arte', title: 'Ajuste solicitado na arte · ' + o.code, body: appr.decisionMessage || '(sem detalhes)', orderCode: o.code });
  }
  pushNotification({ to: 'atendente', type: 'arte', title: `Arte ${decision === 'aprovada' ? 'aprovada' : 'com ajuste pedido'} · ${o.code}`, body: appr.decisionMessage || '', orderCode: o.code });
  o.updatedAt = new Date().toISOString();
  log('arte_' + decision, { code: o.code }, team ? team.name : o.customer.name);
  save();
  return { art: o.art, order: orderView(o, team ? 'equipe' : 'cliente') };
});

/* ---- Anotações / bloco de notas do pedido ---- */
route('POST', /^\/api\/orders\/([^/]+)\/notes$/, (ctx) => {
  const o = findOrder(ctx.params.code);
  if (!o) return { status: 404, data: { error: 'Pedido não encontrado.' } };
  const team = ctx.session;
  if (!team && !samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido.' } };
  const internal = team ? !!ctx.body.internal : false;
  const note = {
    id: rid('n_'), at: new Date().toISOString(), by: team ? team.name : o.customer.name,
    role: team ? team.role : 'cliente', text: String(ctx.body.text || '').trim(), internal
  };
  if (!note.text) return { status: 400, data: { error: 'Escreva a anotação.' } };
  o.notes.push(note);
  o.updatedAt = new Date().toISOString();
  save();
  return { note, order: orderView(o, team ? 'equipe' : 'cliente') };
});

/* ---- Chamados (tabelas separadas com numeração própria) ---- */
route('POST', /^\/api\/tickets$/, (ctx) => {
  const o = findOrder(ctx.body.orderCode);
  if (!o) return { status: 404, data: { error: 'Informe um número de pedido válido.' } };
  const team = ctx.session;
  if (!team && !samePhone(o.customer.phone, ctx.body.phone)) return { status: 403, data: { error: 'Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido.' } };
  const cat = CATEGORIES[ctx.body.category] ? ctx.body.category : 'acompanhamento';
  const urgent = !!ctx.body.urgent;
  const code = nextSeq('ticket_' + cat, CATEGORIES[cat].prefix, 4);
  const ticket = {
    id: rid('tk_'), code, orderId: o.id, orderCode: o.code, category: cat,
    priority: urgent ? 'urgente' : 'normal', urgent,
    title: String(ctx.body.title || '').trim() || CATEGORIES[cat].label,
    body: String(ctx.body.body || '').trim(), status: 'aberto',
    by: team ? team.name : o.customer.name, byRole: team ? team.role : 'cliente',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: []
  };
  db.tickets.unshift(ticket);
  o.tickets = o.tickets || [];
  o.tickets.unshift({ id: ticket.id, code, category: cat, urgent, title: ticket.title, at: ticket.createdAt, status: 'aberto' });
  o.timeline.push({ at: ticket.createdAt, label: `Chamado ${code} aberto (${CATEGORIES[cat].label}${urgent ? ' · URGENTE' : ''})`, by: ticket.by });
  pushNotification({ to: 'admin', type: urgent ? 'chamado_urgente' : 'chamado', title: `${urgent ? 'URGENTE · ' : ''}Chamado ${code} (${CATEGORIES[cat].label})`, body: `${o.code} · ${ticket.title}`, orderCode: o.code });
  pushNotification({ to: 'atendente', type: urgent ? 'chamado_urgente' : 'chamado', title: `${urgent ? 'URGENTE · ' : ''}${code} · ${o.code}`, body: ticket.title, orderCode: o.code });
  pushNotification({ to: 'designer', type: 'chamado', title: `${urgent ? 'URGENTE · ' : ''}${code} · ${o.code}`, body: ticket.title, orderCode: o.code });
  log('chamado_aberto', { code, orderCode: o.code, category: cat, urgent }, ticket.by);
  save();
  return { ticket };
});

route('GET', /^\/api\/tickets$/, (ctx) => {
  let list = db.tickets.slice();
  if (ctx.query.category) list = list.filter(t => t.category === ctx.query.category);
  if (ctx.query.status) list = list.filter(t => t.status === ctx.query.status);
  if (ctx.query.urgent === '1') list = list.filter(t => t.urgent);
  if (ctx.query.orderCode) list = list.filter(t => t.orderCode === ctx.query.orderCode);
  const q = (ctx.query.q || '').toLowerCase();
  if (q) list = list.filter(t => (t.code + ' ' + t.orderCode + ' ' + t.title + ' ' + t.body).toLowerCase().includes(q));
  const byCat = {};
  Object.keys(CATEGORIES).forEach(k => { byCat[k] = list.filter(t => t.category === k); });
  return { tickets: list, byCategory: byCat, categories: CATEGORIES };
}, ['admin', 'atendente', 'designer']);

route('PATCH', /^\/api\/tickets\/([^/]+)$/, (ctx) => {
  const t = db.tickets.find(x => x.id === ctx.params.id || x.code === ctx.params.id);
  if (!t) return { status: 404, data: { error: 'Chamado não encontrado.' } };
  if (ctx.body.status) { t.status = ctx.body.status; t.updatedAt = new Date().toISOString(); }
  if (ctx.body.message) {
    t.messages.push({ at: new Date().toISOString(), by: ctx.session.name, role: ctx.session.role, text: ctx.body.message });
    t.updatedAt = new Date().toISOString();
  }
  if (ctx.body.urgent != null) { t.urgent = !!ctx.body.urgent; t.priority = t.urgent ? 'urgente' : 'normal'; }
  save();
  return { ticket: t };
}, ['admin', 'atendente', 'designer']);

/* ---- Notificações ---- */
route('GET', /^\/api\/notifications$/, (ctx) => {
  const role = ctx.query.role || ctx.session.role;
  const list = db.notifications.filter(n => n.to === role || n.to === 'all');
  return { notifications: list, unread: list.filter(n => !n.read).length };
}, ['admin', 'atendente', 'designer']);

route('POST', /^\/api\/notifications\/read$/, (ctx) => {
  const ids = ctx.body.ids || null;
  db.notifications.forEach(n => { if (!ids || ids.includes(n.id)) n.read = true; });
  save();
  return { ok: true };
}, ['admin', 'atendente', 'designer']);

/* ---- KPIs ---- */
route('GET', /^\/api\/kpis$/, () => {
  const week = isoWeek(new Date());
  const orders = db.orders;
  const money = orders.map(o => computeTotals(db.config, o.items).total);
  const paid = orders.reduce((a, o) => a + (o.payment.paid || 0), 0);
  return {
    week: { id: week, loadTotal: weekLoadTotal(week), limit: db.config.capacity.totalPerWeek, orders: orders.filter(o => o.weekId === week).length },
    orders: orders.length,
    pieces: orders.reduce((a, o) => a + (o.qtyTotal || 0), 0),
    revenue: Number(orders.reduce((a, o, i) => a + money[i], 0).toFixed(2)),
    paid: Number(paid.toFixed(2)),
    open: orders.filter(o => o.stage !== 'entregue').length,
    ready: orders.filter(o => o.stage === 'pronto').length,
    receiptsPending: db.orders.reduce((a, o) => a + o.payment.receipts.filter(r => r.status === 'em_analise').length, 0),
    urgentTickets: db.tickets.filter(t => t.urgent && t.status !== 'resolvido').length,
    artPending: orders.filter(o => ['pendente', 'em_analise', 'ajuste_solicitado'].includes(o.art.status || 'pendente')).length,
    byStage: STAGES.map(s => ({ stage: s.id, label: s.label, count: orders.filter(o => o.stage === s.id).length })),
    byTechnique: ['total', 'sublimacao_localizada', 'dtf'].map(t => ({
      technique: t, label: TECHNIQUE_LABEL[t],
      pieces: orders.reduce((a, o) => a + o.items.filter(i => i.technique === t).reduce((x, i) => x + itemQty(i), 0), 0),
      orders: orders.filter(o => o.items.some(i => i.technique === t)).length
    }))
  };
}, ['admin', 'atendente', 'designer']);

/* ---- Clientes ---- */
route('GET', /^\/api\/customers$/, (ctx) => {
  const q = (ctx.query.q || '').toLowerCase();
  let list = db.customers.slice();
  if (q) list = list.filter(c => (c.name + ' ' + c.phone + ' ' + (c.email || '') + ' ' + (c.doc || '')).toLowerCase().includes(q));
  return {
    customers: list.map(c => Object.assign({}, c, {
      orders: db.orders.filter(o => samePhone(o.customer.phone, c.phone)).length,
      spent: Number(db.orders.filter(o => samePhone(o.customer.phone, c.phone)).reduce((a, o) => a + computeTotals(db.config, o.items).total, 0).toFixed(2))
    })), total: list.length
  };
}, ['admin', 'atendente']);

route('POST', /^\/api\/customers$/, (ctx) => {
  const b = ctx.body;
  if (!String(b.name || '').trim() || !phoneDigits(b.phone)) return { status: 400, data: { error: 'Nome e telefone são obrigatórios.' } };
  const c = { id: rid('c_'), name: b.name, phone: phoneDigits(b.phone), email: b.email || '', doc: b.doc || '', city: b.city || '', note: b.note || '', createdAt: new Date().toISOString() };
  db.customers.push(c);
  log('cliente_criado', { name: c.name }, ctx.session.name);
  save();
  return { customer: c };
}, ['admin', 'atendente']);

route('PATCH', /^\/api\/customers\/([^/]+)$/, (ctx) => {
  const c = db.customers.find(x => x.id === ctx.params.id);
  if (!c) return { status: 404, data: { error: 'Cliente não encontrado.' } };
  ['name', 'email', 'doc', 'city', 'note'].forEach(k => { if (ctx.body[k] != null) c[k] = ctx.body[k]; });
  if (ctx.body.phone) {
    const old = c.phone; c.phone = phoneDigits(ctx.body.phone);
    db.orders.forEach(o => { if (samePhone(o.customer.phone, old)) o.customer.phone = c.phone; });
  }
  log('cliente_editado', { name: c.name }, ctx.session.name);
  save();
  return { customer: c };
}, ['admin', 'atendente']);

/* ---- Usuários ---- */
route('GET', /^\/api\/users$/, () => ({ users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active !== false })) }), ['admin']);

route('POST', /^\/api\/users$/, (ctx) => {
  const b = ctx.body;
  if (!b.name || !b.email || !b.password) return { status: 400, data: { error: 'Nome, e-mail e senha são obrigatórios.' } };
  if (!['admin', 'atendente', 'designer'].includes(b.role)) return { status: 400, data: { error: 'Perfil inválido.' } };
  const u = { id: rid('u_'), name: b.name, email: b.email.toLowerCase(), password: b.password, role: b.role, active: true };
  db.users.push(u);
  log('usuario_criado', { name: u.name, role: u.role }, ctx.session.name);
  save();
  return { user: { id: u.id, name: u.name, email: u.email, role: u.role, active: true } };
}, ['admin']);

route('PATCH', /^\/api\/users\/([^/]+)$/, (ctx) => {
  const u = db.users.find(x => x.id === ctx.params.id);
  if (!u) return { status: 404, data: { error: 'Usuário não encontrado.' } };
  ['name', 'email', 'password', 'role'].forEach(k => { if (ctx.body[k]) u[k] = ctx.body[k]; });
  if (ctx.body.active != null) u.active = !!ctx.body.active;
  save();
  return { user: { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active !== false } };
}, ['admin']);

/* ---- Configuração (admin) ---- */
route('PUT', /^\/api\/config$/, (ctx) => {
  const b = ctx.body || {};
  const cfg = db.config;
  if (b.brand) cfg.brand = Object.assign({}, cfg.brand, b.brand);
  if (b.maps) cfg.maps = Object.assign({}, cfg.maps, b.maps);
  if (b.capacity) cfg.capacity = Object.assign({}, cfg.capacity, b.capacity);
  if (b.rules) cfg.rules = Object.assign({}, cfg.rules, b.rules);
  if (b.leadTimes) cfg.leadTimes = Object.assign({}, cfg.leadTimes, b.leadTimes);
  if (b.batch) cfg.batch = Object.assign({}, cfg.batch, b.batch);
  if (b.prices) cfg.prices = Object.assign({}, cfg.prices, b.prices);
  if (b.totalAddons) cfg.totalAddons = b.totalAddons;
  if (b.extras) cfg.extras = b.extras;
  if (b.catalog) {
    if (b.catalog.categories) cfg.catalog.categories = b.catalog.categories;
    if (b.catalog.products) cfg.catalog.products = b.catalog.products;
  }
  if (b.sizes) cfg.sizes = Object.assign({}, cfg.sizes, b.sizes);
  if (b.faq) cfg.faq = b.faq;
  if (b.info) cfg.info = b.info;
  if (b.store) cfg.store = Object.assign({}, cfg.store, b.store);
  if (b.examples) cfg.examples = b.examples;
  if (b.integrations) cfg.integrations = Object.assign({}, cfg.integrations, b.integrations);
  log('config_atualizada', { secoes: Object.keys(b) }, ctx.session.name);
  saveNow();
  return { config: cfg };
}, ['admin']);

/* ---- Exportações / integrações ---- */
function csvEscape(v) { const s = String(v == null ? '' : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function ordersCsv(target) {
  const rows = [];
  if (target === 'olist') {
    rows.push(['Numero do Pedido', 'Data', 'Situacao', 'Cliente', 'CPF/CNPJ', 'E-mail', 'Telefone', 'SKU', 'Produto', 'Variacao', 'Quantidade', 'Valor Unitario', 'Valor Total', 'Forma de Pagamento', 'Observacoes'].join(';'));
    db.orders.forEach(o => o.items.forEach(i => {
      const qty = itemQty(i);
      const grade = Object.entries(i.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ');
      const pr = priceItem(db.config, i, {});
      const unit = pr.unit || 0;
      const prod = findProduct(db.config, i.productId);
      const variacao = i.mode === 'revenda' ? 'Revenda (liso)'
        : i.technique === 'total' ? `Dry Fit/Poliflex:${i.fabricId} Gola:${i.collar === 'v' ? 'V' : (i.collar ? 'Redonda' : '-')} Manga:${i.sleeve || '-'} ${prod.name || ''} ${grade}`
        : `Cor:${i.colorName || '-'} Estampa:${(i.prints || []).map(x => x.size).join('+') || '-'} ${grade || 'un'}`;
      rows.push(['D-STAMP-' + o.code, new Date(o.createdAt).toLocaleDateString('pt-BR'), o.stage, o.customer.name, o.customer.doc, o.customer.email, o.customer.phone,
        `${i.productId}-${i.mode === 'revenda' ? 'revenda' : i.technique}${i.fabricId ? '-' + i.fabricId : ''}`, prod.name || i.productId,
        variacao, qty,
        unit.toFixed(2).replace('.', ','), (pr.subtotal || 0).toFixed(2).replace('.', ','), o.payment.method, o.art.notes || ''].map(csvEscape).join(';'));
    }));
  } else {
    rows.push(['Pedido', 'Data', 'Cliente', 'Telefone', 'Referencia', 'Produto', 'Tecnica', 'Cor', 'Estampa', 'Gola/Manga', 'Grade', 'Qtd Total', 'Preco Unitario', 'Total', 'Status', 'Previsao', 'Comprovante'].join(';'));
    db.orders.forEach(o => o.items.forEach(i => {
      const qty = itemQty(i);
      const grade = Object.entries(i.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' ');
      const pr = priceItem(db.config, i, {});
      const unit = pr.unit || 0;
      const prod = findProduct(db.config, i.productId);
      const credited = ((o.payment.receipts || []).find(r => r.status === 'autorizado') || {}).seq || '-';
      rows.push([o.code, new Date(o.createdAt).toLocaleDateString('pt-BR'), o.customer.name, o.customer.phone, `${i.productId.toUpperCase()}${i.fabricId ? '-' + i.fabricId.toUpperCase() : ''}`,
        prod.name || i.productId, TECHNIQUE_LABEL[i.mode === 'revenda' ? 'revenda' : i.technique] || i.technique, i.colorName || '-',
        (i.prints || []).map(x => x.size).join('+') || (i.mode === 'revenda' ? 'liso' : '-'),
        i.technique === 'total' ? `${collarLabel(i)} / ${sleeveLabel(i)}` : '-',
        grade || String(qty) + ' un', qty,
        unit.toFixed(2).replace('.', ','), (pr.subtotal || 0).toFixed(2).replace('.', ','), o.stage,
        (orderView(o, 'equipe').predictedDate || '').slice(0, 10), credited].map(csvEscape).join(';'));
    }));
  }
  return '\ufeff' + rows.join('\r\n');
}
route('GET', /^\/api\/export\/(olist|sysloja)\.csv$/, (ctx) => {
  const target = ctx.params[0];
  const csv = ordersCsv(target);
  const res = ctx.res;
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dstamp-${target}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
  res.end(csv);
  return undefined;
}, ['admin', 'atendente']);

/* ---- Ficha técnica para o designer (informações separadas por tipo de peça) ---- */
route('GET', /^\/api\/designer\/sheet$/, (ctx) => {
  const byProduct = {};
  db.orders.filter(o => o.stage !== 'entregue' && o.items.some(i => i.mode !== 'revenda') && !(ctx.query.orderCode && o.code !== ctx.query.orderCode)).forEach(o => {
    o.items.forEach(i => {
      const prod = findProduct(db.config, i.productId);
      byProduct[i.productId] = byProduct[i.productId] || { productId: i.productId, name: prod.name || i.productId, category: prod.category || '', pieces: 0, rows: [] };
      const qty = itemQty(i);
      byProduct[i.productId].pieces += qty;
      byProduct[i.productId].rows.push({
        orderCode: o.code, customer: o.customer.name, technique: i.technique, fabric: i.fabricId, color: i.colorName || '-',
        collar: i.technique === 'total' ? (COLLAR_LABEL[i.collar] || '-') : '-', sleeve: sleeveLabel(i), modelagem: prod.name || i.productId,
        prints: (i.prints || []).map(x => x.size + (x.position ? ' (' + x.position + ')' : '')).join(' + ') || (i.mode === 'revenda' ? 'peça lisa (revenda)' : '-'),
        sizes: i.sizes, qty, artStatus: o.art.status,
        extras: i.extras || [], observation: i.observation || '', stage: o.stage,
        mainArt: o.art.main, finalArt: o.art.final, artNotes: o.art.notes
      });
    });
  });
  return { groups: Object.values(byProduct).sort((a, b) => b.pieces - a.pieces), generatedAt: new Date().toISOString() };
}, ['admin', 'atendente', 'designer']);

/* ---- Reset de desenvolvimento (disponível apenas com DSTAMP_DEV=1) ---- */
route('POST', /^\/api\/dev\/reset$/, () => {
  if (!process.env.DSTAMP_DEV) return { status: 403, data: { error: 'Reset disponível apenas em ambiente de desenvolvimento (DSTAMP_DEV=1).' } };
  db = buildSeed();
  saveNow();
  return { ok: true, orders: db.orders.length };
}, ['admin']);

/* ---- Logs ---- */
route('GET', /^\/api\/logs$/, () => ({ logs: db.logs.slice(0, 200) }), ['admin']);

/* ------------------------------ HTTP SERVER ------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = decodeURIComponent(url.pathname);

  if (!pathname.startsWith('/api/')) {
    let file = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html')
      : pathname.startsWith('/uploads/') ? path.join(UPLOAD_DIR, path.basename(pathname))
      : path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
    if (!file.startsWith(PUBLIC_DIR) && !file.startsWith(UPLOAD_DIR)) { res.writeHead(403); return res.end('forbidden'); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const idx = path.join(PUBLIC_DIR, 'index.html');
      if (pathname === '/' || !pathname.includes('.')) return sendFile(res, idx);
      res.writeHead(404); return res.end('not found');
    }
    return sendFile(res, file);
  }

  const query = Object.fromEntries(url.searchParams.entries());
  let body = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { body = await readBody(req); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  const session = teamAuth(req, null);

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    if (r.roles && r.roles.length) {
      const s = teamAuth(req, r.roles);
      if (!s) return send(res, 401, { error: 'Faça login na Área da equipe para continuar.' });
    }
    const params = {};
    m.slice(1).forEach((val, i) => { params[i] = val; if (r.pnames[i]) params[r.pnames[i]] = val; });
    const ctx = { req, res, query, body, params, session: teamAuth(req, null) };
    try {
      const out = r.handler(ctx);
      if (out === undefined) return; // handler respondeu direto (ex.: CSV)
      if (out && out.status) return send(res, out.status, out.data);
      return send(res, 200, out);
    } catch (e) {
      console.error('erro na rota', pathname, e);
      return send(res, 500, { error: 'Erro interno: ' + e.message });
    }
  }
  return send(res, 404, { error: 'Rota não encontrada: ' + req.method + ' ' + pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`D-Stamp MVP v${VERSION} rodando em http://${HOST}:${PORT}`);
  console.log(`Dados (banco + uploads): ${DATA_DIR}`);
  if (process.env.DSTAMP_DEV) console.log('AVISO: DSTAMP_DEV=1 ligado — a rota POST /api/dev/reset está ativa. Desligue em produção.');
  if (!process.env.DSTAMP_NO_DEMO)
    console.log('Painel da equipe (demonstração): admin@dstamp.com.br / admin123 · atendente@dstamp.com.br / atende123 · designer@dstamp.com.br / arte123');
});
