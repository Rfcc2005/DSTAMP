/* =========================================================================
   D-Stamp · núcleo compartilhado
   API · formatação · catálogo · preço · prazo · componentes · checklist
   Modelo: estampa total em destaque · localizada/brindes via WhatsApp
   ========================================================================= */
(function () {
  'use strict';

  const DS = window.DS = {};

  /* ------------------------------- SESSÃO ------------------------------- */
  DS.token = () => localStorage.getItem('dstamp_token') || '';
  DS.user = () => { try { return JSON.parse(localStorage.getItem('dstamp_user') || 'null'); } catch (e) { return null; } };
  DS.setSession = (token, user) => {
    if (token) localStorage.setItem('dstamp_token', token); else localStorage.removeItem('dstamp_token');
    if (user) localStorage.setItem('dstamp_user', JSON.stringify(user)); else localStorage.removeItem('dstamp_user');
  };

  /* -------------------------------- API -------------------------------- */
  DS.api = async function (path, opts) {
    const o = Object.assign({ method: 'GET' }, opts || {});
    o.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    if (DS.token()) o.headers.Authorization = 'Bearer ' + DS.token();
    if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    const r = await fetch('/api' + path, o);
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error(data.error || ('Erro ' + r.status)), { status: r.status, data });
    return data;
  };

  DS.boot = async function (refresh) {
    if (!DS._boot || refresh) DS._boot = await DS.api('/bootstrap');
    return DS._boot;
  };
  DS.catalog = () => (DS._boot ? DS._boot.catalog : {});
  DS.config = () => (DS._boot ? DS._boot.config : {});
  DS.store = () => (DS.catalog().store || {});
  DS.info = () => (DS.catalog().info || []);
  DS.resetBoot = () => { DS._boot = null; };

  /* ------------------------------ FORMATO ------------------------------ */
  DS.brl = n => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
  DS.money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  DS.dt = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  DS.dtLong = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : '—';
  DS.dtTime = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  DS.timeAgo = iso => {
    if (!iso) return '—';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h';
    return Math.floor(s / 86400) + ' d';
  };
  DS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DS.num = n => Number(n || 0).toLocaleString('pt-BR');
  DS.plural = (n, one, many) => Number(n) === 1 ? one : (many || one + 's');

  /* ------------------------- CATÁLOGO (MARKETPLACE) --------------------- */
  DS.products = () => ((DS.catalog().catalog || {}).products || []);
  DS.categories = () => ((DS.catalog().catalog || {}).categories || []);
  DS.product = id => DS.products().find(p => p.id === id) || {};
  DS.category = id => DS.categories().find(c => c.id === id) || {};
  DS.categoryName = id => DS.category(id).name || '';
  /* vitrine: o que o cliente monta sozinho no site (estampa total) */
  DS.storeProducts = () => DS.products().filter(p => !p.whatsappOnly);
  DS.waProducts = () => DS.products().filter(p => p.whatsappOnly);
  DS.productsOf = cat => DS.products().filter(p => p.category === cat);
  DS.colorsOf = prod => (prod.colors || []);
  DS.colorOf = (prod, colorId) => (prod.colors || []).find(c => c.id === colorId) || (prod.colors || [])[0] || null;
  DS.printSizesOf = (prod, technique) => (prod.printSizes || []).slice();
  DS.isTextil = prod => prod.kind === 'textil';
  DS.deltaOf = prod => Number((prod || {}).delta || 0);

  /* opções de gola e manga que existem para cada modelagem */
  DS.collarOptions = prod => (prod.collar || []).map(id => ({ id: id, label: DS.collarName(id), add: id === 'v' ? DS.addonPrice('gola_v') : 0 }));
  DS.sleeveOptions = prod => (prod.sleeve || []).map(id => ({ id: id, label: DS.sleeveName(id), add: id === 'longa' ? DS.addonPrice('manga_longa') : 0 }));
  DS.addonPrice = code => Number(((DS.catalog().totalAddons || []).find(a => a.code === code) || {}).price || 0);
  DS.collarName = id => (DS.catalog().collarLabels || {})[id] || ({ redonda: 'Gola redonda', v: 'Gola V' }[id] || '—');
  DS.sleeveName = id => (DS.catalog().sleeveLabels || {})[id] || ({ curta: 'Manga curta', longa: 'Manga longa', regata: 'Regata (sem manga)', nadador: 'Nadador (costas nadador)' }[id] || '—');

  /* Quantidade de um item: grade (vestuário) ou quantidade (objetos) */
  DS.itemQty = function (it) {
    const sizes = it && it.sizes ? Object.values(it.sizes).filter(v => Number(v) > 0) : [];
    if (sizes.length) return sizes.reduce((a, b) => a + Number(b || 0), 0);
    return Number((it && it.qty) || 0);
  };
  DS.pieces = DS.itemQty;
  DS.sizesFor = function (productId, technique, mode) {
    const prod = DS.product(productId);
    const map = prod.sizesKey || {};
    const key = mode === 'revenda' ? (map.total || map.localizada || null) : (map[technique] || map.localizada || map.total || null);
    return key ? ((DS.catalog().sizes || {})[key] || []) : [];
  };
  DS.gradeText = it => Object.entries((it && it.sizes) || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => k + ': ' + v).join(' · ');

  /* preço "a partir de" da vitrine */
  DS.fromPrice = function (prod) {
    if (prod.priceOnRequest) return null;
    const prices = DS.catalog().prices || {};
    if ((prod.techniques || []).includes('total')) {
      const tiers = (prices.total || {}).dryfit || [];
      const base = tiers.length ? tiers[0].price : 0;
      return Number(base) + DS.deltaOf(prod);
    }
    const blank = (prod.colors || []).length ? Math.min.apply(null, prod.colors.map(c => Number(c.price || 0))) : Number(prod.blank || 0);
    return blank || null;
  };

  /* ---------------------------- NOMES/BADGES ---------------------------- */
  DS.techName = id => ({
    total: 'Estampa total', sublimacao_localizada: 'Estampa localizada · sublimação',
    dtf: 'Estampa localizada · DTF', revenda: 'Revenda (peça lisa)'
  }[id] || id || '—');
  DS.techShort = id => ({ total: 'Estampa total', sublimacao_localizada: 'Sublimação', dtf: 'DTF', revenda: 'Revenda' }[id] || id || '—');
  DS.productName = id => DS.product(id).name || id;
  DS.fabricName = id => ({ dryfit: 'Dry Fit', poliflex: 'Poliflex', poliester: 'Poliéster' }[id] || id || '—');
  DS.fabricDesc = id => ({
    dryfit: 'Leve, esportivo, secagem rápida — times, abadá, praia e calor.',
    poliflex: 'Toque mais macio e encorpado — uniforme de empresa e uso diário.'
  }[id] || '');
  DS.golaLabel = it => (!it || it.technique !== 'total' || !it.collar) ? '—' : DS.collarName(it.collar);
  DS.mangaLabel = it => (!it || it.technique !== 'total' || !it.sleeve) ? '—' : DS.sleeveName(it.sleeve);
  DS.printsLabel = it => ((it && it.prints) || []).map(p => p.size + (p.position ? ' (' + p.position + ')' : '')).join(' + ') || '—';
  DS.colorLabel = it => (it && it.colorName) || (DS.colorOf(DS.product((it || {}).productId), (it || {}).colorId) || {}).name || '—';
  DS.stageName = id => { const s = (DS.catalog().stages || []).find(x => x.id === id); return s ? s.label : id; };

  DS.badge = (text, color) => `<span class="badge" style="--b:${color || '#8A93A6'}">${DS.esc(text)}</span>`;
  const STAGE_COLOR = { recebido: '#8A93A6', conferencia_arte: '#A78BFA', aguardando_aprovacao: '#FFB020', pagamento: '#38BDF8', fila: '#818CF8', estampa: '#22D3EE', acabamento: '#C8F169', pronto: '#3DD68C', entregue: '#3DD68C' };
  DS.stageBadge = o => DS.badge(DS.stageName(o.stage), STAGE_COLOR[o.stage]);
  const ART_LABEL = { pendente: 'Arte: não enviada', em_analise: 'Arte: em análise do designer', ajuste_solicitado: 'Arte: ajuste solicitado', aguardando_aprovacao: 'Arte: aguardando sua aprovação', aprovada: 'Arte aprovada', nao_se_aplica: 'Sem arte (revenda)' };
  const ART_COLOR = { pendente: '#8A93A6', em_analise: '#38BDF8', ajuste_solicitado: '#FFB020', aguardando_aprovacao: '#FFB020', aprovada: '#3DD68C', nao_se_aplica: '#8A93A6' };
  DS.artBadge = o => DS.badge(ART_LABEL[(o.art || {}).status || 'pendente'], ART_COLOR[(o.art || {}).status || 'pendente']);
  const PAY_LABEL = { aguardando_comprovante: 'Aguardando comprovante', em_analise: 'Comprovante em análise', autorizado: 'Pagamento autorizado', recusado: 'Comprovante recusado' };
  const PAY_COLOR = { aguardando_comprovante: '#8A93A6', em_analise: '#38BDF8', autorizado: '#3DD68C', recusado: '#FF5C7A' };
  DS.payBadge = o => DS.badge(PAY_LABEL[(o.payment || {}).status || 'aguardando_comprovante'], PAY_COLOR[(o.payment || {}).status || 'aguardando_comprovante']);
  DS.payMethodName = m => ({ pix_50: 'Entrada 50% no PIX', pix_total: 'PIX integral (5% de desconto)', cartao_3x: 'Cartão de crédito em até 3x', cartao: 'Cartão de crédito', dinheiro: 'Dinheiro na retirada', pix: 'PIX' }[m] || m);
  DS.modeBadge = it => it.mode === 'revenda' ? DS.badge('Revenda', '#A78BFA') : DS.badge(DS.techShort(it.technique), it.technique === 'total' ? '#7C5CFF' : it.technique === 'dtf' ? '#C8F169' : '#22D3EE');

  /* ------------------------------ WHATSAPP ------------------------------ */
  DS.waLink = (text, phone) => {
    const num = phone || (DS.config().brand || {}).whatsapp || '';
    return 'https://wa.me/' + String(num).replace(/\D/g, '') + '?text=' + encodeURIComponent(text || '');
  };
  DS.waBtn = (text, label, cls) => `<a class="btn ${cls || 'btn-wa'}" target="_blank" rel="noopener" href="${DS.waLink(text)}">${DS.icon('whats')}<span>${DS.esc(label || 'Falar no WhatsApp')}</span></a>`;
  DS.waOpen = (text, phone) => window.open(DS.waLink(text, phone), '_blank', 'noopener');
  DS.mapsLink = kind => {
    const q = encodeURIComponent((DS.config().maps || {}).query || 'D-Stamp Praia Grande');
    return kind === 'apple' ? 'https://maps.apple.com/?q=' + q : 'https://www.google.com/maps/search/?api=1&query=' + q;
  };

  /* Mensagem pronta de estampa localizada / brinde (orçamento no WhatsApp) */
  DS.waLocalizedText = function (o) {
    o = o || {};
    const b = (DS.config().brand || {});
    const lines = [
      'Olá, ' + (b.name || 'D-Stamp') + '! Quero um orçamento de ESTAMPA LOCALIZADA.',
      '',
      'Produto: ' + (o.product || 'a definir'),
      'Cor da peça: ' + (o.color || 'a definir'),
      'Técnica: ' + (o.technique === 'dtf' ? 'DTF têxtil (qualquer cor de peça)' : o.technique === 'sublimacao_localizada' ? 'Sublimação (peça clara)' : 'a definir / quero orientação'),
      'Tamanho da estampa: ' + (o.print || 'a definir') + (o.prints && o.prints.length ? ' (' + o.prints.join(' + ') + ')' : ''),
      'Posição: ' + (o.position || 'a definir'),
      'Quantidade: ' + (o.qty || 'a definir'),
      'Tenho a arte? ' + (o.hasArt ? 'Sim, vou enviar aqui' : 'Não — preciso de ajuda com a arte'),
      o.note ? 'Observação: ' + o.note : '',
      '',
      'Pode me confirmar valor e prazo?'
    ];
    return lines.filter(l => l !== undefined && l !== '').join('\n');
  };
  /* Resumo do pedido de estampa total para mandar no WhatsApp */
  DS.waOrderText = function (items, customer, extra) {
    const b = (DS.config().brand || {});
    const out = ['Olá, ' + (b.name || 'D-Stamp') + '! Montei meu pedido de ESTAMPA TOTAL no site e quero confirmar.', ''];
    (items || []).forEach((it, i) => {
      const line = DS.priceLine(it, items);
      out.push((i + 1) + ') ' + DS.productName(it.productId) + ' — ' + DS.fabricName(it.fabricId));
      if (it.collar) out.push('   Gola: ' + DS.collarName(it.collar));
      if (it.sleeve) out.push('   Manga: ' + DS.sleeveName(it.sleeve));
      const grade = DS.gradeText(it);
      out.push('   Quantidade: ' + DS.num(line.qty) + ' peça(s)' + (grade ? ' → ' + grade : ''));
      (it.extras || []).forEach(e => {
        const x = (DS.catalog().extras || []).find(v => v.code === e.code);
        if (x) out.push('   Extra: ' + x.label + (x.price != null ? ' (+' + DS.brl(x.price) + '/peça)' : ' (sob consulta)'));
      });
      if (it.observation) out.push('   Obs.: ' + it.observation);
      out.push('   Estimativa: ' + (line.onRequest ? 'sob consulta' : DS.money(line.subtotal)));
      out.push('');
    });
    const tot = DS.cartTotals(items || []);
    out.push('Total estimado: ' + DS.money(tot.total) + ' (' + DS.num(tot.qty) + ' peças)');
    out.push('Próximo lote: ' + DS.batchLabel() + ' · prazo ' + DS.leadTotalLabel());
    if (customer && customer.name) out.push('');
    if (customer && customer.name) out.push('Nome: ' + customer.name + (customer.phone ? ' · WhatsApp: ' + customer.phone : ''));
    if (extra) out.push('', extra);
    return out.join('\n');
  };
  DS.leadTotalLabel = () => { const l = (DS.catalog().leadTimes || {}).total || {}; return (l.min || 15) + ' a ' + (l.max || 20) + ' dias'; };

  /* -------------------------------- ÍCONES ------------------------------ */
  const ICONS = {
    whats: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-1.6-.5-3.6-2-4.8-4-.6-1-1-2.1-1-2.7 0-.6.4-1.4.8-1.7.2-.2.4-.2.6-.2h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3-.1.5.3.6 1.9 2.4 2.6 2.7.2.1.4 0 .5-.1l.5-.6c.1-.1.3-.2.5-.1l1.6.8c.2.1.3.3.3.5 0 .1 0 .7-.2 1Z"/>',
    map: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>',
    shirt: '<path d="M8 3 4 5.5 5.6 9 7 8.2V21h10V8.2l1.4.8L20 5.5 16 3l-2 2h-4L8 3Z"/>',
    tank: '<path d="M9 3 7 4v3l-2 2v12h14V9l-2-2V4l-2-1-1 2h-4L9 3Zm1.6 2h2.8l.7 1.4 1.6.8V19H8.3V9.6l1.6-.8L9.9 5Z"/>',
    mug: '<path d="M4 5h12v9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V5Zm12 2h2a3 3 0 0 1 0 6h-2V7ZM3 21h14v2H3v-2Z"/>',
    cart: '<path d="M6 6h15l-1.7 8.3a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 3H2v2h1.6l1.7 9.4A4 4 0 0 0 9.1 18h8.2a4 4 0 0 0 4-3.3L23 6H6Z"/><circle cx="9.5" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/>',
    check: '<path d="M9.6 17.2 4.4 12l1.4-1.4 3.8 3.8 8.6-8.6L19.6 7 9.6 17.2Z"/>',
    x: '<path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/>',
    chevron: '<path d="m9 5 7 7-7 7-1.6-1.6L12.8 12 7.4 6.6 9 5Z"/>',
    alert: '<path d="M12 2 1 21h22L12 2Zm1 14h-2v2h2v-2Zm0-7h-2v5h2V9Z"/>',
    clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h-4v-2h2V6h2v7Z"/>',
    upload: '<path d="M12 3 6 9h4v6h4V9h4l-6-6ZM4 19h16v2H4v-2Z"/>',
    download: '<path d="M12 15 6 9h4V3h4v6h4l-6 6ZM4 19h16v2H4v-2Z"/>',
    note: '<path d="M5 3h9l5 5v13H5V3Zm8 1.5V9h4.5L13 4.5ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Zm0-8h4v2H7V8Z"/>',
    ticket: '<path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"/>',
    money: '<path d="M2 5h20v14H2V5Zm10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 7v2h2V7H4Zm14 0v2h2V7h-2ZM4 15v2h2v-2H4Zm14 0v2h2v-2h-2Z"/>',
    search: '<path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/>',
    plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/>',
    minus: '<path d="M5 11h14v2H5v-2Z"/>',
    edit: '<path d="M4 20h4l10.5-10.5-4-4L4 16v4Zm14.7-13.3 1.6-1.6a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.4 3.4Z"/>',
    printer: '<path d="M6 3h12v4H6V3Zm-2 6h16v7h-4v5H8v-5H4V9Zm6 6h4v4h-4v-4Z"/>',
    palette: '<path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.9C22 6 17.5 2 12 2Zm-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
    user: '<path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2.2 8 5v1H4v-1c0-2.8 3.6-5 8-5Z"/>',
    bell: '<path d="M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6Zm0 20a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Z"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5Zm0 8.5L2 15l10 5 10-5-10-4.5Z"/>',
    store: '<path d="M3 4h18l1 5a3 3 0 0 1-5.5 1.9A3 3 0 0 1 12 12a3 3 0 0 1-4.5-1.1A3 3 0 0 1 2 9L3 4Zm1 9.2A5 5 0 0 0 6.6 15H7v6h10v-6h.4a5 5 0 0 0 2.6-1.8V22H4V13.2Z"/>',
    ruler: '<path d="M3 8h18v8H3V8Zm3 2v2h2v-2H6Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z"/>',
    star: '<path d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.8L12 2Z"/>',
    box: '<path d="M3 7 12 3l9 4v10l-9 4-9-4V7Zm9 2.2L6 6.8v1.6l6 2.6 6-2.6V6.8l-6 2.4Z"/>',
    truck: '<path d="M2 6h12v9H2V6Zm13 2h4l3 3v4h-7V8ZM5.5 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm12 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
    grid: '<path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"/>',
    info: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/>',
    heart: '<path d="M12 21S3 14.7 3 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 9 2.9C21 14.7 12 21 12 21Z"/>'
  };
  DS.icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  DS.iconNames = () => Object.keys(ICONS);

  /* -------------------------------- UI -------------------------------- */
  DS.toast = function (msg, type) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.innerHTML = DS.icon(type === 'err' || type === 'warn' ? 'alert' : 'check') + '<div>' + DS.esc(msg) + '</div>';
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
  };
  DS.toastErr = e => DS.toast((e && e.message) || 'Erro inesperado', 'err');

  DS.modal = function (title, bodyHtml, opts) {
    opts = opts || {};
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${DS.esc(title)}</h3><button class="icon-btn" data-close title="Fechar" aria-label="Fechar">${DS.icon('x')}</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
    </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });
    return { el: back, dialog: back.querySelector('.modal'), close };
  };

  DS.confirm = msg => new Promise(resolve => {
    const m = DS.modal('Confirmar', `<p>${DS.esc(msg)}</p>`, {
      footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn" data-yes>Confirmar</button>'
    });
    m.el.addEventListener('click', e => {
      if (e.target.closest('[data-yes]')) { m.close(); resolve(true); }
      if (e.target.closest('[data-close]')) { m.close(); resolve(false); }
    });
  });

  DS.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => DS.toast('Copiado para a área de transferência')).catch(() => DS.toast('Não foi possível copiar automaticamente', 'warn'));
    } else DS.toast('Copie manualmente o texto', 'warn');
  };

  DS.fileToDataUrl = file => new Promise((resolve, reject) => {
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Arquivo maior que 12MB. Envie um arquivo menor.'));
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name, dataUrl: fr.result, size: file.size });
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  DS.printBlock = function (title, html) {
    return DS.modal(title, `<div class="print-area">${html}</div>`, {
      footer: `<button class="btn ghost" data-close>Fechar</button><button class="btn" onclick="window.print()">${DS.icon('printer')}<span>Imprimir</span></button>`
    });
  };

  /* barra fixa no rodapé (celular) */
  DS.dock = function (html) {
    const d = document.getElementById('dock');
    if (!d) return;
    d.innerHTML = html || '';
    document.body.style.setProperty('--dock-h', html ? (d.offsetHeight + 'px') : '0px');
  };
  DS.clearDock = () => DS.dock('');
  DS.scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  /* tabela simples a partir de {head, rows} */
  DS.tableHtml = function (t, cls) {
    if (!t || !(t.rows || []).length) return '';
    return `<div class="table-wrap ${cls || ''}"><table>
      ${t.head ? `<thead><tr>${t.head.map(h => `<th>${DS.esc(h)}</th>`).join('')}</tr></thead>` : ''}
      <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${DS.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  };

  /* bloco do guia explicativo */
  DS.infoBlock = function (b) {
    return `<article class="card info-block" id="guia-${DS.esc(b.id)}">
      <span class="eyebrow">${DS.esc(b.group || '')}</span>
      <h3>${DS.icon(b.icon || 'info')}<span>${DS.esc(b.title)}</span></h3>
      ${(b.tags || []).length ? `<div class="info-tags">${b.tags.map(t => `<span>#${DS.esc(t)}</span>`).join('')}</div>` : ''}
      ${b.lead ? `<p class="muted">${DS.esc(b.lead)}</p>` : ''}
      ${(b.steps || []).length ? `<ol class="steps-num">${b.steps.map(s => `<li>${DS.esc(s)}</li>`).join('')}</ol>` : ''}
      ${(b.bullets || []).length ? `<ul class="bullets">${b.bullets.map(x => `<li>${DS.icon('check')}<span>${DS.esc(x)}</span></li>`).join('')}</ul>` : ''}
      ${b.table ? DS.tableHtml(b.table) : ''}
      ${b.note ? `<div class="alert info mt12">${DS.icon('info')}<span>${DS.esc(b.note)}</span></div>` : ''}
    </article>`;
  };

  /* --------------------- REGRAS TÉCNICAS (avisos) ---------------------- */
  DS.validateItem = function (it) {
    const errs = [], warns = [], infos = [];
    const prod = DS.product(it.productId);
    if (!prod) return null;   /* item ainda sem modelagem (etapa 1 do assistente) */
    const qty = DS.itemQty(it);
    const color = DS.colorOf(prod, it.colorId);
    const techs = prod.techniques || [];

    if (it.mode !== 'revenda') {
      if (techs.length && !techs.includes(it.technique))
        errs.push(`${prod.name || 'Este produto'} não é produzido com ${DS.techName(it.technique)}.`);
      if (it.technique === 'total' && !['dryfit', 'poliflex'].includes(it.fabricId))
        errs.push('Estampa total só roda em Dry Fit ou Poliflex.');
      if (it.technique === 'total' && (prod.collar || []).length && !(prod.collar || []).includes(it.collar))
        warns.push(`${prod.name || 'Esta modelagem'} não tem ${DS.collarName(it.collar)}.`);
      if (it.technique === 'total' && (prod.sleeve || []).length && !(prod.sleeve || []).includes(it.sleeve))
        warns.push(`${prod.name || 'Esta modelagem'} não tem ${DS.sleeveName(it.sleeve)}.`);
      if (it.technique === 'sublimacao_localizada' && color && color.light === false)
        errs.push(`Sublimação não pega em peça ${String(color.name).toLowerCase()}. Use DTF Têxtil (mesma estampa, qualquer cor).`);
      if (it.technique === 'sublimacao_localizada' && color && color.light)
        infos.push('Peça clara: onde a arte tiver branco, aparece a cor da camiseta.');
      if ((prod.printSizes || []).length && it.technique !== 'total' && !(it.prints || []).length)
        warns.push('Escolha o tamanho da estampa (10x10, A4 ou A3) para calcular o valor.');
      if (prod.whatsappOnly) infos.push('Este item é orçado pelo WhatsApp — o site mostra valores de referência.');
      if (prod.priceOnRequest) infos.push('Valor deste item sob consulta — o atendente confirma pelo WhatsApp.');
    }
    if (qty <= 0) warns.push('Informe a quantidade (fazemos a partir de 1 peça — não existe mínimo).');
    return { errors: errs, warns: warns, infos: infos, qty: qty };
  };

  DS.alertBox = (errors, warns, infos) => {
    let h = '';
    (errors || []).forEach(e => { h += `<div class="alert err">${DS.icon('alert')}<span>${DS.esc(e)}</span></div>`; });
    (warns || []).forEach(w => { h += `<div class="alert warn">${DS.icon('alert')}<span>${DS.esc(w)}</span></div>`; });
    (infos || []).forEach(i => { h += `<div class="alert info">${DS.icon('note')}<span>${DS.esc(i)}</span></div>`; });
    return h;
  };

  /* --------------------------- PREÇO / PRAZO --------------------------- */
  /* Espelho local do cálculo do servidor (resposta imediata na tela).
     allItems = itens do pedido, para a faixa de preço por tecido da estampa total. */
  DS.priceLine = function (it, allItems) {
    const c = DS.catalog();
    const prices = c.prices || {};
    const prod = DS.product(it.productId);
    const qty = DS.itemQty(it);
    const list = (allItems || []).filter(x => x.mode !== 'revenda' && x.technique === 'total' && x.fabricId === it.fabricId);
    const agg = list.length ? list.reduce((a, x) => a + DS.itemQty(x), 0) : qty;
    const extrasDef = (c.extras || []);
    const extras = (it.extras || []).map(e => extrasDef.find(x => x.code === e.code)).filter(Boolean);
    const out = { qty: qty, unit: 0, surcharge: 0, delta: DS.deltaOf(prod), extrasSum: 0, subtotal: 0, breakdown: [], sizePrices: {}, onRequest: !!prod.priceOnRequest, extras: extras, agg: agg };

    if (it.unitPriceOverride != null && Number(it.unitPriceOverride) > 0) {
      out.unit = Number(it.unitPriceOverride);
      out.extrasSum = Number((extras.reduce((a, e) => a + (e.price || 0), 0) * qty).toFixed(2));
      out.subtotal = Number((out.unit * qty + out.extrasSum).toFixed(2));
      out.breakdown.push({ label: 'Preço ajustado manualmente', value: out.unit, unit: true });
      return out;
    }

    const blank = prod.priceOnRequest ? null
      : (prod.colors || []).length ? ((DS.colorOf(prod, it.colorId) || {}).price != null ? DS.colorOf(prod, it.colorId).price : null)
      : (prod.blank != null ? prod.blank : null);

    if (it.mode === 'revenda') {
      if (blank == null) return out;
      out.unit = Number(Number(blank).toFixed(2));
      out.breakdown.push({ label: 'Peça lisa (revenda)' + (DS.colorOf(prod, it.colorId) ? ' — ' + DS.colorOf(prod, it.colorId).name : ''), value: out.unit, unit: true });
    } else if (it.technique === 'total') {
      const tiers = ((prices.total || {})[it.fabricId] || []).slice().sort((a, b) => (a.upTo == null ? 1e9 : a.upTo) - (b.upTo == null ? 1e9 : b.upTo));
      const tier = tiers.find(x => x.upTo == null || agg <= x.upTo) || tiers[tiers.length - 1] || { price: 0 };
      const addons = (c.totalAddons || []).filter(a => (a.code === 'gola_v' && it.collar === 'v') || (a.code === 'manga_longa' && it.sleeve === 'longa'));
      const addonsSum = addons.reduce((a, x) => a + (x.price || 0), 0);
      const base = Number(tier.price || 0);
      out.unit = Number((base + addonsSum + out.delta).toFixed(2));
      out.breakdown.push({ label: 'Peça ' + DS.fabricName(it.fabricId) + ' — ' + (agg > 10 ? 'acima de 10 peças' : 'até 10 peças'), value: base, unit: true });
      if (out.delta) out.breakdown.push({ label: 'Adicional da modelagem (' + (prod.name || 'peça') + ')', value: out.delta, unit: true });
      addons.forEach(a => out.breakdown.push({ label: a.label, value: a.price, unit: true }));
      const ord = prices.sizeOrder || [];
      const gg = ord.indexOf(prices.sizeFallback || 'GG');
      const step = Number(prices.sizeSurchargeAboveGG) || 0;
      Object.entries(it.sizes || {}).forEach(([sz, q]) => {
        const idx = ord.indexOf(sz);
        if (gg > -1 && idx > gg) out.surcharge += (idx - gg) * step * Number(q || 0);
      });
      out.surcharge = Number(out.surcharge.toFixed(2));
      if (out.surcharge > 0) out.breakdown.push({ label: 'Tamanhos acima do GG (total do item)', value: out.surcharge, unit: false });
      Object.keys(it.sizes || {}).concat(DS.sizesFor(it.productId, it.technique, it.mode)).forEach(sz => {
        const idx = ord.indexOf(sz);
        const add = (gg > -1 && idx > gg) ? (idx - gg) * step : 0;
        out.sizePrices[sz] = Number((base + addonsSum + out.delta + add).toFixed(2));
      });
    } else {
      if (blank == null) return out;
      const key = it.technique === 'dtf' ? 'dtf' : 'sublimacao';
      const table = (prices.print || {})[key] || {};
      const print = (it.prints || []).reduce((a, p) => a + (Number(table[p.size]) || 0), 0);
      out.unit = Number((Number(blank) + print).toFixed(2));
      out.breakdown.push({ label: 'Peça lisa' + (DS.colorOf(prod, it.colorId) ? ' (' + DS.colorOf(prod, it.colorId).name + ')' : ''), value: Number(blank), unit: true });
      out.breakdown.push({ label: 'Estampa ' + (it.technique === 'dtf' ? 'DTF' : 'sublimação') + ' ' + ((it.prints || []).map(p => p.size).join(' + ') || '—'), value: Number(print.toFixed(2)), unit: true });
    }

    out.extrasSum = Number((extras.reduce((a, e) => a + (e.price || 0), 0) * qty).toFixed(2));
    out.subtotal = Number((out.unit * qty + out.surcharge + out.extrasSum).toFixed(2));
    return out;
  };
  DS.unitPrice = function (it, allItems) { return DS.priceLine(it, allItems).unit; };

  /* totais de um conjunto de itens (carrinho / checklist) */
  DS.cartTotals = function (items) {
    const lines = (items || []).map(it => DS.priceLine(it, items));
    const total = Number(lines.reduce((a, l) => a + (l.subtotal || 0), 0).toFixed(2));
    const qty = lines.reduce((a, l) => a + (l.qty || 0), 0);
    const pixPct = Number((DS.config().rules || {}).pixDiscountPercent || 0);
    const depositPct = Number((DS.config().rules || {}).depositPercent || 50);
    return {
      lines: lines, total: total, qty: qty,
      pixTotal: Number((total * (1 - pixPct / 100)).toFixed(2)),
      deposit: Number((total * depositPct / 100).toFixed(2)),
      installment: Number((total / 3).toFixed(2)),
      onRequest: lines.some(l => l.onRequest)
    };
  };

  DS.leadOf = function (it) {
    const c = DS.catalog();
    if (it.mode === 'revenda') return c.leadTimes.revenda || { min: 1, max: 2 };
    return (c.leadTimes || {})[it.technique] || { min: 5, max: 7 };
  };
  DS.leadLabelOf = function (it) {
    const l = DS.leadOf(it);
    return it.mode === 'revenda' ? 'Pronta entrega / separação em ' + l.min + ' a ' + l.max + ' dias'
      : it.technique === 'total' ? 'Lote de sábado · ' + l.min + ' a ' + l.max + ' dias'
      : l.min + ' a ' + l.max + ' dias';
  };
  DS.leadDays = function (it) { return DS.leadOf(it).max; };
  DS.batchLabel = function () {
    const b = DS.catalog().batch || {};
    return b.nextDate ? new Date(b.nextDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—';
  };
  DS.batchShort = function () {
    const b = DS.catalog().batch || {};
    return b.nextDate ? new Date(b.nextDate).toLocaleDateString('pt-BR') : '—';
  };
  DS.week = () => (DS._boot ? DS._boot.week : { level: 'aberto', label: 'Lote aberto' });

  /* ---- Semana/lote para o CLIENTE: nível + data, nunca o contador de peças ---- */
  DS.weekLevel = function () { const w = DS.week() || {}; return w.level || 'aberto'; };
  DS.weekLabel = function () {
    const w = DS.week() || {};
    if (w.label) return w.label;
    const l = DS.weekLevel();
    return l === 'fechado' ? 'Lote completo' : l === 'ultimas' ? 'Últimas vagas' : 'Lote aberto';
  };
  DS.weekPill = function (level) {
    const l = level || DS.weekLevel();
    const cls = l === 'aberto' ? 'lime' : l === 'ultimas' ? 'cyan' : '';
    const label = l === 'fechado' ? 'Lote fechado' : l === 'ultimas' ? 'Últimas vagas' : 'Lote aberto';
    return `<span class="pill ${cls}">${DS.esc(label)}</span>`;
  };
  /* quantos dias faltam para uma data de lote */
  DS.daysTo = function (date) {
    if (!date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((d - today) / 864e5));
  };
  DS.batchDate = function (offset) {
    const b = DS.catalog().batch || {};
    if (!b.nextDate) return null;
    return new Date(new Date(b.nextDate).getTime() + (offset || 0) * 7 * 864e5);
  };
  DS.leadNote = function () {
    return 'Em lote cheio, o prazo pode passar um pouco de 20 dias — a data prevista do seu pedido aparece no resumo.';
  };
  DS.announcements = function () {
    return ((DS.config().brand || {}).announcements || []).filter(a => a && a.active && (a.text || '').trim());
  };
  /* level: 'aberto' | 'ultimas' | 'fechado' (o servidor já considera o pedido atual).
     Para o CLIENTE mostramos apenas a data disponível, o status e a urgência. */
  DS.capacityCard = function (level, opts) {
    opts = opts || {};
    const lvl = level || DS.weekLevel();
    const fechado = lvl === 'fechado';
    const date = DS.batchDate(fechado ? 1 : 0);
    const dateLabel = date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—';
    const days = DS.daysTo(date);
    const head = fechado
      ? `A data anterior fechou. Próxima data disponível: <b>${DS.esc(dateLabel)}</b>.`
      : `Próxima data disponível: <b>${DS.esc(dateLabel)}</b>.`;
    const urg = fechado ? '' : `<div class="muted small mt4">${days === 0 ? 'O lote fecha <b>hoje</b>.' : 'Faltam <b>' + days + '</b> ' + (days === 1 ? 'dia' : 'dias') + ' para esse lote.'}</div>`;
    const wa = opts.wa === false ? '' : DS.waBtn(
      'Olá! Quero confirmar a data disponível do próximo lote de estampa total.', 'Confirmar data no WhatsApp', 'sm ghost');
    return `<div class="cap lvl-${lvl}">
      <div class="row between small">${DS.weekPill(lvl)}<span class="muted">estampa total</span></div>
      <b class="cap-tt mt8">${head}</b>
      ${urg}
      <span class="small muted">Prazo de ${DS.esc(DS.leadTotalLabel())} após a arte aprovada e o pagamento. ${DS.esc(DS.leadNote())}</span>
      ${fechado ? `<div class="btn-row mt8">${wa}</div>` : ''}
    </div>`;
  };

  /* ------------------------- GRADE DE TAMANHOS ------------------------- */
  DS.sizeGridHtml = function (it, opts) {
    opts = opts || {};
    const sizes = DS.sizesFor(it.productId, it.technique || 'total', it.mode || 'estampa');
    const line = DS.priceLine(it, opts.allItems || [it]);
    const sp = line.sizePrices || {};
    return `<div class="grid-sizes">${sizes.map(sz => {
      const v = Number((it.sizes || {})[sz] || 0);
      const price = sp[sz];
      return `<label class="size-cell ${v > 0 ? 'filled' : ''}">
        <span>${DS.esc(sz)}${price != null ? `<i>${DS.money(price)}</i>` : ''}</span>
        <input data-size="${DS.esc(sz)}" inputmode="numeric" min="0" value="${v || ''}" placeholder="0"
          aria-label="Quantidade no tamanho ${DS.esc(sz)}">
      </label>`;
    }).join('')}</div>`;
  };
  DS.bindSizeGrid = function (root, it, onChange) {
    root.querySelectorAll('[data-size]').forEach(inp => {
      inp.addEventListener('input', () => {
        const sz = inp.dataset.size;
        const v = Math.max(0, parseInt(String(inp.value).replace(/\D/g, ''), 10) || 0);
        if (v) it.sizes[sz] = v; else delete it.sizes[sz];
        it.qty = DS.itemQty(it);
        const cell = inp.closest('.size-cell'); if (cell) cell.classList.toggle('filled', v > 0);
        if (onChange) onChange();
      });
    });
    root.querySelectorAll('[data-qty]').forEach(inp => {
      inp.addEventListener('input', () => {
        it.qty = Math.max(0, parseInt(String(inp.value).replace(/\D/g, ''), 10) || 0);
        const sp = inp.closest('.qty-line'); if (sp) { const n = sp.querySelector('.stepper-btn span'); if (n) n.textContent = DS.num(it.qty); }
        if (onChange) onChange();
      });
    });
    root.querySelectorAll('[data-qstep]').forEach(b => b.addEventListener('click', () => {
      it.qty = Math.max(0, (it.qty || 0) + Number(b.dataset.qstep));
      const inp = root.querySelector('[data-qty]'); if (inp) inp.value = it.qty || '';
      const n = root.querySelector('.stepper-btn span'); if (n) n.textContent = DS.num(it.qty);
      if (onChange) onChange();
    }));
  };
  DS.qtyHtml = function (it) {
    return `<div class="qty-line">
      <label class="qty-box block">Quantidade<input data-qty inputmode="numeric" min="1" value="${it.qty || ''}" placeholder="1"></label>
      <div class="stepper-btn" role="group" aria-label="Ajustar quantidade">
        <button type="button" data-qstep="-1" aria-label="Diminuir um">−</button>
        <span>${DS.num(it.qty || 0)}</span>
        <button type="button" data-qstep="1" aria-label="Aumentar um">+</button>
      </div>
      <span class="muted small">sem quantidade mínima</span>
    </div>`;
  };

  /* -------------------- ETAPAS DO PEDIDO (acompanhamento) ------------------- */
  DS.stepper = function (o) {
    const stages = (o && o.stages) || DS.catalog().stages || [];
    const cur = (o && o.stage) || '';
    const idx = stages.findIndex(s => s.id === cur);
    const all = cur === 'entregue';
    return `<div class="stepper">${stages.map((s, i) => {
      const done = all || i < idx;
      const current = !all && i === idx;
      return `<div class="step ${done ? 'done' : ''} ${current ? 'current' : ''}">
        <span class="dot">${done ? DS.icon('check', 'sm') : i + 1}</span>
        <span><span class="lbl">${DS.esc(s.label)}</span>${s.desc ? `<span class="desc">${DS.esc(s.desc)}</span>` : ''}</span>
      </div>`;
    }).join('')}</div>`;
  };

  /* ---------------------- EDITOR DE ITEM (modal) ---------------------- */
  /* DS.openItemEditor({ item, allItems, canPrice, title, onSave }) */
  DS.openItemEditor = function (o) {
    o = o || {};
    const base = { productId: '', technique: 'total', mode: 'estampa', fabricId: 'dryfit', collar: '', sleeve: '', colorId: '', sizes: {}, qty: 0, extras: [], prints: [], observation: '' };
    let it = Object.assign({}, base, JSON.parse(JSON.stringify(o.item || {})));
    it.sizes = Object.assign({}, it.sizes); it.extras = (it.extras || []).slice(); it.prints = (it.prints || []).slice();
    const prods = o.canPrice ? DS.products() : DS.storeProducts();
    const m = DS.modal(o.title || 'Editar item',
      `<div id="ei-body"></div>
       <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn lime" id="ei-save">${DS.icon('check')}<span>Salvar item</span></button></div>`,
      { wide: true });
    const body = m.el.querySelector('#ei-body');

    function draw() {
      const p = DS.product(it.productId);
      const sizes = DS.sizesFor(it.productId, it.technique, it.mode);
      const line = DS.priceLine(it, o.allItems || [it]);
      body.innerHTML = `
        <div class="form-grid">
          <label class="block">Modelagem / produto
            <select data-ei="prod">${prods.map(x => `<option value="${x.id}" ${x.id === it.productId ? 'selected' : ''}>${DS.esc(x.name)}</option>`).join('')}</select></label>
          <label class="block">Tipo de pedido
            <select data-ei="mode">
              <option value="estampa" ${it.mode !== 'revenda' ? 'selected' : ''}>Estampado</option>
              <option value="revenda" ${it.mode === 'revenda' ? 'selected' : ''}>Revenda (liso)</option>
            </select></label>
          ${it.mode !== 'revenda' && (p.techniques || []).length > 1 ? `<label class="block">Técnica
            <select data-ei="tech">${(p.techniques || []).map(t => `<option value="${t}" ${t === it.technique ? 'selected' : ''}>${DS.esc(DS.techName(t))}</option>`).join('')}</select></label>` : ''}
          ${it.mode !== 'revenda' && DS.isTextil(p) ? `<label class="block">Tecido
            <select data-ei="fabric"><option value="dryfit" ${it.fabricId === 'dryfit' ? 'selected' : ''}>Dry Fit</option><option value="poliflex" ${it.fabricId === 'poliflex' ? 'selected' : ''}>Poliflex</option></select></label>` : ''}
          ${it.mode !== 'revenda' && (p.collar || []).length ? `<label class="block">Gola
            <select data-ei="collar">${(p.collar || []).map(c => `<option value="${c}" ${c === it.collar ? 'selected' : ''}>${DS.esc(DS.collarName(c))}</option>`).join('')}</select></label>` : ''}
          ${it.mode !== 'revenda' && (p.sleeve || []).length ? `<label class="block">Manga
            <select data-ei="sleeve">${(p.sleeve || []).map(sl => `<option value="${sl}" ${sl === it.sleeve ? 'selected' : ''}>${DS.esc(DS.sleeveName(sl))}</option>`).join('')}</select></label>` : ''}
          ${(p.colors || []).length ? `<label class="block">Cor da peça
            <select data-ei="color">${(p.colors || []).map(c => `<option value="${c.id}" ${c.id === it.colorId ? 'selected' : ''}>${DS.esc(c.name)}</option>`).join('')}</select></label>` : ''}
        </div>
        ${it.mode !== 'revenda' && it.technique !== 'total' ? `
          <div class="mt12"><b class="small">Estampas (tamanho e posição)</b>
          ${(it.prints.length ? it.prints : [{ size: 'A4', position: 'frente' }]).map((pr, i) => `
            <div class="row gap mt8">
              <select data-ei-psize="${i}">${DS.printSizesOf(it.technique).map(sz => `<option value="${sz}" ${sz === pr.size ? 'selected' : ''}>${DS.esc(sz)}</option>`).join('')}</select>
              <input class="grow" data-ei-ppos="${i}" value="${DS.esc(pr.position || '')}" placeholder="posição (frente, costas, peito…)">
              <button class="icon-btn danger" data-ei-pdel="${i}" aria-label="Remover estampa">${DS.icon('x', 'sm')}</button>
            </div>`).join('')}
          <button class="btn ghost sm mt8" data-ei-padd>${DS.icon('plus', 'sm')}<span>Outra estampa</span></button></div>` : ''}
        <div class="mt12"><b class="small">${sizes.length && it.mode !== 'revenda' ? 'Grade de tamanhos' : 'Quantidade'}</b>
          ${sizes.length && it.mode !== 'revenda' ? DS.sizeGridHtml(it, { allItems: o.allItems || [it] }) : DS.qtyHtml(it)}</div>
        <div class="mt12"><b class="small">Extras</b>
          <div class="opts mt8">${(DS.catalog().extras || []).filter(x => !x.techniques || x.techniques.includes(it.technique)).map(x => `
            <label class="opt ${it.extras.some(e => (e.code || e) === x.code) ? 'on' : ''}"><input type="checkbox" data-ei-extra="${x.code}" ${it.extras.some(e => (e.code || e) === x.code) ? 'checked' : ''}>
            <b>${DS.esc(x.label)}</b><span class="add">+ ${DS.money(x.price)} por ${DS.esc(x.unit || 'peça')}</span></label>`).join('') || '<span class="muted small">Sem extras disponíveis para esta técnica.</span>'}</div></div>
        <label class="block mt12">Observação para a equipe<textarea data-ei-obs rows="2">${DS.esc(it.observation || '')}</textarea></label>
        ${o.canPrice ? `<div class="alert info mt12">${DS.icon('money')}<span>Unitário ${DS.money(line.unit)} · subtotal ${DS.money(line.subtotal)}</span></div>` : ''}`;
      bind();
    }
    function bind() {
      const q = s2 => body.querySelector(s2);
      const on = (sel, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener('change', fn));
      on('[data-ei="prod"]', e => {
        const p2 = DS.product(e.target.value);
        it.productId = p2.id; it.sizes = {}; it.qty = 0;
        it.collar = (p2.collar || [])[0] || ''; it.sleeve = (p2.sleeve || [])[0] || '';
        it.colorId = ((p2.colors || [])[0] || {}).id || '';
        it.technique = (p2.techniques || ['total'])[0];
        draw();
      });
      on('[data-ei="mode"]', e => { it.mode = e.target.value; it.sizes = {}; it.qty = 0; draw(); });
      on('[data-ei="tech"]', e => { it.technique = e.target.value; draw(); });
      on('[data-ei="fabric"]', e => { it.fabricId = e.target.value; draw(); });
      on('[data-ei="collar"]', e => { it.collar = e.target.value; draw(); });
      on('[data-ei="sleeve"]', e => { it.sleeve = e.target.value; draw(); });
      on('[data-ei="color"]', e => { it.colorId = e.target.value; draw(); });
      on('[data-ei-extra]', e => {
        const code = e.target.dataset.eiExtra;
        if (e.target.checked) { if (!it.extras.some(x => (x.code || x) === code)) it.extras.push({ code: code, qty: null }); }
        else it.extras = it.extras.filter(x => (x.code || x) !== code);
        draw();
      });
      body.querySelectorAll('[data-ei-psize]').forEach(el => el.addEventListener('change', () => { it.prints[Number(el.dataset.eiPsize)].size = el.value; draw(); }));
      body.querySelectorAll('[data-ei-ppos]').forEach(el => el.addEventListener('input', () => { if (!it.prints[Number(el.dataset.eiPpos)]) it.prints[Number(el.dataset.eiPpos)] = { size: 'A4', position: '' }; it.prints[Number(el.dataset.eiPpos)].position = el.value; }));
      body.querySelectorAll('[data-ei-pdel]').forEach(el => el.addEventListener('click', () => { it.prints.splice(Number(el.dataset.eiPdel), 1); draw(); }));
      const padd = q('[data-ei-padd]'); if (padd) padd.addEventListener('click', () => { it.prints.push({ size: '10x10', position: '' }); draw(); });
      DS.bindSizeGrid(body, it, () => { const lb = body.querySelector('.stepper-btn span'); if (lb && !DS.sizesFor(it.productId, it.technique, it.mode).length) lb.textContent = DS.num(it.qty); });
      const obs = q('[data-ei-obs]'); if (obs) obs.addEventListener('input', () => { it.observation = obs.value; });
    }
    draw();
    m.el.querySelector('#ei-save').addEventListener('click', () => {
      if (!it.productId) return DS.toast('Escolha a modelagem do item.', 'err');
      if (DS.itemQty(it) <= 0) return DS.toast('Defina a quantidade ou a grade de tamanhos.', 'err');
      if (!it.prints.length && it.mode !== 'revenda' && it.technique !== 'total') it.prints = [{ size: 'A4', position: 'frente' }];
      m.close();
      if (o.onSave) o.onSave(it);
    });
    return m;
  };

  /* linha de item usada nos resumos (checklist, carrinho, pedido, ficha) */
  DS.itemSummary = function (it, items) {
    const p = DS.product(it.productId);
    const qty = DS.itemQty(it);
    const bits = [];
    if (it.mode === 'revenda') bits.push('Revenda (liso)');
    else if (it.technique) bits.push(DS.techShort(it.technique));
    if (it.mode !== 'revenda' && (p.kind || '') === 'textil') {
      if (it.fabricId) bits.push(DS.fabricName(it.fabricId));
      if ((p.collar || []).length && it.collar) bits.push(DS.collarName(it.collar));
      if ((p.sleeve || []).length && it.sleeve) bits.push(DS.sleeveName(it.sleeve));
    }
    const color = it.colorId ? DS.colorOf(p, it.colorId) : null;
    if (color) bits.push('peça ' + String(color.name).toLowerCase());
    if ((it.prints || []).length) bits.push('estampa ' + DS.printsLabel(it));
    const ex = (it.extras || []).map(e => ((DS.catalog().extras || []).find(x => x.code === (e && e.code ? e.code : e)) || {}).label).filter(Boolean);
    return `<div class="item-line">
      <div>
        <b>${DS.esc(p.name || 'Item')}</b>
        <div class="muted small mt4">${DS.esc(bits.filter(Boolean).join(' · '))}</div>
        ${ex.length ? `<div class="small mt4">+ ${DS.esc(ex.join(' · '))}</div>` : ''}
        ${it.observation ? `<div class="muted small mt4">${DS.esc(it.observation)}</div>` : ''}
      </div>
      <div class="item-right">
        <span class="badge">${DS.num(qty)} ${DS.plural(qty, 'peça')}</span>
        ${it.mode === 'revenda' ? '' : `<div class="grade">${DS.esc(DS.gradeText(it) || 'sem quantidades')}</div>`}
      </div>
    </div>`;
  };

  /* Uso interno da equipe: mostra o contador de peças (não usar nas telas do cliente). */
  DS.capacityBar = function (load, incoming, limit) {
    const w = DS.week() || {};
    load = load == null ? (w.loadTotal || 0) : load;
    limit = limit == null ? (w.limit || 250) : limit;
    const pct = l => Math.min(100, Math.round(((l || 0) / (limit || 1)) * 100));
    const over = (load + (incoming || 0)) > limit;
    return `<div class="cap">
      <div class="row between small"><span>Janela de <b>estampa total</b> desta semana</span><b>${load}${incoming ? ' + ' + incoming : ''} / ${limit} peças</b></div>
      <div class="bar"><i style="width:${pct(load)}%"></i><i class="in" style="width:${Math.min(100 - pct(load), pct(incoming || 0))}%"></i></div>
      <div class="small ${over ? 'err-txt' : 'muted'}">${over ? 'Janela cheia: seu pedido entra no próximo lote. Fale com o atendente.' : 'Ainda há espaço no lote de ' + DS.batchLabel() + ' para abadás e uniformes.'}</div>
    </div>`;
  };
})();
