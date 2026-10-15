/* =========================================================================
   D-Stamp · LOJA (cliente)
   vitrine de estampa total · página de produto · CHECKLIST de pedido ·
   localizada/brindes via WhatsApp · guia explicativo · carrinho · acompanhamento
   ========================================================================= */
(function () {
  'use strict';
  const DS = window.DS;
  const Loja = window.Loja = {};

  /* ============================ ESTADO DO PEDIDO ============================ */
  const BKEY = 'dstamp_builder_v2';
  let MEM = { artFile: null, artFileName: '' };
  let CAP_LEVEL = null;   /* nível da semana vindo do último /quote: aberto | ultimas | fechado */
  let GEN = 0;            /* geração da rota atual: respostas tardias não sobrescrevem a tela nova */
  const stale = g => g !== GEN;

  function newState(productId) {
    return {
      idx: 0,
      items: [newItem(productId)],
      customer: { name: '', phone: '', email: '', city: '', doc: '', notes: '' },
      payment: { method: 'pix_50' },
      openStep: 'produto',
      submitted: null
    };
  }
  function newItem(productId) {
    /* sem id → item em branco: o assistente começa travado na etapa 1 */
    const p = DS.product(productId) || {};
    const collars = p.collar || [], sleeves = p.sleeve || [];
    return {
      productId: p.id || '', technique: (p.techniques && p.techniques[0]) || 'total', mode: 'estampa',
      fabricId: 'dryfit', collar: collars[0] || '', sleeve: sleeves[0] || '',
      sizes: {}, qty: 0, extras: [], observation: '',
      art: { choice: '', note: '' }, extrasConfirmed: false
    };
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(BKEY) || 'null');
      if (s && Array.isArray(s.items) && s.items.length) return s;
    } catch (e) {}
    return newState();
  }
  function saveState() { try { localStorage.setItem(BKEY, JSON.stringify(S)); } catch (e) {} }
  let S = null;
  function state() { if (!S) S = loadState(); return S; }
  Loja.state = state;
  Loja.resetState = function () { S = newState(); MEM = { artFile: null, artFileName: '' }; saveState(); };
  Loja.cartItems = () => state().items.filter(it => DS.itemQty(it) > 0);
  Loja.cartCount = () => Loja.cartItems().length;
  Loja.cur = () => state().items[state().idx] || state().items[0];
  Loja.addItem = function (productId) {
    const s = state();
    s.items.push(newItem(productId));
    s.idx = s.items.length - 1;
    s.openStep = 'produto';
    saveState();
    return s.idx;
  };
  Loja.removeItem = function (i) {
    const s = state();
    s.items.splice(i, 1);
    if (!s.items.length) s.items.push(newItem());
    s.idx = Math.max(0, Math.min(s.idx, s.items.length - 1));
    saveState();
  };

  /* ============================== MOUNT / ROTAS ============================= */
  Loja.mount = async function (el, name, arg) {
    GEN++;
    await DS.boot();
    S = loadState();
    const map = {
      home: () => App.home(el),
      total: () => renderVitrine(el),
      produto: () => renderProduto(el, arg),
      montar: () => renderMontar(el, arg),
      localizada: () => renderLocalizada(el),
      guia: () => renderGuia(el),
      exemplos: () => renderExemplos(el),
      carrinho: () => renderCarrinho(el),
      acompanhar: () => renderAcompanhar(el),
      pedido: () => renderPedido(el, arg)
    };
    const fn = map[name] || map.home;
    await fn();
  };

  /* ================================ VITRINE ================================ */
  function renderVitrine(el) {
    const c = DS.catalog(), pr = c.prices || {};
    const dry = (pr.total || {}).dryfit || [], poly = (pr.total || {}).poliflex || [];
    let q = '', ord = 'relevancia';
    const all = DS.storeProducts();

    const draw = () => {
      let list = all.filter(p => {
        const t = (q || '').toLowerCase().trim();
        if (!t) return true;
        return [p.name, p.short, p.desc, (p.tags || []).join(' '), (p.uses || []).join(' ')].join(' ').toLowerCase().includes(t);
      });
      if (ord === 'menor') list = list.slice().sort((a, b) => (DS.fromPrice(a) || 9e9) - (DS.fromPrice(b) || 9e9));
      if (ord === 'maior') list = list.slice().sort((a, b) => (DS.fromPrice(b) || 0) - (DS.fromPrice(a) || 0));
      if (ord === 'az') list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
      el.querySelector('#vt-list').innerHTML = list.length ? `<div class="grid-products">${list.map(App.cardProduto).join('')}</div>`
        : `<div class="card center muted">Nenhuma modelagem encontrada com "${DS.esc(q)}".<br><a class="btn ghost sm mt12" href="#/localizada">Falar no WhatsApp</a></div>`;
      el.querySelector('#vt-count').textContent = list.length + ' ' + DS.plural(list.length, 'modelagem');
    };

    el.innerHTML = `<section class="section"><div class="wrap wide">
      <span class="eyebrow">Vitrine · estampa total</span>
      <h1>Escolha a modelagem da sua peça estampada</h1>
      <p class="muted big-txt" style="max-width:70ch">Todas as modelagens abaixo são produzidas em <b>estampa total</b> (peça inteira estampada), em Dry Fit ou Poliflex, <b>a partir de 1 peça</b>. O preço é o mesmo da tabela: ${DS.money(dry[0] ? dry[0].price : 55)} até 10 peças e ${DS.money(dry[1] ? dry[1].price : 50)} acima de 10 no Dry Fit.</p>

      <div class="grid c3 mt16">
        <div class="card mini"><span class="muted small">Prazo</span><b>${DS.esc(DS.leadTotalLabel())}</b><span class="muted small">produzido em lote de sábado</span></div>
        <div class="card mini"><span class="muted small">Próximo lote</span><b>${DS.esc(DS.batchLabel())}</b><span class="muted small">após arte aprovada + pagamento</span></div>
        <div class="card mini"><span class="muted small">Quantidade mínima</span><b>1 peça</b><span class="muted small">sem mínimo em nenhum item</span></div>
      </div>

      <div class="mk-bar mt16">
        <div class="mk-search">${DS.icon('search')}<input id="vt-q" type="search" placeholder="Buscar: camiseta, regata, baby look, nadador, machão, calça capoeira…" aria-label="Buscar modelagem"></div>
        <div class="row between wrap-row gap">
          <div class="chips" id="vt-cats">
            <button class="chip on" data-ord="relevancia">Relevância</button>
            <button class="chip" data-ord="menor">Menor preço</button>
            <button class="chip" data-ord="maior">Maior preço</button>
            <button class="chip" data-ord="az">A–Z</button>
          </div>
          <span class="muted small" id="vt-count"></span>
        </div>
      </div>
      <div id="vt-list"></div>

      <div class="grid c2 mt24" style="align-items:start">
        <div class="card">
          <h3>${DS.icon('money')} Tabela de preço (todas as modelagens)</h3>
          ${DS.tableHtml({ head: ['Tecido', 'Até 10 peças', 'Acima de 10 peças'], rows: [
            ['Dry Fit', DS.money(dry[0] ? dry[0].price : 55), DS.money(dry[1] ? dry[1].price : 50)],
            ['Poliflex', DS.money(poly[0] ? poly[0].price : 65), DS.money(poly[1] ? poly[1].price : 60)]
          ] })}
          <div class="chips mt12">${(c.totalAddons || []).map(a => `<span class="chip radio">${DS.esc(a.label)} <b>+ ${DS.money(a.price)}</b></span>`).join('')}
            <span class="chip radio">Acima do GG <b>+ ${DS.money(pr.sizeSurchargeAboveGG || 3)}/tamanho</b></span></div>
        </div>
        <div class="card">
          <h3>${DS.icon('whats')} Não achou a sua modelagem?</h3>
          <p class="muted small">Fazemos cropped, blusa, camisa com recorte especial, uniforme com modelagem própria e outras peças em estampa total — valor sob consulta.</p>
          <div class="btn-row">${DS.waBtn('Olá! Quero uma modelagem diferente das do site (estampa total). Pode me ajudar?', 'Consultar no WhatsApp')}
            <a class="btn ghost" href="#/guia#guia-modelagens">${DS.icon('info')}<span>Guia de modelagens</span></a></div>
          ${DS.capacityCard()}
        </div>
      </div>
    </div></section>`;

    el.querySelector('#vt-q').addEventListener('input', e => { q = e.target.value; draw(); });
    el.querySelectorAll('#vt-cats [data-ord]').forEach(b => b.addEventListener('click', () => {
      ord = b.dataset.ord;
      el.querySelectorAll('#vt-cats .chip').forEach(x => x.classList.toggle('on', x === b));
      draw();
    }));
    draw();
  }

  /* ============================ PÁGINA DE PRODUTO =========================== */
  function renderProduto(el, id) {
    const p = DS.product(id);
    if (!p.id || p.whatsappOnly) {
      el.innerHTML = `<section class="section"><div class="wrap narrow">
        <div class="alert warn">${DS.icon('alert')}<span>Produto não encontrado na vitrine de estampa total. ${p.whatsappOnly ? 'Este item é orçado pelo WhatsApp.' : ''}</span></div>
        <div class="btn-row mt12"><a class="btn" href="#/total">Ver modelagens</a><a class="btn ghost" href="#/localizada">Estampa localizada</a></div>
      </div></section>`;
      return;
    }
    const c = DS.catalog(), pr = c.prices || {};
    const dry = (pr.total || {}).dryfit || [], poly = (pr.total || {}).poliflex || [];
    const sizes = DS.sizesFor(p.id, 'total', 'estampa');
    let fabric = 'dryfit';
    const collars = DS.collarOptions(p), sleeves = DS.sleeveOptions(p);
    let collar = collars[0] ? collars[0].id : '', sleeve = sleeves[0] ? sleeves[0].id : '';
    const tempItem = () => ({ productId: p.id, technique: 'total', mode: 'estampa', fabricId: fabric, collar: collar, sleeve: sleeve, sizes: {}, qty: 1, extras: [] });

    const priceBox = () => {
      const line = DS.priceLine(tempItem(), [tempItem()]);
      return `<div class="card" id="pp-price">
        <span class="eyebrow">Preço da peça estampada</span>
        <div class="row between wrap-row gap">
          <span class="price big">${p.priceOnRequest ? 'Sob consulta' : DS.money(line.unit)}${p.priceOnRequest ? '' : '<small>por peça · ' + DS.esc(DS.fabricName(fabric)) + '</small>'}</span>
          <span class="badge" style="--b:#3DD68C">sem quantidade mínima</span>
        </div>
        <div class="chips mt12">
          <span class="chip radio">Até 10 peças <b>${DS.money(fabric === 'dryfit' ? (dry[0] || {}).price : (poly[0] || {}).price)}</b></span>
          <span class="chip radio">Acima de 10 <b>${DS.money(fabric === 'dryfit' ? (dry[1] || {}).price : (poly[1] || {}).price)}</b></span>
          ${collar === 'v' ? `<span class="chip radio on">Gola V <b>+ ${DS.money(DS.addonPrice('gola_v'))}</b></span>` : ''}
          ${sleeve === 'longa' ? `<span class="chip radio on">Manga longa <b>+ ${DS.money(DS.addonPrice('manga_longa'))}</b></span>` : ''}
          ${DS.deltaOf(p) ? `<span class="chip radio on">Modelagem <b>+ ${DS.money(DS.deltaOf(p))}</b></span>` : ''}
        </div>
        <div class="divider"></div>
        <b class="small">Tecido</b>
        <div class="opts">
          ${['dryfit', 'poliflex'].map(f => `<label class="opt ${fabric === f ? 'on' : ''}"><input type="radio" name="ppf" data-fabric="${f}" ${fabric === f ? 'checked' : ''}>
            <b>${DS.fabricName(f)}</b><span>${DS.esc(DS.fabricDesc(f))}</span>
            <span class="add">${DS.money(f === 'dryfit' ? (dry[0] || {}).price : (poly[0] || {}).price)} até 10 · ${DS.money(f === 'dryfit' ? (dry[1] || {}).price : (poly[1] || {}).price)} acima</span></label>`).join('')}
        </div>
        ${collars.length > 1 ? `<div class="mt12"><b class="small">Gola</b><div class="opts">
          ${collars.map(o => `<label class="opt ${collar === o.id ? 'on' : ''}"><input type="radio" name="ppc" data-collar="${o.id}" ${collar === o.id ? 'checked' : ''}>
            <b>${DS.esc(o.label)}</b><span class="add">${o.add ? '+ ' + DS.money(o.add) : 'inclusa'}</span></label>`).join('')}</div></div>` : ''}
        ${sleeves.length > 1 ? `<div class="mt12"><b class="small">Manga</b><div class="opts">
          ${sleeves.map(o => `<label class="opt ${sleeve === o.id ? 'on' : ''}"><input type="radio" name="pps" data-sleeve="${o.id}" ${sleeve === o.id ? 'checked' : ''}>
            <b>${DS.esc(o.label)}</b><span class="add">${o.add ? '+ ' + DS.money(o.add) : 'inclusa'}</span></label>`).join('')}</div></div>` : ''}
        <div class="btn-row mt16">
          <a class="btn big lime" href="#/montar/${p.id}">${DS.icon('check')}<span>Montar pelo checklist</span></a>
          ${DS.waBtn('Olá! Quero orçamento de ' + p.name + ' em estampa total (' + DS.fabricName(fabric) + ').', 'Dúvida no WhatsApp', 'big ghost')}
        </div>
      </div>`;
    };

    const sizesTable = () => {
      const line = DS.priceLine(tempItem(), [tempItem()]);
      if (!sizes.length) return '<div class="muted small">Modelagem sem grade de tamanhos — quantidade livre.</div>';
      return `<div class="table-wrap"><table>
        <thead><tr><th>Tamanho</th><th>Acréscimo</th><th>Preço da peça (${DS.esc(DS.fabricName(fabric))})</th></tr></thead>
        <tbody>${sizes.map(s => {
          const base = (line.sizePrices || {})[s];
          const ref = line.sizePrices[sizes.find(x => !String(x).match(/^(EXG|G[1-6])$/))] || base;
          const add = base != null && ref != null ? Number((base - ref).toFixed(2)) : 0;
          return `<tr><td><b>${DS.esc(s)}</b></td><td>${add > 0 ? '+ ' + DS.money(add) : 'incluso'}</td><td>${base != null ? DS.money(base) : '—'}</td></tr>`;
        }).join('')}</tbody></table></div>
        <div class="table-note">Preço por peça já com a gola e a manga selecionadas. A quantidade de cada tamanho é definida no checklist.</div>`;
    };

    const related = DS.storeProducts().filter(x => x.id !== p.id).slice(0, 4);
    const info = id2 => (c.info || []).find(x => x.id === id2) || {};

    el.innerHTML = `<section class="section"><div class="wrap wide">
      <div class="small muted"><a href="#/">Início</a> · <a href="#/total">Estampa total</a> · <b>${DS.esc(p.name)}</b></div>
      <div class="product-page mt12">
        <div>
          <div class="gal">${p.img ? `<img id="pp-img" src="${DS.esc(p.img)}" alt="${DS.esc(p.name)} em estampa total">` : `<div class="ph" style="display:grid;place-items:center;height:100%">${DS.icon('shirt', 'lg')}</div>`}</div>
          <div class="thumbs">
            ${[p.img, '/img/exemplo-total-1.jpg', '/img/exemplo-total-2.jpg', '/img/exemplo-abada.jpg'].filter((v, i, a) => v && a.indexOf(v) === i).map((src, i) => `<img src="${DS.esc(src)}" data-src="${DS.esc(src)}" class="${i === 0 ? 'on' : ''}" alt="Foto ${i + 1} de ${DS.esc(p.name)}">`).join('')}
          </div>
          <div class="card mt12">
            <h3>${DS.icon('info')} O que está incluso</h3>
            <ul class="bullets">${(p.bullets || []).map(x => `<li>${DS.icon('check')}<span>${DS.esc(x)}</span></li>`).join('')}</ul>
            ${(p.uses || []).length ? `<div class="mt8"><b class="small">Mais usado para</b><div class="chips mt4">${p.uses.map(u => `<span class="chip radio">${DS.esc(u)}</span>`).join('')}</div></div>` : ''}
          </div>
          <div class="card mt12">
            <h3>${DS.icon('ruler')} Tamanhos e preços por tamanho</h3>
            <div id="pp-sizes">${sizesTable()}</div>
          </div>
        </div>
        <div>
          <div class="row gap wrap-row">${p.badge ? `<span class="badge" style="--b:#7C5CFF">${DS.esc(p.badge)}</span>` : ''}
            <span class="badge" style="--b:#22D3EE">Estampa total</span>
            <span class="badge" style="--b:#3DD68C">A partir de 1 peça</span></div>
          <h1 class="mt8">${DS.esc(p.name)}</h1>
          <p class="muted big-txt">${DS.esc(p.desc || p.short || '')}</p>
          <div class="kv mt12">
            <b>Modelagem</b><span>${DS.esc(p.name)}</span>
            <b>Tecido</b><span>Dry Fit ou Poliflex (100% poliéster para sublimação)</span>
            <b>Gola</b><span>${collars.length ? DS.esc(collars.map(o => o.label + (o.add ? ' (+' + DS.brl(o.add) + ')' : '')).join(' · ')) : 'não se aplica'}</span>
            <b>Manga</b><span>${sleeves.length ? DS.esc(sleeves.map(o => o.label + (o.add ? ' (+' + DS.brl(o.add) + ')' : '')).join(' · ')) : 'não se aplica'}</span>
            <b>Tamanhos</b><span>${sizes.length ? DS.esc(sizes.join(' · ')) : 'sob medida'}</span>
            <b>Prazo</b><span>${DS.esc(DS.leadTotalLabel())} · lote de ${DS.esc(DS.batchLabel())}</span>
          </div>
          <div class="mt16" id="pp-pricebox">${priceBox()}</div>
          <div class="card mt12">
            <h3>${DS.icon('star')} Extras que agregam valor</h3>
            <div class="chips">${(c.extras || []).filter(x => (x.techniques || []).includes('total')).map(x => `<span class="chip radio">${DS.esc(x.label)} ${x.price != null ? `<b>+ ${DS.money(x.price)}/peça</b>` : '<span class="muted small">sob consulta</span>'}</span>`).join('')}</div>
          </div>
          <div class="grid mt12" style="grid-template-columns:1fr">
            ${DS.infoBlock(Object.assign({}, info('prazo'), { group: 'Prazo' }))}
            ${DS.infoBlock(Object.assign({}, info('arte'), { group: 'Arte' }))}
          </div>
        </div>
      </div>

      <div class="section tight"><div class="row between wrap-row"><h2 class="mb0">Outras modelagens</h2><a class="btn ghost sm" href="#/total">Ver todas</a></div>
      <div class="grid-products mt12">${related.map(App.cardProduto).join('')}</div></div>
    </div></section>`;

    el.querySelectorAll('.thumbs img').forEach(t => t.addEventListener('click', () => {
      el.querySelectorAll('.thumbs img').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      const big = el.querySelector('#pp-img'); if (big) big.src = t.dataset.src;
    }));
    const repaint = () => {
      const box = el.querySelector('#pp-pricebox');
      box.innerHTML = priceBox();
      el.querySelector('#pp-sizes').innerHTML = sizesTable();
      bindPrice();
    };
    function bindPrice() {
      el.querySelectorAll('[data-fabric]').forEach(r => r.addEventListener('change', () => { fabric = r.dataset.fabric; repaint(); }));
      el.querySelectorAll('[data-collar]').forEach(r => r.addEventListener('change', () => { collar = r.dataset.collar; repaint(); }));
      el.querySelectorAll('[data-sleeve]').forEach(r => r.addEventListener('change', () => { sleeve = r.dataset.sleeve; repaint(); }));
    }
    bindPrice();
  }

  /* ================================ CHECKLIST =============================== */
  const STEPS = [
    { id: 'produto',   n: 1,  title: 'Escolher a modelagem',          level: 'item' },
    { id: 'tecido',    n: 2,  title: 'Escolher o tecido',             level: 'item' },
    { id: 'gola',      n: 3,  title: 'Gola',                          level: 'item' },
    { id: 'manga',     n: 4,  title: 'Manga',                         level: 'item' },
    { id: 'tamanhos',  n: 5,  title: 'Tamanhos e quantidades',        level: 'item' },
    { id: 'arte',      n: 6,  title: 'A sua arte',                    level: 'item' },
    { id: 'extras',    n: 7,  title: 'Extras que agregam valor',      level: 'item', optional: true },
    { id: 'dados',     n: 8,  title: 'Seus dados',                    level: 'order' },
    { id: 'pagamento', n: 9,  title: 'Forma de pagamento',            level: 'order' },
    { id: 'revisar',   n: 10, title: 'Revisar e enviar',              level: 'order' }
  ];

  function stepDone(id) {
    const s = state(), it = Loja.cur();
    const p = DS.product(it.productId);
    switch (id) {
      case 'produto': return !!p.id && !p.whatsappOnly;
      case 'tecido': return ['dryfit', 'poliflex'].includes(it.fabricId);
      case 'gola': return (p.collar || []).length ? (p.collar || []).includes(it.collar) : true;
      case 'manga': return (p.sleeve || []).length ? (p.sleeve || []).includes(it.sleeve) : true;
      case 'tamanhos': return DS.itemQty(it) > 0;
      case 'arte': return !!it.art.choice && (it.art.choice !== 'tenho' || !!MEM.artFileName);
      case 'extras': return !!it.extrasConfirmed;
      case 'dados': return String(s.customer.name || '').trim().length > 2 && String(s.customer.phone || '').replace(/\D/g, '').length >= 10;
      case 'pagamento': return !!s.payment.method;
      case 'revisar': return !!s.submitted || STEPS.filter(x => x.id !== 'revisar').every(x => stepDone(x.id));
      default: return false;
    }
  }
  function stepSubtitle(id) {
    const s = state(), it = Loja.cur(), p = DS.product(it.productId);
    switch (id) {
      case 'produto': return p.name || '—';
      case 'tecido': return DS.fabricName(it.fabricId);
      case 'gola': return (p.collar || []).length ? DS.collarName(it.collar) : 'não se aplica nesta modelagem';
      case 'manga': return (p.sleeve || []).length ? DS.sleeveName(it.sleeve) : 'não se aplica nesta modelagem';
      case 'tamanhos': { const q = DS.itemQty(it); return q ? q + ' ' + DS.plural(q, 'peça') + (DS.gradeText(it) ? ' · ' + DS.gradeText(it) : '') : 'defina a grade'; }
      case 'arte': return ({ tenho: 'vou anexar a arte', criar: 'quero que a D-Stamp crie', whats: 'vou enviar pelo WhatsApp' })[it.art.choice] || 'como você vai enviar a arte';
      case 'extras': return (it.extras || []).length ? it.extras.map(e => ((DS.catalog().extras || []).find(x => x.code === e.code) || {}).label).join(', ') : (it.extrasConfirmed ? 'sem extras' : 'opcional');
      case 'dados': return s.customer.name ? s.customer.name + ' · ' + s.customer.phone : 'nome e WhatsApp';
      case 'pagamento': return DS.payMethodName(s.payment.method);
      case 'revisar': { const t = DS.cartTotals(Loja.cartItems()); return t.qty ? DS.num(t.qty) + ' peças · ' + DS.money(t.total) : 'confira o resumo'; }
      default: return '';
    }
  }
  function doneCount() { return STEPS.filter(st => stepDone(st.id)).length; }

  function renderMontar(el, productId) {
    const s = state();
    if (productId) {
      const cur = Loja.cur();
      if (cur.productId !== productId) {
        const sizes = {};
        s.items[s.idx] = Object.assign(newItem(productId), { sizes: sizes, extras: cur.extras, observation: cur.observation, art: cur.art, extrasConfirmed: cur.extrasConfirmed });
      }
    }
    saveState();

    el.innerHTML = `<section class="section tight"><div class="wrap wide">
      <div class="progress-top"><div class="wrap wide" style="padding:0">
        <div class="row between wrap-row gap">
          <div><span class="eyebrow mb0">Checklist do pedido</span>
            <b id="mk-prog-txt">0 de ${STEPS.length} etapas concluídas</b></div>
          <div class="row gap">
            <a class="btn ghost sm" href="#/guia">${DS.icon('info', 'sm')}<span>Tire dúvidas</span></a>
            <button class="btn ghost sm" id="mk-reset">${DS.icon('x', 'sm')}<span>Limpar</span></button>
          </div>
        </div>
        <div class="pbar mt8"><i id="mk-prog" style="width:0%"></i></div>
      </div></div>

      <div class="row between wrap-row mt12">
        <div><h1 class="mb0">Monte sua estampa total</h1>
          <p class="muted">Uma etapa por vez. Você só avança quando a anterior estiver pronta.</p></div>
        <div class="chips" id="mk-items"></div>
      </div>

      <div class="builder mt16">
        <div class="check" id="mk-steps"></div>
        <div class="summary-col"><div id="mk-summary"></div></div>
      </div>
    </div></section>`;

    el.querySelector('#mk-reset').addEventListener('click', async () => {
      if (await DS.confirm('Limpar todas as etapas do checklist?')) { Loja.resetState(); renderMontar(el, ''); DS.toast('Checklist zerado.'); }
    });
    el.querySelector('#mk-items').addEventListener('click', e => {
      const add = e.target.closest('[data-add]'), sel = e.target.closest('[data-sel]'), rm = e.target.closest('[data-rm]');
      if (add) { Loja.addItem(''); draw(); DS.toast('Nova modelagem adicionada ao pedido.'); return; }
      if (sel) { state().idx = Number(sel.dataset.sel); state().openStep = 'produto'; saveState(); draw(); return; }
      if (rm) { Loja.removeItem(Number(rm.dataset.rm)); draw(); }
    });

    function draw() {
      drawItems(); drawSteps(); drawSummary(); drawProgress(); drawDock();
    }
    function drawItems() {
      const s = state();
      el.querySelector('#mk-items').innerHTML = s.items.map((it, i) => `
        <span class="chip ${i === s.idx ? 'on' : ''}" data-sel="${i}">${DS.esc(DS.product(it.productId).name || 'Item ' + (i + 1))}
          <b>${DS.itemQty(it) || 0}</b>${s.items.length > 1 ? `<button class="icon-btn" data-rm="${i}" style="padding:2px 5px" aria-label="Remover item">${DS.icon('x', 'sm')}</button>` : ''}</span>`).join('')
        + `<button class="chip" data-add="1">${DS.icon('plus', 'sm')}<span>Outra modelagem</span></button>`;
    }
    function drawProgress() {
      const d = doneCount();
      el.querySelector('#mk-prog').style.width = Math.round((d / STEPS.length) * 100) + '%';
      el.querySelector('#mk-prog-txt').textContent = d + ' de ' + STEPS.length + ' etapas concluídas';
    }
    /* -------- ASSISTENTE: uma etapa por tela, só avança com a anterior pronta -------- */
    function curStep() {
      const s = state();
      let id = s.openStep;
      if (!STEPS.some(x => x.id === id)) id = '';
      if (!id) id = (STEPS.find(x => !stepDone(x.id)) || STEPS[STEPS.length - 1]).id;
      return STEPS.find(x => x.id === id);
    }
    /* só pode entrar numa etapa se todas as anteriores estiverem completas */
    function canEnter(id) {
      for (const st of STEPS) { if (st.id === id) return true; if (!stepDone(st.id)) return false; }
      return true;
    }
    function gotoStep(id) {
      state().openStep = id; saveState();
      drawSteps(); drawProgress(); drawDock();
      const card = el.querySelector('.wiz-card'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function drawSteps() {
      const s = state();
      const st = curStep();
      s.openStep = st.id;
      const idx = STEPS.indexOf(st);
      const done = stepDone(st.id);
      const next = STEPS[idx + 1];
      el.querySelector('#mk-steps').innerHTML = `
        <nav class="wiz-rail" aria-label="Etapas do pedido">
          ${STEPS.map(x => {
            const d = stepDone(x.id), cur = x.id === st.id;
            const ok = d || cur || canEnter(x.id);
            return `<button type="button" class="wiz-dot ${d ? 'done' : ''} ${cur ? 'cur' : ''}" data-wiz="${x.id}" ${ok ? '' : 'disabled'}
              aria-current="${cur ? 'step' : 'false'}" title="${DS.esc(x.title)}">
              <span class="wd-n">${d ? DS.icon('check', 'sm') : x.n}</span><span class="wd-t">${DS.esc(x.title)}</span></button>`;
          }).join('')}
        </nav>
        <article class="check-step open wiz-card" data-step="${st.id}">
          <div class="wiz-head">
            <span class="eyebrow mb0">Etapa ${st.n} de ${STEPS.length}${st.optional ? ' · opcional' : ''}</span>
            <b>${DS.esc(st.title)}</b>
            <span class="muted small">${DS.esc(stepSubtitle(st.id))}</span>
          </div>
          <div class="check-body wiz-body">${stepBody(st.id)}</div>
          <div class="wiz-nav">
            <button class="btn ghost" id="wiz-back" ${idx === 0 ? 'disabled' : ''}>${DS.icon('chevron', 'sm')}<span>Voltar</span></button>
            ${next
              ? `<div class="row gap wrap-row"><button class="btn ${done ? 'lime' : ''}" id="wiz-next" ${done ? '' : 'disabled'}>
                   <span>Próximo: ${DS.esc(next.title)}</span>${DS.icon('chevron', 'sm')}</button>
                 ${done ? '' : '<span class="muted small">Complete esta etapa para continuar.</span>'}</div>`
              : '<span class="muted small">Tudo pronto — confira o resumo e envie.</span>'}
          </div>
        </article>`;
      el.querySelectorAll('[data-wiz]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.wiz;
        if (id === st.id) return;
        if (!stepDone(id) && !canEnter(id)) { DS.toast('Termine as etapas anteriores primeiro.', 'warn'); return; }
        gotoStep(id);
      }));
      const bk = el.querySelector('#wiz-back');
      if (bk) bk.addEventListener('click', () => { if (idx > 0) gotoStep(STEPS[idx - 1].id); });
      const nx = el.querySelector('#wiz-next');
      if (nx) nx.addEventListener('click', () => { if (stepDone(st.id) && next) gotoStep(next.id); });
      bindStep();
    }

    /* ---------------- CORPO DE CADA ETAPA (com explicação) ---------------- */
    function stepBody(id) {
      const s = state(), it = Loja.cur(), p = DS.product(it.productId), c = DS.catalog(), pr = c.prices || {};
      const dry = (pr.total || {}).dryfit || [], poly = (pr.total || {}).poliflex || [];
      switch (id) {
        case 'produto': return `
          <div class="hint">${DS.icon('info')} Todas as modelagens usam a mesma tabela de preço. Escolha pelo caimento: regata para calor e abadá, baby look e nadador para o público feminino, machão para modelagem ampla.</div>
          <div class="opts">${DS.storeProducts().map(x => `<label class="opt ${x.id === it.productId ? 'on' : ''}">
            <input type="radio" name="mk-prod" data-prod="${x.id}" ${x.id === it.productId ? 'checked' : ''}>
            ${x.img ? `<img src="${DS.esc(x.img)}" alt="${DS.esc(x.name)}" loading="lazy">` : ''}
            <b>${DS.esc(x.name)}</b><span>${DS.esc(x.short || '')}</span>
            <span class="add">${x.priceOnRequest ? 'sob consulta' : DS.money(DS.fromPrice(x)) + ' a peça'}</span></label>`).join('')}</div>
          <div class="alert info mt12">${DS.icon('whats')}<span>Não achou a modelagem? Fazemos sob medida — <a href="#/localizada">fale no WhatsApp</a>.</span></div>`;

        case 'tecido': return `
          <div class="hint">${DS.icon('info')} Os dois tecidos são 100% poliéster e aceitam estampa total. Dry Fit é leve e esportivo; Poliflex tem toque mais macio e encorpado.</div>
          <div class="opts">${['dryfit', 'poliflex'].map(f => `<label class="opt ${it.fabricId === f ? 'on' : ''}">
            <input type="radio" name="mk-fab" data-fabric="${f}" ${it.fabricId === f ? 'checked' : ''}>
            <b>${DS.fabricName(f)}</b><span>${DS.esc(DS.fabricDesc(f))}</span>
            <span class="add">${DS.money(f === 'dryfit' ? (dry[0] || {}).price : (poly[0] || {}).price)} até 10 · ${DS.money(f === 'dryfit' ? (dry[1] || {}).price : (poly[1] || {}).price)} acima de 10</span></label>`).join('')}</div>
          ${DS.tableHtml((((c.info || []).find(x => x.id === 'tecidos') || {}).table) || { head: ['', 'Dry Fit', 'Poliflex'], rows: [] })}`;

        case 'gola': {
          const opts = DS.collarOptions(p);
          if (!opts.length) return `<div class="alert info">${DS.icon('info')}<span>${DS.esc(p.name)} não tem opção de gola — etapa concluída automaticamente.</span></div>`;
          return `<div class="hint">${DS.icon('info')} Gola redonda já está inclusa no preço. Gola V soma ${DS.money(DS.addonPrice('gola_v'))} por peça.</div>
          <div class="opts">${opts.map(o => `<label class="opt ${it.collar === o.id ? 'on' : ''}">
            <input type="radio" name="mk-col" data-collar="${o.id}" ${it.collar === o.id ? 'checked' : ''}>
            <b>${DS.esc(o.label)}</b><span class="add">${o.add ? '+ ' + DS.money(o.add) + ' por peça' : 'inclusa no preço'}</span></label>`).join('')}</div>`;
        }
        case 'manga': {
          const opts = DS.sleeveOptions(p);
          if (!opts.length) return `<div class="alert info">${DS.icon('info')}<span>${DS.esc(p.name)} não tem opção de manga — etapa concluída automaticamente.</span></div>`;
          return `<div class="hint">${DS.icon('info')} Manga longa soma ${DS.money(DS.addonPrice('manga_longa'))} por peça. Regata e nadador não têm manga.</div>
          <div class="opts">${opts.map(o => `<label class="opt ${it.sleeve === o.id ? 'on' : ''}">
            <input type="radio" name="mk-slv" data-sleeve="${o.id}" ${it.sleeve === o.id ? 'checked' : ''}>
            <b>${DS.esc(o.label)}</b><span class="add">${o.add ? '+ ' + DS.money(o.add) + ' por peça' : 'inclusa no preço'}</span></label>`).join('')}</div>`;
        }
        case 'tamanhos': {
          const sizes = DS.sizesFor(it.productId, 'total', 'estampa');
          return `<div class="hint">${DS.icon('info')} Sem quantidade mínima: 1 peça já entra em produção. Acima de 10 peças do mesmo tecido o preço cai automaticamente. Cada tamanho acima do GG soma ${DS.money(pr.sizeSurchargeAboveGG || 3)} por peça.</div>
            ${sizes.length ? DS.sizeGridHtml(it) : DS.qtyHtml(it)}
            ${sizes.length ? `<div class="btn-row mt12">
              <button class="btn ghost sm" data-quick="1">${DS.icon('plus', 'sm')}<span>1 peça (M)</span></button>
              <button class="btn ghost sm" data-quick="10">10 peças (P 2 · M 4 · G 3 · GG 1)</button>
              <button class="btn ghost sm" data-clear="1">${DS.icon('x', 'sm')}<span>Limpar grade</span></button></div>` : ''}
            <div class="alert info mt12">${DS.icon('ruler')}<span>Precisa da tabela de medidas em centímetros? <a href="${DS.esc(DS.waLink('Olá! Pode me enviar a tabela de medidas da estampa total?'))}" target="_blank" rel="noopener">Peça no WhatsApp</a> antes de fechar a grade.</span></div>`;
        }
        case 'arte': return `
          <div class="hint">${DS.icon('info')} Nada vai para produção sem a sua aprovação. Você pode anexar agora, mandar depois no WhatsApp ou pedir para a nossa equipe criar.</div>
          <div class="opts">
            ${[['tenho', 'Tenho a arte pronta', 'Vou anexar o arquivo aqui no pedido'],
               ['whats', 'Vou enviar pelo WhatsApp', 'Mando a arte na conversa, com o número do pedido'],
               ['criar', 'Quero que a D-Stamp crie', 'Envio a ideia, logo ou referência e o designer monta']].map(([v, t, d]) => `<label class="opt ${it.art.choice === v ? 'on' : ''}">
              <input type="radio" name="mk-art" data-art="${v}" ${it.art.choice === v ? 'checked' : ''}><b>${DS.esc(t)}</b><span>${DS.esc(d)}</span></label>`).join('')}
          </div>
          ${it.art.choice === 'tenho' ? `<div class="file-drop mt12" id="mk-drop">
              ${DS.icon('upload', 'lg')}
              <div class="mt8"><b>${MEM.artFileName ? DS.esc(MEM.artFileName) : 'Toque para escolher o arquivo'}</b></div>
              <div class="muted small">PNG, JPG, PDF, SVG, AI, PSD ou CDR · até 12MB · quanto maior a resolução, melhor</div>
              <input type="file" id="mk-file" accept="image/*,.pdf,.ai,.eps,.cdr,.psd,.svg">
            </div>` : ''}
          <label class="mt12 block">Descrição da arte / o que ela precisa ter
            <textarea data-artnote rows="3" placeholder="Ex.: frente com o escudo do time e o número nas costas, degradê azul para verde, nome individual em cada peça, fonte parecida com a da foto que mandei…">${DS.esc(it.art.note || '')}</textarea></label>
          <div class="alert warn">${DS.icon('alert')}<span>Se a arte tiver branco, na <b>estampa total</b> o branco sai branco (a peça é impressa por inteiro). Na estampa localizada em peça clara, o branco vira a cor da peça.</span></div>`;

        case 'extras': return `
          <div class="hint">${DS.icon('info')} Extras são cobrados por peça e entram no valor total na hora. Todos são opcionais.</div>
          <div class="chips">${(c.extras || []).filter(x => (x.techniques || []).includes('total')).map(x => {
            const on = (it.extras || []).some(e => e.code === x.code);
            return `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" data-extra="${x.code}" ${on ? 'checked' : ''}>
              ${DS.esc(x.label)} ${x.price != null ? `<b>+ ${DS.money(x.price)}/peça</b>` : '<span class="muted small">sob consulta</span>'}</label>`;
          }).join('')}</div>
          <label class="mt12 block">Observação para a produção e para o designer
            <textarea data-obs rows="2" placeholder="Ex.: nomes individuais na lista anexa, ribana na cor do degradê, entregar separado por tamanho…">${DS.esc(it.observation || '')}</textarea></label>
          <button class="btn ghost sm mt8" data-noextra>${DS.icon('check', 'sm')}<span>Confirmar etapa (sem extras)</span></button>`;

        case 'dados': return `
          <div class="hint">${DS.icon('info')} Usamos estes dados para abrir o seu pedido, avisar das etapas e validar o comprovante. O número do pedido fica atrelado ao WhatsApp cadastrado.</div>
          <div class="form-grid">
            <label>Nome completo ou empresa<input data-c="name" value="${DS.esc(s.customer.name || '')}" placeholder="Ex.: Arena Beach Sports" autocomplete="name"></label>
            <label>WhatsApp (com DDD)<input data-c="phone" value="${DS.esc(s.customer.phone || '')}" placeholder="13 99999-0000" inputmode="tel" autocomplete="tel"></label>
            <label>E-mail<input data-c="email" value="${DS.esc(s.customer.email || '')}" placeholder="voce@email.com" autocomplete="email"></label>
            <label>Cidade/UF<input data-c="city" value="${DS.esc(s.customer.city || '')}" placeholder="Praia Grande/SP"></label>
            <label>CPF/CNPJ (opcional, para nota)<input data-c="doc" value="${DS.esc(s.customer.doc || '')}" placeholder="000.000.000-00"></label>
            <label>Como conheceu a D-Stamp?<input data-c="how" value="${DS.esc(s.customer.how || '')}" placeholder="Instagram, indicação, Google…"></label>
          </div>
          <label class="mt8 block">Observação geral do pedido
            <textarea data-c="notes" rows="2" placeholder="Ex.: preciso para o dia 20, é para um evento.">${DS.esc(s.customer.notes || '')}</textarea></label>
          <div class="alert info">${DS.icon('map')}<span>Retirada na loja: ${DS.esc((DS.config().brand || {}).address || '')} · <a href="${DS.mapsLink('google')}" target="_blank" rel="noopener">Google Maps</a> · <a href="${DS.mapsLink('apple')}" target="_blank" rel="noopener">Apple Maps</a>. Envio para outras cidades sob consulta.</span></div>`;

        case 'pagamento': {
          const t = DS.cartTotals(Loja.cartItems());
          const opts = [
            ['pix_50', 'PIX · 50% agora + 50% na retirada', 'Reserva o seu lugar no lote. Saldo na retirada.', DS.money(t.deposit) + ' agora'],
            ['pix_total', 'PIX integral com ' + ((DS.config().rules || {}).pixDiscountPercent || 5) + '% de desconto', 'Menor valor total. Libera a produção na hora.', DS.money(t.pixTotal)],
            ['cartao_3x', 'Cartão de crédito em até 3x', 'Parcelado pelo site (' + DS.money(t.installment) + ' por parcela).', DS.money(t.total)],
            ['dinheiro', 'Combinar com o atendente', 'Dinheiro, débito ou outra condição na retirada.', 'a combinar']
          ];
          return `<div class="hint">${DS.icon('info')} A produção começa depois de duas coisas: <b>arte aprovada</b> e <b>pagamento autorizado</b>. Comprovante enviado aqui recebe um código (REC-0001) e é validado pela equipe.</div>
            <div class="opts">${opts.map(([v, t2, d, val]) => `<label class="opt ${s.payment.method === v ? 'on' : ''}">
              <input type="radio" name="mk-pay" data-pay="${v}" ${s.payment.method === v ? 'checked' : ''}>
              <b>${DS.esc(t2)}</b><span>${DS.esc(d)}</span><span class="add">${DS.esc(val)}</span></label>`).join('')}</div>
            <div class="alert info mt12">${DS.icon('money')}<span>Você envia o comprovante na página do pedido, logo depois de enviar. Também pode mandar no WhatsApp citando o número do pedido.</span></div>`;
        }
        case 'revisar': return reviewBody();
        default: return '';
      }
    }

    function reviewBody() {
      const items = Loja.cartItems(), t = DS.cartTotals(items), s = state();
      return `<div class="hint">${DS.icon('info')} Confira tudo. Depois de enviar você recebe o número do pedido e pode acompanhar cada etapa — inclusive aprovar a arte e mandar o comprovante.</div>
        <div class="items">${items.map(it => DS.itemSummary(it, items)).join('') || '<div class="alert warn">Nenhum item com quantidade definida. Volte na etapa 5.</div>'}</div>
        <div class="kv mt12">
          <b>Cliente</b><span>${DS.esc(s.customer.name || '—')} · ${DS.esc(s.customer.phone || '—')}</span>
          <b>Contato</b><span>${DS.esc(s.customer.email || '—')}</span>
          <b>Pagamento</b><span>${DS.esc(DS.payMethodName(s.payment.method))}</span>
          <b>Total</b><span><b>${DS.money(t.total)}</b> (${DS.num(t.qty)} peças)</span>
          <b>Próximo lote</b><span>${DS.esc(DS.batchLabel())} · prazo ${DS.esc(DS.leadTotalLabel())}</span>
        </div>
        <div class="alert warn mt12">${DS.icon('clock')}<span>O prazo de ${DS.esc(DS.leadTotalLabel())} começa depois da <b>arte aprovada</b> e do <b>pagamento autorizado</b>.</span></div>
        <div id="mk-review-alerts"></div>
        <div class="btn-row mt12">
          <button class="btn big lime" id="mk-send">${DS.icon('check')}<span>Enviar pedido pelo site</span></button>
          <button class="btn big btn-wa" id="mk-wa">${DS.icon('whats')}<span>Enviar resumo no WhatsApp</span></button>
        </div>
        <div class="muted small mt8">Enviando pelo site você recebe o número do pedido (ex.: D-2026-0920) e acompanha tudo aqui. Enviando pelo WhatsApp, a nossa equipe abre o pedido para você.</div>`;
    }

    function drawSummary() {
      const s = state(), items = s.items, t = DS.cartTotals(Loja.cartItems());
      const pend = STEPS.filter(st => !stepDone(st.id));
      el.querySelector('#mk-summary').innerHTML = `<div class="summary">
        <div class="row between"><b>Resumo do pedido</b><span class="badge" style="--b:#7C5CFF">${DS.num(t.qty)} peças</span></div>
        <div class="items mt12">${items.map((it, i) => DS.itemSummary(it, items)).join('')}</div>
        <div class="divider"></div>
        <div class="kv">
          <b>Peças</b><span>${DS.num(t.qty)}</span>
          <b>Total</b><span><b>${DS.money(t.total)}</b></span>
          <b>PIX integral</b><span>${DS.money(t.pixTotal)} <span class="dim small">(${(DS.config().rules || {}).pixDiscountPercent || 5}% off)</span></span>
          <b>Entrada 50%</b><span>${DS.money(t.deposit)}</span>
          <b>Cartão 3x</b><span>${DS.money(t.installment)}</span>
        </div>
        <div class="divider"></div>
        <div class="alert info">${DS.icon('clock')}<span>Lote de <b>${DS.esc(DS.batchLabel())}</b> · prazo ${DS.esc(DS.leadTotalLabel())} após arte aprovada + pagamento autorizado.</span></div>
        ${DS.capacityCard(CAP_LEVEL)}
        <div class="mt12">${pend.length ? `<div class="muted small">Faltam ${pend.length} ${DS.plural(pend.length, 'etapa')}: ${DS.esc(pend.map(p => p.title.toLowerCase()).join(', '))}.</div>
          <button class="btn block mt8" data-goto="${pend[0].id}">${DS.icon('chevron')}<span>Ir para: ${DS.esc(pend[0].title)}</span></button>`
          : `<div class="alert ok">${DS.icon('check')}<span>Checklist completo! Revise e envie na etapa 10.</span></div>
             <button class="btn block lime mt8" data-goto="revisar">${DS.icon('check')}<span>Revisar e enviar</span></button>`}</div>
        <div class="btn-row mt12">
          <a class="btn ghost sm" href="#/carrinho">${DS.icon('cart', 'sm')}<span>Ver carrinho</span></a>
          <button class="btn ghost sm" id="mk-wa2">${DS.icon('whats', 'sm')}<span>Resumo no WhatsApp</span></button>
        </div>
      </div>`;
      el.querySelector('#mk-summary').querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
        state().openStep = b.dataset.goto; saveState(); drawSteps();
        const t2 = el.querySelector(`[data-step="${b.dataset.goto}"]`); if (t2) t2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
      const wa2 = el.querySelector('#mk-wa2');
      if (wa2) wa2.addEventListener('click', () => DS.waOpen(DS.waOrderText(Loja.cartItems(), state().customer)));
    }

    function drawDock() {
      const t = DS.cartTotals(Loja.cartItems());
      const pend = STEPS.filter(st => !stepDone(st.id));
      DS.dock(`<div class="dt-l"><b>${DS.money(t.total)}</b><span>${DS.num(t.qty)} peças · ${doneCount()}/${STEPS.length} etapas</span></div>
        ${pend.length ? `<button class="btn sm" id="dock-next">${DS.esc(pend[0].title)}</button>` : `<button class="btn sm lime" id="dock-rev">Revisar e enviar</button>`}`);
      const nx = document.getElementById('dock-next');
      if (nx) nx.addEventListener('click', () => gotoStep(pend[0].id));
      const rv = document.getElementById('dock-rev');
      if (rv) rv.addEventListener('click', () => gotoStep('revisar'));
    }

    /* ------------------------------ EVENTOS ------------------------------ */
    function bindStep() {
      const root = el.querySelector('#mk-steps'), s = state(), it = Loja.cur();
      const after = () => { saveState(); drawSteps(); drawSummary(); drawProgress(); drawDock(); };
      const light = () => { saveState(); refreshMarks(); drawSummary(); drawProgress(); drawDock(); };
      /* só atualiza o "v" e o resumo de cada etapa — o corpo continua intacto */
      const refreshMarks = () => {
        el.querySelectorAll('.wiz-dot').forEach(node => {
          const id = node.dataset.wiz;
          const st2 = STEPS.find(x => x.id === id);
          const d = stepDone(id);
          node.classList.toggle('done', d);
          node.disabled = !(d || id === state().openStep || canEnter(id));
          const n = node.querySelector('.wd-n');
          if (n) n.innerHTML = d ? DS.icon('check', 'sm') : String(st2.n);
        });
        const sub = el.querySelector('.wiz-head .muted');
        if (sub) sub.textContent = stepSubtitle(state().openStep);
        const nx = el.querySelector('#wiz-next');
        if (nx) { nx.disabled = !stepDone(state().openStep); nx.classList.toggle('lime', !nx.disabled); }
      };

      root.querySelectorAll('[data-prod]').forEach(r => r.addEventListener('change', () => {
        const p2 = DS.product(r.dataset.prod);
        it.productId = p2.id; it.sizes = {}; it.qty = 0;
        it.collar = (p2.collar || [])[0] || ''; it.sleeve = (p2.sleeve || [])[0] || '';
        after();
      }));
      root.querySelectorAll('[data-fabric]').forEach(r => r.addEventListener('change', () => { it.fabricId = r.dataset.fabric; after(); }));
      root.querySelectorAll('[data-collar]').forEach(r => r.addEventListener('change', () => { it.collar = r.dataset.collar; after(); }));
      root.querySelectorAll('[data-sleeve]').forEach(r => r.addEventListener('change', () => { it.sleeve = r.dataset.sleeve; after(); }));

      const sizesBox = root.querySelector('[data-step="tamanhos"] .check-body');
      if (sizesBox) {
        DS.bindSizeGrid(sizesBox, it, light);
        const rep = () => { drawSteps(); drawSummary(); drawProgress(); drawDock(); };
        sizesBox.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
          const n = Number(b.dataset.quick);
          const sizes = DS.sizesFor(it.productId, 'total', 'estampa');
          if (n === 1) { it.sizes = {}; it.sizes[sizes.includes('M') ? 'M' : sizes[0]] = 1; }
          else { it.sizes = { P: 2, M: 4, G: 3, GG: 1 }; }
          it.qty = 0; rep();
        }));
        sizesBox.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { it.sizes = {}; it.qty = 0; rep(); }));
      }

      root.querySelectorAll('[data-art]').forEach(r => r.addEventListener('change', () => { it.art.choice = r.dataset.art; after(); }));
      const file = root.querySelector('#mk-file');
      if (file) file.addEventListener('change', () => {
        const f = file.files[0]; if (!f) return;
        MEM.artFile = f; MEM.artFileName = f.name; it.art.fileName = f.name;
        DS.toast('Arquivo "' + f.name + '" pronto para enviar com o pedido.');
        after();
      });
      const drop = root.querySelector('#mk-drop');
      if (drop) drop.addEventListener('click', () => file.click());
      const an = root.querySelector('[data-artnote]');
      if (an) an.addEventListener('input', () => { it.art.note = an.value; light(); });
      const ob = root.querySelector('[data-obs]');
      if (ob) ob.addEventListener('input', () => { it.observation = ob.value; light(); });

      root.querySelectorAll('[data-extra]').forEach(cb => cb.addEventListener('change', () => {
        const code = cb.dataset.extra;
        if (cb.checked) { if (!(it.extras || []).some(e => e.code === code)) it.extras.push({ code: code, qty: null }); }
        else it.extras = (it.extras || []).filter(e => e.code !== code);
        it.extrasConfirmed = true;
        after();
      }));
      const ne = root.querySelector('[data-noextra]');
      if (ne) ne.addEventListener('click', () => { it.extrasConfirmed = true; after(); DS.toast('Etapa de extras confirmada.'); });

      root.querySelectorAll('[data-c]').forEach(inp => inp.addEventListener('input', () => { s.customer[inp.dataset.c] = inp.value; light(); }));
      root.querySelectorAll('[data-pay]').forEach(r => r.addEventListener('change', () => { s.payment.method = r.dataset.pay; after(); }));

      const send = root.querySelector('#mk-send');
      if (send) send.addEventListener('click', () => submitOrder(send));
      const wa = root.querySelector('#mk-wa');
      if (wa) wa.addEventListener('click', () => DS.waOpen(DS.waOrderText(Loja.cartItems(), s.customer)));
    }

    async function submitOrder(btn) {
      const s = state();
      const items = Loja.cartItems();
      const box = el.querySelector('#mk-review-alerts');
      if (!items.length) { DS.toast('Defina ao menos 1 peça na etapa 5.', 'err'); s.openStep = 'tamanhos'; saveState(); drawSteps(); return; }
      if (!stepDone('dados')) { DS.toast('Preencha nome e WhatsApp na etapa 8.', 'err'); s.openStep = 'dados'; saveState(); drawSteps(); return; }
      if (!items.every(it => stepDoneItem(it))) { DS.toast('Tem item do pedido incompleto (modelagem, tecido ou quantidade).', 'err'); return; }
      btn.disabled = true; btn.innerHTML = DS.icon('clock') + '<span>Enviando…</span>';
      try {
        const q = await DS.api('/quote', { method: 'POST', body: { items: items } });
        CAP_LEVEL = (q.capacity || {}).level || null;
        const errs = (q.alerts || []).filter(a => a.level === 'err');
        if (box) box.innerHTML = DS.alertBox(errs.map(a => a.msg), (q.alerts || []).filter(a => a.level === 'warn').map(a => a.msg), (q.alerts || []).filter(a => a.level === 'info').map(a => a.msg));
        if (!q.capacity.ok) {
          btn.disabled = false; btn.innerHTML = DS.icon('check') + '<span>Enviar pedido pelo site</span>';
          drawSummary();
          DS.toast('Este lote fechou: seu pedido entra no lote de ' + (q.capacity.nextBatchLabel || DS.batchLabel()) + '. Chame no WhatsApp para reservar.', 'err');
          return;
        }
        const r = await DS.api('/orders', {
          method: 'POST',
          body: {
            items: items, customer: s.customer, paymentMethod: s.payment.method,
            notes: [s.customer.notes, items.map(i => i.art && i.art.note ? '[' + DS.productName(i.productId) + ' arte] ' + i.art.note : '').filter(Boolean).join('\n')].filter(Boolean).join('\n')
          }
        });
        if (MEM.artFile) {
          try {
            const up = await DS.fileToDataUrl(MEM.artFile);
            await DS.api('/orders/' + r.code + '/art', { method: 'POST', body: { kind: 'main', upload: up, phone: s.customer.phone } });
          } catch (e) { DS.toast('Pedido criado, mas o arquivo de arte não subiu. Envie pelo WhatsApp citando ' + r.code + '.', 'warn'); }
        }
        localStorage.setItem('dstamp_last_order', JSON.stringify({ code: r.code, phone: s.customer.phone }));
        s.submitted = r.code; saveState();
        MEM = { artFile: null, artFileName: '' };
        S = newState(); saveState();
        DS.toast('Pedido ' + r.code + ' enviado! Acompanhe as etapas aqui no site.');
        location.hash = '#/pedido/' + r.code;
      } catch (e) {
        DS.toastErr(e);
        btn.disabled = false; btn.innerHTML = DS.icon('check') + '<span>Enviar pedido pelo site</span>';
      }
    }
    function stepDoneItem(it) {
      const p = DS.product(it.productId);
      return !!p.id && ['dryfit', 'poliflex'].includes(it.fabricId) && DS.itemQty(it) > 0;
    }

    draw();
  }

  /* =========================== LOCALIZADA / WHATSAPP ======================= */
  function renderLocalizada(el) {
    const c = DS.catalog(), pr = c.prices || {}, cfg = DS.config();
    const loc = DS.productsOf('localizada'), brindes = DS.productsOf('brindes');
    const info = id => (c.info || []).find(x => x.id === id) || {};
    const d = { product: '', color: '', technique: 'sublimacao_localizada', print: 'A4', position: '', qty: 1, hasArt: true, note: '' };

    el.innerHTML = `<section class="section"><div class="wrap">
      <span class="eyebrow">Sublimação localizada · DTF têxtil · brindes</span>
      <h1>Estampa localizada: orçamento no WhatsApp</h1>
      <p class="muted big-txt" style="max-width:74ch">Aqui a arte vai apenas onde você escolher — peito, costas, manga, caneca, garrafa. Como o valor depende da <b>cor da peça</b>, do <b>tamanho</b> e da <b>posição</b> da estampa, o fechamento é feito na conversa do WhatsApp. Abaixo você já vê os valores de referência e monta a mensagem pronta.</p>

      <div class="grid c2 mt16" style="align-items:start">
        ${DS.infoBlock(info('localizada'))}
        <div>
          <div class="card">
            <h3>${DS.icon('whats')} Monte a sua mensagem de orçamento</h3>
            <p class="muted small">Preencha o que souber — o resto a gente confirma na conversa. A mensagem abre o WhatsApp já escrita.</p>
            <div class="form-grid">
              <label>Produto<select id="lc-prod"><option value="">Ainda não sei / quero orientação</option>
                <optgroup label="Peças e tecidos">${loc.map(p => `<option value="${p.id}">${DS.esc(p.name)}</option>`).join('')}</optgroup>
                <optgroup label="Brindes e objetos">${brindes.map(p => `<option value="${p.id}">${DS.esc(p.name)}</option>`).join('')}</optgroup></select></label>
              <label>Técnica<select id="lc-tech">
                <option value="sublimacao_localizada">Sublimação (peça branca/clara) · 3 a 4 dias</option>
                <option value="dtf">DTF têxtil (qualquer cor) · 5 a 7 dias</option>
                <option value="">Não sei — quero orientação</option></select></label>
              <label>Cor da peça<select id="lc-color"><option value="">a definir</option></select></label>
              <label>Tamanho da estampa<select id="lc-print">
                ${['10x10', 'A4', 'A3'].map(s => `<option value="${s}" ${s === 'A4' ? 'selected' : ''}>${s === '10x10' ? '10 × 10 cm' : s}</option>`).join('')}
                <option value="">a definir</option></select></label>
              <label>Quantidade<input id="lc-qty" type="number" min="1" value="1"></label>
              <label>Posição da estampa<input id="lc-pos" placeholder="Ex.: peito esquerdo, costas, frente inteira"></label>
            </div>
            <label class="inline-lbl mt8"><input type="checkbox" id="lc-art" checked> Já tenho a arte (senão, a nossa equipe cria)</label>
            <label class="mt8 block">Detalhes / observações<textarea id="lc-note" rows="2" placeholder="Ex.: logo colorido, 3 cores diferentes, preciso para o dia 20…"></textarea></label>
            <div class="card mini mt12" style="background:#0C1018"><b class="small">Pré-visualização da mensagem</b>
              <pre id="lc-preview" class="small muted" style="white-space:pre-wrap;margin:6px 0 0;font-family:inherit"></pre></div>
            <div class="btn-row mt12">
              <a class="btn big btn-wa" id="lc-send" target="_blank" rel="noopener" href="#">${DS.icon('whats')}<span>Abrir WhatsApp com a mensagem</span></a>
              <button class="btn ghost" id="lc-copy">${DS.icon('note')}<span>Copiar texto</span></button>
            </div>
          </div>
          <div class="card mt12">
            <h3>${DS.icon('money')} Valores de referência</h3>
            ${DS.tableHtml({ head: ['Estampa', 'Sublimação', 'DTF'], rows: [
              ['10 × 10 cm', DS.money((pr.print || {}).sublimacao['10x10']), DS.money((pr.print || {}).dtf['10x10'])],
              ['A4', DS.money((pr.print || {}).sublimacao.A4), DS.money((pr.print || {}).dtf.A4)],
              ['A3', DS.money((pr.print || {}).sublimacao.A3), DS.money((pr.print || {}).dtf.A3)]
            ] })}
            <div class="table-note">A peça lisa é cobrada à parte. Ex.: camiseta branca ${DS.money(15.79)} + estampa A4 em sublimação ${DS.money((pr.print || {}).sublimacao.A4)} = ${DS.money(15.79 + (pr.print || {}).sublimacao.A4)} por peça.</div>
            ${DS.tableHtml({ head: ['Peça lisa (poliéster)', 'Valor'], rows: [
              ['Camiseta branca adulto', DS.money(15.79)], ['Mescla, mescla clara, rosa, rosa chiclete', DS.money(16.42)],
              ['Preta (só DTF)', DS.money(18.42)], ['Infantil branca', DS.money(13.16)], ['Promocional branca', DS.money(10.6)]
            ] })}
          </div>
        </div>
      </div>

      <div class="mt24">
        <h2>Sua peça, nossa estampa</h2>
        <div class="grid c3">
          ${DS.infoBlock(info('terceiros'))}
          <div class="card">
            <h3>${DS.icon('alert')} O que precisa saber antes</h3>
            <ul class="bullets">
              <li>${DS.icon('check')}<span>Sublimação localizada só em peça <b>branca ou clara</b> de poliéster.</span></li>
              <li>${DS.icon('check')}<span>Peça escura? Use <b>DTF têxtil</b>: mesma arte, qualquer cor.</span></li>
              <li>${DS.icon('check')}<span>Se a arte tiver branco, na sublimação aparece a cor da peça; no DTF sai branco.</span></li>
              <li>${DS.icon('x')}<span>Não trabalhamos com polo.</span></li>
              <li>${DS.icon('clock')}<span>Prazo: sublimação 3 a 4 dias · DTF 5 a 7 dias, contados da chegada da peça/arte.</span></li>
            </ul>
            ${DS.waBtn('Olá! Quero estampar uma peça que já tenho (DTF ou sublimação).', 'Enviar foto da peça')}
          </div>
          <div class="card">
            <h3>${DS.icon('info')} Como pedir em 4 mensagens</h3>
            <ol class="steps-num">
              <li>Foto da peça (ou do produto) e a composição que está na etiqueta.</li>
              <li>Quantidade e tamanhos.</li>
              <li>Tamanho e posição da estampa (10x10, A4 ou A3).</li>
              <li>A arte — ou a ideia, se precisar que a gente crie.</li>
            </ol>
            <div class="alert info">${DS.icon('note')}<span>Com essas 4 informações, devolvemos valor e prazo na hora.</span></div>
          </div>
        </div>
      </div>

      <div class="mt24">
        <div class="row between wrap-row"><h2 class="mb0">Brindes e objetos personalizados</h2>
          <a class="btn ghost sm" href="${DS.esc((cfg.store || {}).externalStore || '#')}" target="_blank" rel="noopener">${DS.icon('store', 'sm')}<span>Comprar liso: ${DS.esc((cfg.store || {}).externalStoreLabel || 'dstamp.com.br')}</span></a></div>
        <p class="muted">Canecas, garrafas, azulejos, toalhas, chaveiros, bonés e chinelos em sublimação. Valores de referência do produto liso — a estampa é orçada no WhatsApp.</p>
        <div class="grid-products mt12">${brindes.map(p => {
          const blank = p.blank != null ? p.blank : null;
          return `<article class="p-card">
            <div class="p-art">${p.img ? `<img src="${DS.esc(p.img)}" alt="${DS.esc(p.name)}" loading="lazy">` : `<div class="ph">${DS.icon('mug')}</div>`}
              <span class="p-flag">orçamento no WhatsApp</span></div>
            <div class="p-body"><h3>${DS.esc(p.name)}</h3>
              <p class="desc">${DS.esc(p.short || p.note || '')}</p>
              <div class="p-foot">
                <span class="price">${blank != null ? DS.money(blank) : 'Sob consulta'}<small>${blank != null ? 'peça lisa · referência' : 'consulte'}</small></span>
                <a class="btn btn-wa sm" target="_blank" rel="noopener" href="${DS.waLink('Olá! Quero orçamento de ' + p.name + ' personalizado (estampa em sublimação). Quantidade: ')}">${DS.icon('whats', 'sm')}<span>Orçar</span></a>
              </div></div></article>`;
        }).join('')}</div>
      </div>

      <div class="mt24">${DS.infoBlock(info('prazo'))}</div>
    </div></section>`;

    const q = s => el.querySelector(s);
    const fillColors = () => {
      const p = DS.product(q('#lc-prod').value);
      q('#lc-color').innerHTML = '<option value="">a definir</option>' + (p.colors || []).map(cc => `<option value="${cc.id}">${DS.esc(cc.name)}${cc.light === false ? ' (escura: só DTF)' : ''}</option>`).join('');
    };
    const sync = () => {
      d.product = q('#lc-prod').value; d.technique = q('#lc-tech').value; d.color = q('#lc-color').value;
      d.print = q('#lc-print').value; d.qty = q('#lc-qty').value; d.position = q('#lc-pos').value;
      d.hasArt = q('#lc-art').checked; d.note = q('#lc-note').value;
      const p = DS.product(d.product);
      const colorName = (DS.colorOf(p, d.color) || {}).name || '';
      const text = DS.waLocalizedText(Object.assign({}, d, { product: p.name || '', color: colorName }));
      q('#lc-preview').textContent = text;
      q('#lc-send').href = DS.waLink(text);
      q('#lc-copy').onclick = () => DS.copy(text);
      /* alerta de técnica × cor da peça */
      if (d.technique === 'sublimacao_localizada' && (DS.colorOf(p, d.color) || {}).light === false)
        DS.toast('Peça escura: sublimação não pega. Selecione DTF têxtil.', 'warn');
    };
    ['#lc-prod', '#lc-tech', '#lc-color', '#lc-print', '#lc-qty', '#lc-pos', '#lc-art', '#lc-note'].forEach(sel => {
      q(sel).addEventListener('change', () => { if (sel === '#lc-prod') fillColors(); sync(); });
      q(sel).addEventListener('input', sync);
    });
    fillColors(); sync();
  }

  /* ================================== GUIA ================================= */
  function renderGuia(el) {
    const c = DS.catalog(), cfg = DS.config();
    const blocks = c.info || [];
    const groups = [...new Set(blocks.map(b => b.group))];
    let filter = '';

    const draw = () => {
      const t = filter.toLowerCase().trim();
      const list = blocks.filter(b => !t || [b.title, b.lead, (b.tags || []).join(' '), (b.bullets || []).join(' '), b.note || ''].join(' ').toLowerCase().includes(t));
      el.querySelector('#guia-list').innerHTML = list.length ? list.map(DS.infoBlock).join('')
        : '<div class="card center muted">Nenhum assunto encontrado. Tente "prazo", "preço", "arte", "tamanho" ou "pagamento".</div>';
      el.querySelector('#guia-count').textContent = list.length + ' ' + DS.plural(list.length, 'assunto');
    };

    el.innerHTML = `<section class="section"><div class="wrap wide">
      <span class="eyebrow">Guia do cliente</span>
      <h1>Como funciona a estampa na D-Stamp</h1>
      <p class="muted big-txt" style="max-width:76ch">Tudo que você precisa saber antes de pedir: o que é estampa total, diferença entre Dry Fit e Poliflex, modelagens, tamanhos, preço, prazo, lote, arte, pagamento, retirada, estampa localizada e cuidados com a peça.</p>
      <div class="mk-bar mt16">
        <div class="mk-search">${DS.icon('search')}<input id="guia-q" type="search" placeholder="Buscar no guia: prazo, preço, GG, arte, pix, retirada…" aria-label="Buscar no guia"></div>
        <div class="row between wrap-row gap"><div class="chips">
          ${groups.map(g => `<a class="chip" href="#guia-${DS.esc(((blocks.find(b => b.group === g) || {}).id) || '')}">${DS.esc(g)}</a>`).join('')}
        </div><span class="muted small" id="guia-count"></span></div>
      </div>
      <div class="guide mt16">
        <nav class="guide-nav" aria-label="Índice do guia">
          ${blocks.map(b => `<a href="#guia-${DS.esc(b.id)}">${DS.esc(b.title)}</a>`).join('')}
          <a href="#guia-faq">Perguntas frequentes</a>
          <a href="#guia-contato">Falar com a gente</a>
        </nav>
        <div>
          <div id="guia-list" class="grid" style="grid-template-columns:1fr"></div>
          <article class="card info-block mt16" id="guia-faq">
            <span class="eyebrow">Dúvidas</span><h3>${DS.icon('info')}<span>Perguntas frequentes</span></h3>
            <div class="mt12">${(cfg.faq || []).map(f => `<details class="faq-item"><summary>${DS.esc(f.q)}${DS.icon('plus', 'sm')}</summary><div class="a">${DS.esc(f.a)}</div></details>`).join('')}</div>
          </article>
          <article class="card info-block mt16" id="guia-contato">
            <span class="eyebrow">Atendimento</span><h3>${DS.icon('whats')}<span>Falar com a gente</span></h3>
            <div class="kv mt8">
              <b>WhatsApp</b><span>${DS.esc((cfg.brand || {}).whatsappLabel || '')}</span>
              <b>Endereço</b><span>${DS.esc((cfg.brand || {}).address || '')}</span>
              <b>Horário</b><span>${DS.esc((cfg.brand || {}).hours || '')}</span>
              <b>E-mail</b><span>${DS.esc((cfg.brand || {}).email || '')}</span>
              <b>Loja oficial</b><span><a href="${DS.esc((cfg.store || {}).externalStore || '#')}" target="_blank" rel="noopener">${DS.esc((cfg.store || {}).externalStoreLabel || 'dstamp.com.br')}</a></span>
            </div>
            <div class="btn-row mt12">
              ${DS.waBtn('Olá! Li o guia do site e tenho uma dúvida sobre estampa total.', 'Chamar no WhatsApp')}
              <a class="btn" href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.icon('map')}<span>Google Maps</span></a>
              <a class="btn ghost" href="${DS.mapsLink('apple')}" target="_blank" rel="noopener">${DS.icon('map')}<span>Apple Maps</span></a>
              <a class="btn lime" href="#/montar">${DS.icon('check')}<span>Montar meu pedido</span></a>
            </div>
          </article>
        </div>
      </div>
    </div></section>`;

    el.querySelector('#guia-q').addEventListener('input', e => { filter = e.target.value; draw(); });
    draw();
  }

  /* ================================= EXEMPLOS ============================== */
  function renderExemplos(el) {
    const cfg = DS.config();
    let f = 'todos';
    const list = () => (cfg.examples || []).filter(x => f === 'todos' || x.technique === f);
    el.innerHTML = `<section class="section"><div class="wrap wide">
      <span class="eyebrow">Portfólio</span><h1>Exemplos de peças que produzimos</h1>
      <p class="muted big-txt" style="max-width:70ch">Estampa total (peça inteira) e estampa localizada (sublimação e DTF). Use como referência para o seu pedido — mande a sua arte e a gente faz igual ou melhor.</p>
      <div class="chips mt16" id="ex-f">
        <button class="chip on" data-f="todos">Todos</button>
        <button class="chip" data-f="total">Estampa total</button>
        <button class="chip" data-f="sublimacao_localizada">Sublimação localizada</button>
        <button class="chip" data-f="dtf">DTF têxtil</button>
      </div>
      <div class="gal mt16" id="ex-list"></div>
      <div class="card mt24 center">
        <h3>Quer uma peça igual a essas?</h3>
        <p class="muted">Estampa total você monta aqui no site em poucos minutos. Localizada e brindes são orçados no WhatsApp.</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn lime" href="#/montar">${DS.icon('check')}<span>Montar estampa total</span></a>
          <a class="btn ghost" href="#/localizada">${DS.icon('palette')}<span>Estampa localizada</span></a>
          ${DS.waBtn('Olá! Vi os exemplos no site e quero um orçamento.', 'Falar no WhatsApp')}
        </div>
      </div>
    </div></section>`;
    const draw = () => { el.querySelector('#ex-list').innerHTML = list().map(App.exemploCard).join('') || '<div class="card muted">Nenhum exemplo nesta categoria.</div>'; };
    el.querySelectorAll('#ex-f [data-f]').forEach(b => b.addEventListener('click', () => {
      f = b.dataset.f;
      el.querySelectorAll('#ex-f .chip').forEach(x => x.classList.toggle('on', x === b));
      draw();
    }));
    draw();
  }

  /* ================================ CARRINHO =============================== */
  function renderCarrinho(el) {
    const s = state();
    const draw = () => {
      const items = Loja.cartItems(), t = DS.cartTotals(items);
      el.querySelector('#ct-body').innerHTML = !items.length
        ? `<div class="card center"><h3>Seu pedido está vazio</h3><p class="muted">Monte pelo checklist: são 10 etapas rápidas e o preço aparece na hora.</p>
           <a class="btn lime" href="#/montar">${DS.icon('check')}<span>Abrir o checklist</span></a></div>`
        : `<div class="items">${items.map((it, i) => `<div>${DS.itemSummary(it, items)}
            <div class="item-tools">
              <button class="btn ghost sm" data-edit="${s.items.indexOf(it)}">${DS.icon('edit', 'sm')}<span>Editar no checklist</span></button>
              <button class="btn ghost sm" data-rm="${s.items.indexOf(it)}">${DS.icon('x', 'sm')}<span>Remover</span></button>
            </div></div>`).join('')}</div>
          <div class="card mt16"><h3>Resumo dos valores</h3>
            <div class="kv">
              <b>Peças</b><span>${DS.num(t.qty)}</span>
              <b>Total</b><span><b>${DS.money(t.total)}</b></span>
              <b>PIX integral</b><span>${DS.money(t.pixTotal)} <span class="dim small">(${(DS.config().rules || {}).pixDiscountPercent || 5}% de desconto)</span></span>
              <b>Entrada 50% (PIX)</b><span>${DS.money(t.deposit)} + ${DS.money(t.total - t.deposit)} na retirada</span>
              <b>Cartão em 3x</b><span>${DS.money(t.installment)} sem juros</span>
              <b>Próximo lote</b><span>Lote de ${DS.esc(DS.batchLabel())}</span>
              <b>Prazo</b><span>${DS.esc(DS.leadTotalLabel())} após arte aprovada + pagamento autorizado</span>
            </div>
            ${DS.capacityCard(CAP_LEVEL)}
            <div class="alert info mt12">${DS.icon('info')}<span>Valores calculados pela tabela oficial: ${(DS.catalog().prices || {}).total ? DS.money(((DS.catalog().prices || {}).total.dryfit || [])[0].price) : ''} Dry Fit até 10 peças e ${DS.money((((DS.catalog().prices || {}).total.dryfit || [])[1] || {}).price)} acima de 10 · Poliflex ${DS.money((((DS.catalog().prices || {}).total.poliflex || [])[0] || {}).price)}/${DS.money((((DS.catalog().prices || {}).total.poliflex || [])[1] || {}).price)} · manga longa + ${DS.money(DS.addonPrice('manga_longa'))} · gola V + ${DS.money(DS.addonPrice('gola_v'))} · tamanho acima do GG + ${DS.money((DS.catalog().prices || {}).sizeSurchargeAboveGG)}.</span></div>
            <div class="btn-row mt12">
              <a class="btn" href="#/montar">${DS.icon('chevron', 'sm')}<span>Voltar ao checklist</span></a>
              <button class="btn lime" id="ct-go">${DS.icon('check')}<span>Concluir etapas e enviar</span></button>
              <button class="btn btn-wa" id="ct-wa">${DS.icon('whats')}<span>Enviar resumo no WhatsApp</span></button>
            </div>
          </div>`;
      const go = el.querySelector('#ct-go');
      if (go) go.addEventListener('click', () => {
        const pend = STEPS.filter(st => !stepDone(st.id));
        state().openStep = pend.length ? pend[0].id : 'revisar';
        saveState(); location.hash = '#/montar';
      });
      const wa = el.querySelector('#ct-wa');
      if (wa) wa.addEventListener('click', () => DS.waOpen(DS.waOrderText(items, s.customer)));
      el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { state().idx = Number(b.dataset.edit); state().openStep = 'produto'; saveState(); location.hash = '#/montar'; }));
      el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { Loja.removeItem(Number(b.dataset.rm)); draw(); }));
      DS.dock(items.length ? `<div class="dt-l"><b>${DS.money(t.total)}</b><span>${DS.num(t.qty)} peças no pedido</span></div>
        <button class="btn sm lime" id="dock-ct">Enviar pedido</button>` : '');
      const dct = document.getElementById('dock-ct');
      if (dct) dct.addEventListener('click', () => { state().openStep = 'revisar'; saveState(); location.hash = '#/montar'; });
    };

    el.innerHTML = `<section class="section"><div class="wrap">
      <span class="eyebrow">Carrinho</span><h1>Seu pedido</h1>
      <p class="muted">Estes são os itens do seu checklist. Falta alguma etapa? O botão abaixo leva direto para ela.</p>
      <div id="ct-body" class="mt16"></div>
    </div></section>`;
    draw();
  }

  /* ============================== ACOMPANHAR =============================== */
  function renderAcompanhar(el, presetCode) {
    const last = (() => { try { return JSON.parse(localStorage.getItem('dstamp_last_order') || 'null'); } catch (e) { return null; } })();
    el.innerHTML = `<section class="section"><div class="wrap narrow">
      <span class="eyebrow">Acompanhamento</span><h1>Meu pedido</h1>
      <p class="muted big-txt">Informe o número do pedido e o WhatsApp cadastrado. Você vê as 9 etapas, a data prevista, a arte para aprovar e pode enviar o comprovante.</p>
      <div class="card mt16">
        <div class="form-grid">
          <label>Número do pedido<input id="ac-code" placeholder="D-2026-0919" value="${DS.esc(presetCode || (last && last.code) || '')}"></label>
          <label>WhatsApp cadastrado<input id="ac-phone" placeholder="13999990001" inputmode="tel" value="${DS.user() ? '' : DS.esc((last && last.phone) || '')}"></label>
        </div>
        <div class="btn-row mt12">
          <button class="btn" id="ac-go">${DS.icon('search')}<span>Ver meu pedido</span></button>
          ${DS.waBtn('Olá! Quero acompanhar meu pedido na D-Stamp.', 'Falar com atendente', 'ghost')}
        </div>
        ${DS.user() ? '<div class="muted small mt8">Você está logado como equipe: o telefone é dispensado.</div>' : ''}
        <div class="alert info mt12">${DS.icon('note')}<span>Demo: <b>D-2026-0919</b> + telefone <b>13999990008</b> (abadá em produção) · <b>D-2026-0912</b> + <b>13999990001</b> (estampa total, 50% pago).</span></div>
      </div>
      <div id="ac-result" class="mt24"></div>
    </div></section>`;
    const go = async () => {
      const gen = GEN;
      const codeEl = el.querySelector('#ac-code');
      if (!codeEl) return;
      const code = codeEl.value.trim();
      const phoneEl = el.querySelector('#ac-phone');
      const phone = phoneEl ? phoneEl.value.trim() : '';
      if (!code) return DS.toast('Informe o número do pedido.', 'err');
      const host = () => el.querySelector('#ac-result');
      try {
        const r = await DS.api('/orders/' + encodeURIComponent(code) + '/view', { method: 'POST', body: { phone: phone } });
        if (stale(gen) || !host()) return;      /* o cliente já foi para outra página */
        localStorage.setItem('dstamp_last_order', JSON.stringify({ code: r.order.code, phone: phone }));
        renderPedidoView(host(), r.order);
        host().scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        DS.toastErr(e);
        if (stale(gen) || !host()) return;
        host().innerHTML = `<div class="alert err">${DS.icon('alert')}<span>${DS.esc(e.message)}</span></div>`;
      }
    };
    el.querySelector('#ac-go').addEventListener('click', go);
    el.querySelector('#ac-phone').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    if ((presetCode || last) && (DS.user() || (last && last.phone))) setTimeout(go, 250);
  }

  async function renderPedido(el, code) {
    const last = (() => { try { return JSON.parse(localStorage.getItem('dstamp_last_order') || 'null'); } catch (e) { return null; } })();
    const gen = GEN;
    el.innerHTML = '<section class="section"><div class="wrap"><div class="card center muted" id="pd-load">Carregando pedido…</div></div></section>';
    try {
      const r = await DS.api('/orders/' + encodeURIComponent(code) + '/view', { method: 'POST', body: { phone: (last && last.phone) || '' } });
      if (stale(gen)) return;
      renderPedidoView(el, r.order);
    } catch (e) {
      if (stale(gen) || !el.querySelector('#pd-load')) return;
      el.innerHTML = `<section class="section"><div class="wrap narrow">
        <div class="alert err">${DS.icon('alert')}<span>${DS.esc(e.message)}</span></div>
        <p class="muted">Você precisa informar o WhatsApp cadastrado no pedido para abrir esta página.</p>
        <a class="btn" href="#/acompanhar">${DS.icon('search')}<span>Informar código e telefone</span></a></div></section>`;
    }
  }
  Loja.renderPedido = renderPedido;

  /* ========================= DETALHE DO PEDIDO (CLIENTE) =================== */
  function renderPedidoView(el, o) {
    const cfg = DS.config();
    const phone = o.customer.phone;
    const items = o.items || [];
    const gen = GEN;
    const reload = async () => {
      const r = await DS.api('/orders/' + o.code + '/view', { method: 'POST', body: { phone: phone } });
      if (stale(gen)) return;
      o = r.order; draw();
    };
    const draw = () => {
      if (stale(gen) || !el.isConnected) return;   /* tela substituída por outra rota */
      const pendingAppr = (o.art.approvals || []).filter(a => !a.decision).slice(-1)[0];
      el.innerHTML = `
      <section class="section"><div class="wrap">
        <div class="row between wrap-row">
          <div><span class="eyebrow">Pedido</span><h1 style="letter-spacing:.02em">${DS.esc(o.code)}</h1>
            <div class="chips mt8">${DS.stageBadge(o)} ${DS.artBadge(o)} ${DS.payBadge(o)}
              <span class="muted small">criado ${DS.dtTime(o.createdAt)} · atualizado ${DS.timeAgo(o.updatedAt)}</span></div>
          </div>
          <div class="btn-row">
            ${DS.waBtn(`Olá! Sou ${o.customer.name}, pedido ${o.code}. Quero falar sobre este pedido.`, 'Falar com atendente')}
            <button class="btn ghost" id="print">${DS.icon('printer')}<span>Imprimir</span></button>
          </div>
        </div>

        ${o.stage === 'pronto' ? `<div class="alert ok mt16">${DS.icon('check')}<span><b>Seu pedido está pronto para retirada!</b> ${DS.esc((cfg.brand || {}).address || '')} ·
          <a target="_blank" rel="noopener" href="${DS.mapsLink('google')}">Google Maps</a> · <a target="_blank" rel="noopener" href="${DS.mapsLink('apple')}">Apple Maps</a> · ${DS.esc((cfg.brand || {}).hours || '')}</span></div>` : ''}
        ${o.stage === 'entregue' ? `<div class="alert ok mt16">${DS.icon('check')}<span><b>Pedido entregue.</b> Precisa de mais alguma coisa? Abra um chamado abaixo ou chame no WhatsApp.</span></div>` : ''}

        <div class="grid c4 mt16">
          <div class="card mini"><span class="muted small">Data prevista</span><b class="block" style="font-size:1.2rem">${DS.dt(o.predictedDate)}</b><span class="muted small">${DS.esc(o.predictedLabel || '')}</span></div>
          <div class="card mini"><span class="muted small">Peças</span><b class="block" style="font-size:1.2rem">${DS.num(o.totals.qty)}</b><span class="muted small">${o.totals.lines.length} ${DS.plural(o.totals.lines.length, 'item')} · ${(o.techniquesLabel || []).map(DS.esc).join(', ') || 'revenda'}</span></div>
          <div class="card mini"><span class="muted small">Total</span><b class="block" style="font-size:1.2rem">${DS.money(o.totals.total)}</b><span class="muted small">${DS.esc(DS.payMethodName(o.payment.method))}</span></div>
          <div class="card mini"><span class="muted small">Pago / saldo</span><b class="block" style="font-size:1.2rem">${DS.money(o.paid)}</b><span class="muted small">saldo ${DS.money(o.balance)}</span></div>
        </div>

        <div class="card mt16"><h3>${DS.icon('clock')} Etapas do pedido</h3>${DS.stepper({ stage: o.stage, stages: o.stages })}
          <div class="muted small">Prazo contado a partir da arte aprovada e do pagamento autorizado. ${o.editable ? `Você pode alterar o pedido pelo site até ${DS.dt(o.editableUntil)}.` : 'Alterações agora só com o atendente.'}</div>
        </div>

        <div class="grid c2 mt16" style="align-items:start">
          <div>
            <div class="card"><h3>${DS.icon('shirt')} Itens do pedido</h3>
              <div class="items mt12">${items.map(it => {
                const line = (o.totals.lines || []).find(l => l.itemId === it.id) || {};
                return DS.itemSummary(it, items) + (line.breakdown ? `<div class="muted small mt4">${line.breakdown.map(b => DS.esc(b.label) + ': ' + DS.money(b.value) + (b.unit ? '/un' : '')).join(' · ')}</div>` : '');
              }).join('')}</div>
              <div class="row between mt12"><span class="muted">Total com extras</span><b style="font-size:1.2rem">${DS.money(o.totals.total)}</b></div>
              ${o.editable ? `<button class="btn ghost sm mt12" id="edit-items">${DS.icon('edit', 'sm')}<span>Alterar quantidades e itens</span></button>
                <div class="muted small mt4">Você pode alterar este pedido pelo site até ${DS.dt(o.editableUntil)}.</div>` : ''}
            </div>

            <div class="card mt16"><h3>${DS.icon('palette')} Arte do pedido</h3>
              <p class="muted small">Fluxo: você envia a arte principal → o designer confere viabilidade e sangria → a arte final volta para a <b>sua aprovação</b> → aprovada, o pedido entra no lote.</p>
              <div class="grid c2">
                <div class="card mini"><span class="muted small">Arte principal (sua)</span>
                  ${o.art.main ? `<div class="mt4"><a href="${o.art.main.url || '#'}" target="_blank" rel="noopener">${DS.icon('download', 'sm')} ${DS.esc(o.art.main.name)}</a></div><div class="muted small">${DS.dtTime(o.art.main.at)} · ${DS.esc(o.art.main.by || '')}</div>` : '<div class="muted small mt4">Nenhuma arte anexada. Envie abaixo ou no WhatsApp citando ' + DS.esc(o.code) + '.</div>'}
                  <input type="file" class="mt8" id="art-main" accept="image/*,.pdf,.ai,.cdr,.psd,.svg">
                  <button class="btn ghost sm mt8" id="up-main">${DS.icon('upload', 'sm')}<span>Anexar arte</span></button>
                </div>
                <div class="card mini"><span class="muted small">Arte final (designer D-Stamp)</span>
                  ${o.art.final ? `<div class="mt4"><a href="${o.art.final.url || '#'}" target="_blank" rel="noopener">${DS.icon('download', 'sm')} ${DS.esc(o.art.final.name)}</a></div><div class="muted small">${DS.dtTime(o.art.final.at)}</div>` : '<div class="muted small mt4">O designer ainda não enviou a arte final.</div>'}
                  ${o.art.notes ? `<div class="muted small mt8">Nota do designer: ${DS.esc(o.art.notes)}</div>` : ''}
                </div>
              </div>
              ${pendingAppr ? `<div class="card mini mt12" style="border-color:rgba(255,176,32,.5)">
                  <div class="row between wrap-row"><b>${DS.icon('alert', 'sm')} Arte final aguardando SUA aprovação</b><span class="muted small">enviada ${DS.timeAgo(pendingAppr.sentAt)}</span></div>
                  <p class="muted small" style="border-left:3px solid var(--amber);padding-left:10px">“${DS.esc(pendingAppr.message)}”</p>
                  <label class="block">Sua resposta (fica registrada no pedido e vai para o designer)
                    <textarea id="ap-msg" rows="2" placeholder="Ex.: aprovado, pode produzir! / trocar o azul por verde"></textarea></label>
                  <div class="btn-row mt8">
                    <button class="btn" id="ap-ok">${DS.icon('check')}<span>Aprovar arte</span></button>
                    <button class="btn ghost" id="ap-fix">${DS.icon('edit')}<span>Pedir ajuste</span></button>
                  </div>
                </div>` : ''}
              ${(o.art.approvals || []).filter(a => a.decision).length ? `<div class="mt12"><h4>Histórico de aprovações</h4>
                ${(o.art.approvals || []).filter(a => a.decision).map(a => `<div class="line"><b>${a.decision === 'aprovada' ? 'Arte aprovada' : 'Ajuste solicitado'}</b> <span class="muted small">${DS.dtTime(a.decisionAt)} · ${DS.esc(a.decisionMessage || '')}</span></div>`).join('')}</div>` : ''}
            </div>
          </div>

          <div>
            <div class="card"><h3>${DS.icon('money')} Pagamento e comprovantes</h3>
              <div class="kv">
                <b>Forma</b><span>${DS.esc(DS.payMethodName(o.payment.method))}</span>
                <b>Total</b><span>${DS.money(o.totals.total)}</span>
                <b>Recebido</b><span>${DS.money(o.paid)}</span>
                <b>Saldo</b><span>${DS.money(o.balance)}</span>
                <b>Situação</b><span>${DS.payBadge(o)}</span>
              </div>
              <div class="divider"></div>
              <b class="small">Enviar comprovante</b>
              <div class="muted small">Cada comprovante recebe um código (REC-0001, REC-0002…) e é validado pela equipe. Só depois de autorizado o pedido entra no lote.</div>
              <input type="file" id="rc-file" class="mt8" accept="image/*,.pdf">
              <div class="form-grid mt8">
                <label>Valor pago<input id="rc-amount" type="number" step="0.01" min="0" value="${o.balance ? o.balance.toFixed(2) : ''}" placeholder="0,00"></label>
                <label>Forma<select id="rc-method"><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option></select></label>
              </div>
              <button class="btn sm mt8" id="rc-up">${DS.icon('upload', 'sm')}<span>Enviar para validação</span></button>
              <div class="mt12">${(o.payment.receipts || []).length ? (o.payment.receipts || []).map(r => `<div class="line">
                  <div class="row between wrap-row"><b>${DS.esc(r.seq || 'aguardando código')}</b>${DS.badge(({ autorizado: 'Autorizado', em_analise: 'Em análise', recusado: 'Recusado', aguardando_comprovante: 'Aguardando' })[r.status] || r.status, ({ autorizado: '#3DD68C', em_analise: '#38BDF8', recusado: '#FF5C7A' })[r.status] || '#8A93A6')}</div>
                  <div class="muted small">${DS.esc(r.name || '')} · ${DS.money(r.amount || 0)} · ${DS.dtTime(r.uploadedAt)}${r.decidedBy ? ' · validado por ' + DS.esc(r.decidedBy) : ''}</div>
                  ${r.identification ? `<div class="muted small">Identificação enviada ao administrador: ${DS.esc(r.identification)}</div>` : ''}
                  ${r.decisionMessage ? `<div class="muted small">Obs.: ${DS.esc(r.decisionMessage)}</div>` : ''}
                </div>`).join('') : '<div class="muted small">Nenhum comprovante enviado ainda.</div>'}</div>
            </div>

            <div class="card mt16"><h3>${DS.icon('note')} Anotações do pedido</h3>
              <div class="muted small">Tudo que for combinado no WhatsApp pode ficar registrado aqui, indexado ao número ${DS.esc(o.code)}.</div>
              <div class="list mt8">${(o.notes || []).slice().reverse().map(n => `<div class="line"><b>${DS.esc(n.by || 'cliente')}</b> <span class="muted small">${DS.dtTime(n.at)}</span><p class="mb0">${DS.esc(n.text)}</p></div>`).join('') || '<div class="muted small">Sem anotações.</div>'}</div>
              <textarea id="pn-text" rows="2" class="mt8" placeholder="Escrever uma anotação neste pedido"></textarea>
              <button class="btn ghost sm mt8" id="pn-add">${DS.icon('plus', 'sm')}<span>Adicionar</span></button>
            </div>

            <div class="card mt16"><h3>${DS.icon('ticket')} Chamados</h3>
              <div class="muted small">Precisa de alteração, acompanhamento, finalização ou relatar um erro? Abra um chamado numerado e marque <b>urgente</b> se for o caso.</div>
              <div class="form-grid mt12">
                <label>Categoria<select id="tk-cat">${Object.entries(DS.catalog().ticketCategories || {}).map(([k, v]) => `<option value="${k}">${DS.esc(v.label)} (${v.prefix})</option>`).join('')}</select></label>
                <label>Assunto<input id="tk-title" placeholder="Ex.: trocar 20 peças G por GG"></label>
              </div>
              <textarea id="tk-body" rows="2" class="mt8" placeholder="Descreva o que precisa."></textarea>
              <label class="inline-lbl mt8"><input type="checkbox" id="tk-urgent"> Marcar como URGENTE</label>
              <button class="btn sm mt8" id="tk-add">${DS.icon('plus', 'sm')}<span>Abrir chamado</span></button>
              <div class="list mt12">${(o.tickets || []).length ? (o.tickets || []).map(t => `<div class="line">
                  <div class="row between wrap-row"><b>${DS.esc(t.code)}</b>${t.urgent ? DS.badge('URGENTE', '#FF5C7A') : DS.badge(t.status || 'aberto', '#8A93A6')}</div>
                  <div class="muted small">${DS.esc(t.title)} · ${DS.dtTime(t.createdAt || t.at)}</div></div>`).join('') : '<div class="muted small">Nenhum chamado neste pedido.</div>'}</div>
            </div>

            <div class="card mt16"><h3>${DS.icon('map')} Retirada</h3>
              <div class="kv">
                <b>Endereço</b><span>${DS.esc((cfg.brand || {}).address || '')}</span>
                <b>Horário</b><span>${DS.esc((cfg.brand || {}).hours || '')}</span>
                <b>Entrega</b><span>Retirada na loja · envio para outras cidades sob consulta</span>
              </div>
              <div class="btn-row mt12">
                <a class="btn ghost sm" href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.icon('map', 'sm')}<span>Google Maps</span></a>
                <a class="btn ghost sm" href="${DS.mapsLink('apple')}" target="_blank" rel="noopener">${DS.icon('map', 'sm')}<span>Apple Maps</span></a>
              </div>
            </div>
          </div>
        </div>
      </div></section>`;

      /* eventos */
      const q = s2 => el.querySelector(s2);
      q('#print').addEventListener('click', () => DS.printBlock('Pedido ' + o.code, printHtml(o)));
      if (q('#up-main')) q('#up-main').addEventListener('click', async () => {
        const f = q('#art-main').files[0]; if (!f) return DS.toast('Selecione o arquivo da arte.', 'err');
        try { const up = await DS.fileToDataUrl(f); await DS.api('/orders/' + o.code + '/art', { method: 'POST', body: { kind: 'main', upload: up, phone: phone } }); DS.toast('Arte anexada ao pedido.'); reload(); } catch (e) { DS.toastErr(e); }
      });
      if (q('#ap-ok')) q('#ap-ok').addEventListener('click', async () => {
        try { await DS.api('/orders/' + o.code + '/art/decision', { method: 'POST', body: { decision: 'aprovada', message: q('#ap-msg').value.trim(), phone: phone } }); DS.toast('Arte aprovada! Já avisamos a produção.'); reload(); } catch (e) { DS.toastErr(e); }
      });
      if (q('#ap-fix')) q('#ap-fix').addEventListener('click', async () => {
        const msg = q('#ap-msg').value.trim(); if (!msg) return DS.toast('Escreva o ajuste desejado.', 'err');
        try { await DS.api('/orders/' + o.code + '/art/decision', { method: 'POST', body: { decision: 'ajuste', message: msg, phone: phone } }); DS.toast('Ajuste enviado ao designer.'); reload(); } catch (e) { DS.toastErr(e); }
      });
      if (q('#edit-items')) q('#edit-items').addEventListener('click', () => openItemsEditor(o, reload));
      if (q('#rc-up')) q('#rc-up').addEventListener('click', async () => {
        const f = q('#rc-file').files[0]; if (!f) return DS.toast('Anexe o comprovante.', 'err');
        try {
          const up = await DS.fileToDataUrl(f);
          await DS.api('/orders/' + o.code + '/receipts', { method: 'POST', body: { upload: up, amount: Number(q('#rc-amount').value || 0), method: q('#rc-method').value, phone: phone } });
          DS.toast('Comprovante enviado para validação.'); reload();
        } catch (e) { DS.toastErr(e); }
      });
      if (q('#pn-add')) q('#pn-add').addEventListener('click', async () => {
        const text = q('#pn-text').value.trim(); if (!text) return;
        try { await DS.api('/orders/' + o.code + '/notes', { method: 'POST', body: { text: text, phone: phone } }); q('#pn-text').value = ''; reload(); } catch (e) { DS.toastErr(e); }
      });
      if (q('#tk-add')) q('#tk-add').addEventListener('click', async () => {
        const title = q('#tk-title').value.trim(); if (!title) return DS.toast('Informe o assunto do chamado.', 'err');
        try {
          const r = await DS.api('/tickets', { method: 'POST', body: { orderCode: o.code, phone: phone, category: q('#tk-cat').value, title: title, body: q('#tk-body').value.trim(), urgent: q('#tk-urgent').checked } });
          DS.toast('Chamado ' + r.ticket.code + ' aberto. A equipe foi notificada' + (r.ticket.urgent ? ' como URGENTE' : '') + '.'); reload();
        } catch (e) { DS.toastErr(e); }
      });
        DS.dock(`<div class="dt-l"><b>${DS.esc(o.code)}</b><span>${DS.esc(DS.stageName(o.stage))} · previsto ${DS.dt(o.predictedDate)}</span></div>
        <a class="btn sm btn-wa" target="_blank" rel="noopener" href="${DS.waLink('Olá! Pedido ' + o.code + ': ')}">${DS.icon('whats', 'sm')}<span>WhatsApp</span></a>`);
    };
    draw();
  }
  Loja.renderPedidoView = renderPedidoView;

  function printHtml(o) {
    const cfg = DS.config(), b = cfg.brand || {};
    return `<h2>${DS.esc(b.name)} · Pedido ${DS.esc(o.code)}</h2>
      <p>${DS.esc(b.address)}<br>Contato: ${DS.esc(b.whatsappLabel)} · ${DS.esc(b.email)}</p>
      <p><b>Cliente:</b> ${DS.esc(o.customer.name)} · ${DS.esc(o.customer.phone)} · ${DS.esc(o.customer.email || '')}</p>
      <p><b>Previsão:</b> ${DS.dt(o.predictedDate)} (${DS.esc(o.predictedLabel || '')}) · <b>Etapa:</b> ${DS.esc(DS.stageName(o.stage))} · <b>Pagamento:</b> ${DS.esc(DS.payMethodName(o.payment.method))}</p>
      <table><thead><tr><th>Produto</th><th>Técnica</th><th>Detalhes</th><th>Grade/Qtd</th><th>Unit.</th><th>Total</th></tr></thead><tbody>
      ${o.items.map(it => {
        const t = (o.totals.lines.find(l => l.itemId === it.id) || {});
        const grade = DS.gradeText(it) || (DS.num(t.qty || DS.itemQty(it)) + ' un');
        const det = it.mode === 'revenda' ? 'peça lisa' : it.technique === 'total' ? [DS.fabricName(it.fabricId), DS.golaLabel(it), DS.mangaLabel(it)].join(' · ') : DS.colorLabel(it) + ' · ' + DS.printsLabel(it);
        return `<tr><td>${DS.esc(DS.productName(it.productId))}</td><td>${DS.esc(DS.techName(it.mode === 'revenda' ? 'revenda' : it.technique))}</td><td>${DS.esc(det)}</td><td>${DS.esc(grade)}</td><td>${DS.money(t.unit || 0)}</td><td>${DS.money(t.subtotal || 0)}</td></tr>`;
      }).join('')}
      </tbody><tfoot><tr><th colspan="5">Total</th><th>${DS.money(o.totals.total)}</th></tr></tfoot></table>
      <p><b>Recebido:</b> ${DS.money(o.paid)} · <b>Saldo:</b> ${DS.money(o.balance)}</p>
      ${(o.payment.receipts || []).filter(r => r.seq).map(r => `<p class="small">Identificação ${DS.esc(r.seq)} — ${DS.esc(r.identification || '')}</p>`).join('')}`;
  }
  Loja.printHtml = printHtml;

  /* ------------------- alteração pelo cliente (mesma semana) --------------- */
  function openItemsEditor(o, after) {
    const local = { items: JSON.parse(JSON.stringify(o.items)) };
    const m = DS.modal('Alterar itens do pedido ' + o.code, '<div id="ei"></div>', {
      wide: true, footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ei-save">' + DS.icon('check') + '<span>Salvar alterações</span></button>'
    });
    const drawList = () => {
      m.el.querySelector('#ei').innerHTML = local.items.map((it, i) => `
        <div class="card mini mt8"><div class="row between"><b>Item ${i + 1}</b><div class="row gap">
          <button class="icon-btn" data-ed="${i}" aria-label="Editar item">${DS.icon('edit', 'sm')}</button>
          <button class="icon-btn" data-rm="${i}" aria-label="Remover item">${DS.icon('x', 'sm')}</button></div></div>
          ${DS.itemSummary(it, local.items)}</div>`).join('') +
        `<button class="btn ghost sm mt12" id="ei-add">${DS.icon('plus', 'sm')}<span>Adicionar outra modelagem</span></button>
         <div class="alert warn mt12">${DS.icon('alert')}<span>Alterações pelo site só até a data do lote. Se o valor mudar, reenvie o comprovante depois de salvar.</span></div>`;
      m.el.querySelectorAll('[data-ed]').forEach(b2 => b2.addEventListener('click', () => {
        const i = Number(b2.dataset.ed);
        DS.openItemEditor({ item: local.items[i], allItems: local.items, title: 'Editar item', onSave: nv => { local.items[i] = nv; drawList(); } });
      }));
      m.el.querySelectorAll('[data-rm]').forEach(b2 => b2.addEventListener('click', () => { local.items.splice(Number(b2.dataset.rm), 1); drawList(); }));
      m.el.querySelector('#ei-add').addEventListener('click', () => DS.openItemEditor({
        products: DS.products(), item: { productId: (DS.storeProducts()[0] || {}).id }, allItems: local.items, title: 'Novo item',
        onSave: nv => { local.items.push(nv); drawList(); }
      }));
    };
    drawList();
    m.el.querySelector('#ei-save').addEventListener('click', async () => {
      if (!local.items.length) return DS.toast('O pedido precisa de ao menos 1 item.', 'err');
      try {
        await DS.api('/orders/' + o.code + '/client-edit', { method: 'POST', body: { items: local.items, phone: o.customer.phone } });
        m.close(); DS.toast('Pedido atualizado! Reenvie o comprovante se o valor mudou.'); after();
      } catch (e) { DS.toastErr(e); }
    });
  }
  Loja.openItemsEditor = openItemsEditor;
})();
