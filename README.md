# D-Stamp · Site de pedidos (varejo) + Painel operacional

Estamparia, confecção e brindes personalizados — Praia Grande/SP · Av. Presidente Kennedy, 6545 · (13) 99669-9067 · contato@d-stamp.art.br · loja oficial: [dstamp.com.br](https://www.dstamp.com.br)

O site é **varejo** e funciona como **braço do WhatsApp**: ele explica o processo, deixa o cliente montar o pedido de **estampa total** num **assistente passo a passo** (uma etapa por tela), mostra preço e prazo na hora e, em tudo que depende de conversa (estampa localizada, peça de terceiros, brindes), **entrega o WhatsApp aberto com a mensagem já escrita**.

Três frentes:

| Frente | Quem usa | O que faz |
|---|---|---|
| **Loja + guia** | cliente | entende o serviço, monta o pedido passo a passo, vê preço/prazo/lote |
| **Acompanhamento** | cliente | 9 etapas, arte (principal → final → aprovar), comprovante, chamados, alteração |
| **Painel** | atendente, designer, admin | pedidos, comprovantes, arte, chamados, ficha do designer, lote/janela, preços, catálogo, conteúdo do guia |

---

## 1. Como rodar

Requisito: **Node.js 18+**. Não precisa de `npm install` — o servidor não usa nenhuma biblioteca externa.

```bash
cd dstamp
npm start              # http://localhost:3000
npm run dev            # DSTAMP_DEV=1 → habilita POST /api/dev/reset (usado pelos testes)
```

Variáveis de ambiente (todas opcionais): `PORT` (padrão 3000) · `HOST` (padrão 0.0.0.0) · `DSTAMP_DATA` (pasta do banco e dos uploads — use um disco persistente em produção) · `DSTAMP_NO_DEMO=1` (banco vazio, sem dados de demonstração) · `DSTAMP_ADMIN_EMAIL` / `DSTAMP_ADMIN_PASSWORD` (administrador inicial; sem senha, uma é gerada e impressa uma vez) · `DSTAMP_DEV=1` (**nunca** em produção). Health check: `GET /api/health`.

- Banco: `data/db.json`, criado automaticamente com **8 pedidos de exemplo** (`D-2026-0912` a `D-2026-0919`), clientes, comprovantes, artes, chamados e notificações.
- Zerar tudo: apague `data/db.json` e reinicie (ou `POST /api/dev/reset` com `DSTAMP_DEV=1`).
- Uploads (artes e comprovantes): `data/uploads/`.
- **`DSTAMP_DEV` deve ficar desligado em produção** — a rota de reset exige a flag *e* um login de administrador.

## 2. Acessos

**Equipe**

| Perfil | E-mail | Senha | O que faz |
|---|---|---|---|
| Administrador | `admin@dstamp.com.br` | `admin123` | lote, janela, prazos, preços, catálogo, conteúdo, usuários, integrações, logs |
| Atendente | `atendente@dstamp.com.br` | `atende123` | pedidos, clientes, comprovantes, chamados, arte (há também `bruno@dstamp.com.br`) |
| Designer | `designer@dstamp.com.br` | `arte123` | arte do pedido e ficha técnica por tipo de produto |

**Cliente (demonstração)** — não cria conta: entra com **número do pedido + WhatsApp do cadastro**.
`D-2026-0912` + `13999990001` · `0913` + `…002` · `0915` + `…004` · `0916` + `…005` · `0918` + `…007` · `0919` + `…008`.

## 3. Regras de negócio (confirmadas com a D-Stamp)

### Foco e limites

- **Foco do site: estampa total** — camiseta, baby look, regata, regata feminina (nadador), **regata machão (camiseta sem manga)**, camiseta infantil, regata infantil, **calça capoeira** e "outros itens". São os **9 produtos da vitrine**. **Não existe short** no catálogo.
- **Estampa localizada: só com consulta ao WhatsApp.** O site **não** abre pedido self-service de localizada; ele explica sublimação × DTF, mostra os valores de referência e **monta a mensagem pronta** para o WhatsApp (produto, cor, técnica, quantidade, posição e tamanho da estampa).
- Os outros **26 produtos** (canecas, garrafas, squeezes, brindes, peças lisas e insumos) aparecem no catálogo marcados como **"sob consulta no WhatsApp"**, com o valor de referência da loja oficial e o botão de conversa.
- **Sem polo e sem algodão** — removidos do catálogo, das fichas, dos textos, dos exports e do configurador. O guia diz isso com todas as letras.
- **Sem quantidade mínima** — de 1 peça ao lote completo.
- **A janela de 250 peças vale só para estampa total.** DTF, sublimação, brindes e revenda não entram na contagem.
- **O cliente vê apenas a DATA e o status.** Na home, no topo e no assistente aparecem: `Próxima data disponível: sábado, 31/10` + selo (`Lote aberto` · `Últimas vagas` · `Lote fechado`) + urgência (`faltam 17 dias`). **Sem barra, sem números e sem a palavra "semana"** — a contagem de peças é informação interna. Os números (`186/250`, vagas, ocupação) aparecem **só para quem está logado**: no bloco fixo do painel e, no site, em um trecho `.team-only` da faixa do topo. A API corta esses campos de qualquer resposta sem login de equipe.
- **Prazo pode passar de 20 dias.** O texto do cliente avisa: *"Em lote cheio, o prazo pode passar um pouco de 20 dias — a data informada é a previsão."* (regra pedida para lotes de 250 peças).
- **Avisos do topo são editáveis pelo admin** (`Administração → Marca e contato`): cada aviso tem texto + chave "ativo", e a faixa do topo do site mostra todos os ativos em carrossel. Serve para "garanta sua data", feriado, manutenção etc.

### Prazos e lote

| Técnica | Material | Prazo | Observação |
|---|---|---|---|
| **Estampa total** | Dry Fit ou Poliflex | **15 a 20 dias** | Produzida **em lote, aos sábados**; o lote fecha conforme o volume. Próximo lote editável no painel — hoje **31/10/2026**. |
| **Localizada · sublimação** | poliéster **branco/claro** | 3 a 4 dias | Onde a arte tem branco, aparece a cor da peça. Peça escura → DTF. |
| **Localizada · DTF** | qualquer cor | 5 a 7 dias | Aceita degradê e detalhe fino. |
| **Revenda (peça lisa)** | canecas, garrafas, camisetas, insumos | 1 a 2 dias | Mesmos produtos e valores da loja oficial. |

O prazo começa a contar **após arte aprovada e pagamento autorizado**. Pedido misto assume o prazo do item mais demorado. Se o lote encher, o site **bloqueia** o pedido, mostra a próxima data disponível e oferece o WhatsApp (a equipe pode forçar o aceite com `force: true`).

### Preços

**Estampa total (por peça)**

| Tecido | Até 10 peças | Acima de 10 |
|---|---|---|
| Dry Fit | R$ 55,00 | R$ 50,00 |
| Poliflex | R$ 65,00 | R$ 60,00 |

- Gola redonda + manga curta: **inclusas**. Gola V: **+R$ 1,50**. Manga longa: **+R$ 5,50**.
- Infantil segue a **mesma tabela** até o GG.
- Acima do GG existem **EXG, G1…G6**, cada tamanho somando **+R$ 3,00** (G6 em Dry Fit até 10 peças = R$ 76,00).
- A faixa (até 10 / acima de 10) é calculada pelo total de peças de estampa total **do mesmo tecido no pedido**.

**Estampa localizada (referência — a compra é pelo WhatsApp)**

| Tamanho | Sublimação | DTF |
|---|---|---|
| 10 × 10 cm | R$ 6,50 | R$ 6,50 |
| A4 | R$ 13,00 | R$ 15,00 |
| A3 | R$ 16,00 | R$ 20,00 |

**Peças lisas** (valores da loja oficial): camiseta poliéster branca R$ 15,79 · mescla/mescla clara/rosa/rosa chiclete R$ 16,42 · preta R$ 18,42 · infantil branca R$ 13,16 · promocional R$ 10,60 · caneca cerâmica branca R$ 12,32 · caneca polímero R$ 6,84 · interna/alça colorida R$ 16,84 · coração R$ 18,95 · vidro jateado degradê R$ 14,74 · chopp 475 ml R$ 24,21 · glitter R$ 18,95 · preta com tarja R$ 23,68 · squeeze alumínio 600 ml R$ 25,27 · squeeze prata 500 ml R$ 18,94 · mosquetão R$ 23,16 · garrafa térmica inox 500 ml R$ 42,11 · azulejo 20×20 R$ 11,58 · azulejo 15×15 R$ 8,95 · toalha lavabo R$ 8,00 · caixinha R$ 2,63 · suporte de azulejo R$ 1,58.

**Extras por unidade:** nome R$ 5 · número R$ 3 · etiqueta interna R$ 2 · embalagem individual R$ 2,50 · ribana R$ 3 · bolso R$ 4 · patrocínio R$ 4 · bordado e silk sob consulta.

**Pagamento:** PIX integral com **5% de desconto**, entrada de **50%** no PIX + saldo na retirada, **cartão em até 3x** no pedido estampado (revenda: até 12x). O comprovante é validado pela equipe e gera **identificação automática `REC-0000`** enviada ao administrador.

## 4. O caminho do cliente

### Assistente passo a passo (`#/montar`)

**Uma etapa por tela** (menos informação por vez, mais fácil no celular): no topo, uma **trilha com 10 pontos** — cada ponto só fica clicável quando todas as etapas anteriores estão completas; embaixo, o botão **Próximo** só habilita quando a etapa atual está completa e mostra o que falta (*"Próximo: escolher os tamanhos"*). O resumo com **total, peças e data** fica sempre visível e a barra fixa do celular traz o botão de enviar.

`1 produto` → `2 tecido` → `3 gola` → `4 manga` → `5 tamanhos` → `6 arte` → `7 extras` → `8 dados` → `9 pagamento` → `10 revisar`

- Etapas que não se aplicam ao produto (ex.: gola/manga na calça capoeira e na regata nadador) **se resolvem sozinhas** e já nascem marcadas.
- O assistente **começa em branco**: sem modelagem escolhida, o Próximo fica travado (o cliente precisa decidir o que quer).
- Preço ao vivo com **quebra do valor** (peça × faixa, gola/manga, acréscimo por tamanho, estampa, extras) e **prazo + data do lote**.
- O rascunho fica salvo no aparelho (`localStorage`), então o cliente pode sair e voltar.
- Alterar a modelagem limpa a grade de tamanhos (as grades são diferentes) — o site avisa.

### O site explica (guia "Como funciona", `#/guia`)

**15 blocos de conteúdo** editáveis pelo admin + **12 perguntas frequentes** + **6 exemplos reais**: o que é estampa total, sublimação × DTF, tecidos (Dry Fit/Poliflex, e por que não há algodão), gola e manga, tabela de tamanhos PP→G6 (com o acréscimo), como enviar a arte, prazos e lote de sábado, formas de pagamento, retirada e mapas, brindes, revenda, o que **não** fazemos, glossário e passo a passo numerado. Âncoras diretas: `#/guia#guia-prazo`, `#guia-preco`, `#guia-tamanhos`.

### Estampa localizada (`#/localizada`)

Página de **consulta**: o cliente escolhe produto, cor, técnica, quantidade, posição e tamanho da estampa, vê o **valor de referência** e o **pré-visualizador**, e o botão **abre o WhatsApp com a mensagem pronta** (incluindo o aviso de que peças de terceiros usam DTF). Nenhum pedido de localizada é criado pelo site — a API responde 400 pedindo o WhatsApp, salvo para a equipe autenticada.

### Carrinho, acompanhamento e pedidos

- **Carrinho**: itens com edição, total, **cartão "próxima data disponível"** (nível + data do lote, sem contador), caixa com medidas/tecidos da loja, **Google Maps e Apple Maps**, envio pelo site **ou** pelo WhatsApp.
- **Acompanhar** (`#/acompanhar`): código + telefone. Se o telefone não confere, o site explica o motivo (sem vazar dados do pedido).
- **Página do pedido** (`#/pedido/:code`): 9 etapas, data prevista com o lote, **arte principal → arte final → aprovar/pedir ajuste**, upload de comprovante, alteração de itens **até a data do lote**, anotações numeradas (vinculáveis a cada item) e **chamados ALT/ACO/FIN/ERR** com marcação de urgência. Botão de **imprimir** o pedido.

### Rotas

`#/` · `#/total` · `#/produto/:id` · `#/montar[/:productId]` · `#/localizada` · `#/guia[#ancora]` · `#/exemplos` · `#/carrinho` · `#/acompanhar` · `#/pedido/:code` · `#/painel[/aba[/argumento]]`

## 5. Painel da equipe

**Bloco "Semana disponível"** — fixo **acima de todas as abas** do painel: barra de ocupação, peças usadas, **vagas livres**, pedidos na semana, % de ocupação, lote atual e o lote seguinte, com atalho para *Administração → Lote, janela e prazos*.

**Aba "Lotes"** — os **6 sábados seguintes** em tabela: situação (`Recebendo pedidos` / `Previsto`), peças, vagas, pedidos e observação de cada lote. Deixa explícita a regra do negócio: **os lotes são subsequentes e o cliente não compra hoje para receber em um lote futuro** — quando o lote atual enche, o site passa a oferecer a próxima data.

**8 abas:** Painel (KPIs, fluxo por etapa, produção por técnica, artes, chamados, prontos para retirada) · **Lotes** · Pedidos (busca e filtros por etapa/técnica/arte, **edição inline** de grade com preço por tamanho, tecido, gola, manga, cor, estampa e quantidade, histórico de etapa, cadastro do cliente) · Comprovantes (autorizar → `REC-0000` + notificação automática ao admin, recusar com motivo, lançamento manual) · Chamados (4 tabelas numeradas **ALT/ACO/FIN/ERR** com filtro de urgente, kanban) · Clientes · **Ficha do designer** (informações **separadas por tipo de produto**, grade em pílulas `M:3`, copiar e CSV) · Administração.

**Administração — 12 sub-abas:** Marca e contato (inclui os **avisos do topo do site**) · **Loja e foco** (foco em estampa total, localizada só WhatsApp, vitrine, loja oficial) · **Lote, janela e prazos** · **Preços e estampas** · **Catálogo (modelagens)** — com as colunas **"delta"** e **"só WhatsApp"** · **Guia do site (conteúdo)** — editor dos 15 blocos e do FAQ · Extras e acabamentos · Pagamento e regras · FAQ · Usuários · Integrações · Log de auditoria.

## 6. Responsivo (mobile-first)

- CSS sem CDN, escrito **mobile-first** com quebras em **640 px / 980 px / 1280 px** + folha de **impressão**.
- No celular: menu **hambúrguer**, grades em 1 coluna, **todas as tabelas dentro de contêiner com rolagem horizontal**, imagens `max-width:100%` e **barra fixa (dock)** com total + ação principal, respeitando `safe-area-inset-bottom` (notch).
- No desktop (≥980 px): navegação completa, checkout em 2 colunas com resumo **sticky**, guia com sumário lateral, dock some.
- Acessibilidade: link "ir para o conteúdo", `aria-current`, contraste revisado, áreas de toque ≥ 40 px, `print` limpo do pedido.

## 7. Estrutura

```
dstamp/
├── server.js               API REST + estáticos (Node puro, ~1.850 linhas, zero dependências)
├── package.json
├── SWOT.md                 análise FOFA + cruzamento estratégico, KPIs, riscos e 6 prioridades
├── DEPLOY.md               guia de publicação: grátis hoje e escala para 20 mil visitas/mês
├── Dockerfile · docker-compose.yml · render.yaml · .gitignore
├── tools/backup.js         backup/restore do banco + uploads (.tar.gz, mantém os últimos 14)
├── PERGUNTAS-E-DECISOES.md o que já está valendo e o que falta você confirmar
├── test/price-test.js      176 verificações de preço, prazo, lote, janela, exports e ficha
├── test/dom-test.js        318 verificações de interface (jsdom, já nas devDependencies)
├── data/                   db.json + uploads/
└── public/
    ├── index.html          shell + design system mobile-first (CSS inline)
    ├── js/core.js          API, formatação, catálogo, motor de preço, componentes, grade/quantidade, editor de item
    ├── js/app.js           landing (12 seções), cabeçalho/rodapé, roteador
    ├── js/loja.js          vitrine, produto, assistente de 10 etapas, localizada, guia, carrinho, acompanhamento, pedido
    ├── js/painel.js        painel (7 abas) + administração (12 sub-abas)
    └── img/                hero, exemplos e mockups das modelagens
```

## 8. Testes

```bash
npm run dev            # terminal 1 → DSTAMP_DEV=1 node server.js
npm test               # terminal 2 → 176 verificações
npm run test:ui        # terminal 3 → 318 verificações (npm i -D jsdom já instalado)
```

**494 verificações, tudo verde.** Os dois testes zeram o banco de exemplo antes de rodar (`/api/dev/reset` apaga as sessões — por isso cada um faz login de novo), então podem ser repetidos à vontade.

O teste de interface roda a página de verdade (jsdom): navega pelas rotas, percorre o assistente etapa por etapa (testando os travamentos), envia, acompanha, tenta telefone errado, entra no painel com os três perfis e confere as abas de administração — além de validar o CSS responsivo, se nenhuma tabela ficou fora do contêiner de rolagem **se nenhuma tela do cliente expõe o contador de peças ou fala em "semana"**, se a aba Lotes mostra as 6 janelas e se um aviso criado pelo admin aparece no topo do site do cliente.

## 9. API (resumo)

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/bootstrap` | catálogo, preços, prazos, lote, janela da semana, guia, FAQ, exemplos |
| POST | `/api/quote` | preço com quebra por item, prazo/lote, janela e alertas técnicos |
| POST | `/api/orders` | cria pedido (409 se estourar a janela; `force` para admin/atendente; 400 para localizada) |
| POST | `/api/orders/access` · GET `/api/orders/:code/view` | acompanhamento (pedido + telefone) |
| GET | `/api/orders` · PATCH `/api/orders/:code` | lista e edição pela equipe |
| POST | `/api/orders/:code/client-edit` | alteração do cliente **até a data do lote** |
| POST | `/api/orders/:code/receipts` · `/api/receipts/:id/decision` | comprovante + identificação automática |
| POST | `/api/orders/:code/art` · `/art/send` · `/art/decision` | fluxo de arte |
| POST | `/api/orders/:code/notes` · `/api/tickets` · PATCH `/api/tickets/:id` | anotações e chamados |
| GET | `/api/kpis` · `/api/customers` · `/api/users` · `/api/logs` | painel |
| GET | `/api/designer/sheet` | ficha técnica agrupada por produto |
| GET | `/api/export/olist.csv` · `/api/export/sysloja.csv` | integrações |
| PUT | `/api/config` (admin) | marca, loja, lote/janela/prazos, preços, catálogo, guia, extras, regras, FAQ, usuários, integrações |

Erros de acesso do cliente sempre respondem com texto que **explica** o motivo (ex.: *"Acesso não autorizado: o WhatsApp informado não confere com o cadastro deste pedido."*).

## 10. Integrações (Olist e Sysloja)

- **Olist**: `Numero do Pedido, Data, Situacao, Cliente, CPF/CNPJ, E-mail, Telefone, SKU, Produto, Variacao, Quantidade, Valor Unitario, Valor Total, Forma de Pagamento, Observacoes`. SKU `produto-tecnica[-tecido]` (ex.: `camiseta-total-dryfit`); a variação carrega tecido, gola, manga e grade (ou cor e estampa); peça lisa sai como `Revenda (liso)`.
- **Sysloja**: `Pedido, Data, Cliente, Telefone, Referencia, Produto, Tecnica, Cor, Estampa, Gola/Manga, Grade, Qtd, Preco Unitario, Total, Status, Previsao, Comprovante` — referência `PRODUTO-TECIDO`, grade `P=40 M=100`, previsão com a data do lote e comprovante `REC-0000`.
- **Automação (fase 2)**: o Olist importa pedidos por URL de notificação (`order-received` / `order-confirmed`), exige EAN e trata cada variação como produto separado; o Sysloja não tem documentação pública — o mapeamento é genérico por referência/grade e está documentado como **premissa**. As rotas deste servidor já recebem esses eventos; falta criar os webhooks.

## 11. Premissas assumidas (precisam do seu OK)

1. **`delta: 0` nas modelagens** — regata, baby look, regata feminina (nadador), machão, infantil e calça capoeira usam **a mesma tabela do Dry Fit/Poliflex da camiseta** (a calça capoeira fica em R$ 55 até GG e R$ 58 no EXG pela regra de +R$ 3 por tamanho). Cada produto tem um campo **"delta"** editável no painel (Administração → Catálogo): se a regata custa R$ 5 a menos, é só preencher `-5`.
2. **31/10 é a data prevista de retirada** do lote atual (o painel permite trocar entre "retirada" e "fechamento do lote").
3. **Objetos (caneca/garrafa/azulejo)** = peça lisa + estampa 10×10/A4/A3 (caneca branca + A4 = R$ 25,32). Como a localizada é só pelo WhatsApp, esse valor aparece como **referência**.
4. **Infantil entra na janela de 250 peças** junto com o adulto.
5. **Frete**: hoje só **retirada na loja** (com Google/Apple Maps).

Detalhes e o passo a passo de produção estão em `SWOT.md`; as perguntas abertas (número de pessoas, abas extras, pagamento, arte, revenda) estão em `PERGUNTAS-E-DECISOES.md`.

## 12. Publicação (deploy)

O passo a passo completo está em **`DEPLOY.md`**. Recomendação (respeitando "grátis sem cartão, ou com cartão só se não cobrar nada"): **Opção A — Render free**, sobe em ~10 minutos **sem cartão** (dorme após 15 min → ping grátis em `/api/health`; disco efêmero → `npm run backup` diário). **Opção B — Oracle Cloud Always Free** (VM 24h, 200 GB de disco, 10 TB/mês, R$ 0) **exige cartão para verificação**, então só entra quando houver pedido real de cliente. Também: Docker/compose, VPS brasileira (R$ 25–40/mês) e o dimensionamento para **20 mil visitas/mês** (o gargalo é tráfego de imagens, não CPU) com Cloudflare grátis na frente.

## 13. Antes de ir para produção

1. **Preços reais das modelagens** (deltas) e revisão da tabela contra a loja oficial — os valores mudam com frequência.
2. **Fotos reais** dos produtos e o **logo oficial** em SVG/PNG (as imagens atuais são ilustrativas).
3. **Banco**: `data/db.json` atende o início; com volume real migrar para MySQL/PostgreSQL (leitura/escrita já estão isoladas em `load()`/`save()`).
4. **Trocar as senhas**, remover os usuários de demonstração e **desligar `DSTAMP_DEV`**.
5. **Hospedagem**: VPS com Node 18+ (Hostinger, Railway, Render, DigitalOcean), **HTTPS** e backup diário de `data/`.
6. **Pagamento automático** (PIX/cartão com baixa por webhook) é a evolução natural do comprovante manual.
7. **WhatsApp Business API**: hoje os links abrem o WhatsApp do cliente; para responder dentro do site é preciso a API oficial (custo por conversa).
8. **LGPD**: prazo de guarda e acesso a artes/comprovantes (`data/uploads/`).
