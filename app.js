/* =========================================================================
   D-Stamp · shell (header, menu mobile, footer, router) + página inicial
   ========================================================================= */
(function () {
  'use strict';
  const DS = window.DS;
  const App = window.App = {};

  const NAV = [
    { href: '#/', k: 'home', label: 'Início', icon: 'store' },
    { href: '#/total', k: 'total', label: 'Estampa total', icon: 'shirt' },
    { href: '#/montar', k: 'montar', label: 'Montar pedido', icon: 'check', hot: true },
    { href: '#/localizada', k: 'localizada', label: 'Localizada / brindes', icon: 'palette' },
    { href: '#/guia', k: 'guia', label: 'Como funciona', icon: 'info' },
    { href: '#/exemplos', k: 'exemplos', label: 'Exemplos', icon: 'grid' },
    { href: '#/acompanhar', k: 'acompanhar', label: 'Meu pedido', icon: 'clock' }
  ];

  /* ------------------------------- HEADER ------------------------------- */
  App.renderHeader = function (current) {
    const cfg = DS.config(), b = cfg.brand || {};
    const c = DS.catalog(), batch = c.batch || {};
    const w = DS.week();
    const cartCount = (window.Loja && Loja.cartCount) ? Loja.cartCount() : 0;
    const team = DS.user();
    const top = document.getElementById('topo');
    top.innerHTML = `
      <div class="top-strip">
        <div class="wrap">
          ${DS.announcements().map(a => `<span>${DS.icon('bell', 'sm')} ${DS.esc(a.text)}</span><span class="dim">·</span>`).join('')}
          <span>${DS.icon('clock', 'sm')} Próxima data disponível: <b>${DS.esc(DS.batchLabel())}</b></span>
          <span class="dim">·</span>
          <span>${DS.weekPill()}${(DS.weekLevel() !== 'fechado' && DS.daysTo(DS.batchDate(0)) != null)
            ? ' <span class="dim">· faltam <b>' + DS.daysTo(DS.batchDate(0)) + '</b> dias</span>' : ''}</span>
          <span class="dim">·</span>
          <span>Prazo <b>${DS.esc(DS.leadTotalLabel())}</b></span>
          ${team ? `<span class="dim">·</span><span class="team-only">${(w.loadTotal || 0)}/${(w.limit || 250)} peças · ${Math.max(0, (w.limit || 250) - (w.loadTotal || 0))} vagas</span>` : ''}
        </div>
      </div>
      <div class="hd">
        <button class="burger" id="burger" aria-label="Abrir menu" aria-expanded="false"><i></i><i></i><i></i></button>
        <a class="logo" href="#/" aria-label="D-Stamp, página inicial">
          <span class="mk">D</span>
          <span>${DS.esc(b.name || 'D-Stamp')}<small>Estamparia · Praia Grande</small></span>
        </a>
        <nav id="mainnav" aria-label="Navegação principal">
          ${NAV.map(n => `<a href="${n.href}" class="${current === n.k ? 'on' : ''}">${DS.esc(n.label)}</a>`).join('')}
        </nav>
        <div class="acts">
          <a class="btn ghost sm" href="#/carrinho" aria-label="Carrinho">${DS.icon('cart', 'sm')}<span class="nowrap">Pedido</span>${cartCount ? `<b class="pill">${cartCount}</b>` : ''}</a>
          <a class="btn btn-wa sm" target="_blank" rel="noopener" href="${DS.waLink('Olá! Vim pelo site da D-Stamp e quero falar sobre estampa.')}">${DS.icon('whats', 'sm')}<span class="nowrap">WhatsApp</span></a>
          ${team ? `<a class="btn soft sm" href="#/painel">${DS.icon('user', 'sm')}<span class="nowrap">Painel</span></a>`
                 : `<a class="btn ghost sm" href="#/painel" title="Área da equipe">${DS.icon('user', 'sm')}</a>`}
        </div>
      </div>
      <div class="mmenu" id="mmenu">
        <div class="grp">Comprar</div>
        ${NAV.map(n => `<a href="${n.href}" class="${current === n.k ? 'on' : ''}">${DS.icon(n.icon, 'sm')}<span>${DS.esc(n.label)}</span>${n.hot ? '<b class="pill lime">checklist</b>' : ''}</a>`).join('')}
        <div class="grp">Loja oficial (peças lisas e insumos)</div>
        <a href="${DS.esc((cfg.store || {}).externalStore || b.site || '#')}" target="_blank" rel="noopener">${DS.icon('store', 'sm')}<span>${DS.esc((cfg.store || {}).externalStoreLabel || 'dstamp.com.br')}</span></a>
        <div class="grp">Atendimento</div>
        <a href="tel:${DS.esc(String(b.whatsapp || '').replace(/\D/g, ''))}">${DS.icon('whats', 'sm')}<span>${DS.esc(b.whatsappLabel || '')}</span></a>
        <a href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.icon('map', 'sm')}<span>${DS.esc(b.address || '')}</span></a>
      </div>`;

    const burger = top.querySelector('#burger');
    burger.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    top.querySelectorAll('#mmenu a, #mainnav a').forEach(a => a.addEventListener('click', () => {
      document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false');
    }));
  };

  /* ------------------------------- FOOTER ------------------------------- */
  App.renderFooter = function () {
    const cfg = DS.config(), b = cfg.brand || {}, st = cfg.store || {};
    const f = document.getElementById('rodape');
    f.innerHTML = `<div class="wrap">
      <div class="f-grid">
        <div class="f-col">
          <a class="logo" href="#/"><span class="mk">D</span><span>${DS.esc(b.name || 'D-Stamp')}<small>Estamparia e confecção</small></span></a>
          <p class="muted small mt12">Estampa total sob encomenda em Dry Fit e Poliflex: camiseta, baby look, regata, regata feminina nadador, machão, infantil e calça capoeira. A partir de 1 peça, sem quantidade mínima.</p>
          <div class="btn-row mt12">
            ${DS.waBtn('Olá! Vim pelo site e quero um orçamento.', 'WhatsApp ' + (b.whatsappLabel || ''), 'sm')}
            <a class="btn ghost sm" href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.icon('map', 'sm')}<span>Google Maps</span></a>
            <a class="btn ghost sm" href="${DS.mapsLink('apple')}" target="_blank" rel="noopener">${DS.icon('map', 'sm')}<span>Apple Maps</span></a>
          </div>
        </div>
        <div class="f-col">
          <h4>Estampa total</h4>
          ${DS.storeProducts().slice(0, 8).map(p => `<a href="#/produto/${p.id}">${DS.esc(p.name)}</a>`).join('')}
          <a href="#/montar"><b>Montar meu pedido</b></a>
        </div>
        <div class="f-col">
          <h4>Como funciona</h4>
          <a href="#/guia#guia-prazo">Prazo e lote de sábado</a>
          <a href="#/guia#guia-preco">Como o preço é formado</a>
          <a href="#/guia#guia-tamanhos">Tamanhos (PP ao G6)</a>
          <a href="#/guia#guia-arte">Como enviar a arte</a>
          <a href="#/guia#guia-pagamento">Pagamento e comprovante</a>
          <a href="#/localizada">Estampa localizada (WhatsApp)</a>
          <a href="#/exemplos">Exemplos prontos</a>
        </div>
        <div class="f-col">
          <h4>Atendimento</h4>
          <a href="#/acompanhar">Acompanhar meu pedido</a>
          <a href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.esc(b.address || '')}</a>
          <a href="#/guia#guia-retirada">${DS.esc(b.hours || 'Horário de atendimento')}</a>
          <a href="mailto:${DS.esc(b.email || '')}">${DS.esc(b.email || '')}</a>
          <a href="${DS.esc(st.externalStore || b.site || '#')}" target="_blank" rel="noopener">Loja oficial: ${DS.esc(st.externalStoreLabel || 'dstamp.com.br')}</a>
          <a href="#/painel">Área da equipe</a>
        </div>
      </div>
      <div class="f-bottom">
        <span>© ${new Date().getFullYear()} ${DS.esc(b.name || 'D-Stamp')} · ${DS.esc(b.city || '')} · CNPJ sob consulta</span>
        <span>PIX 50% + 50% · PIX integral com 5% off · cartão em até 3x</span>
      </div>
    </div>`;
  };

  App.renderFloat = function () {
    if (document.querySelector('.wa-float')) return;
    const a = document.createElement('a');
    a.className = 'wa-float'; a.target = '_blank'; a.rel = 'noopener';
    a.href = DS.waLink('Olá! Vim pelo site da D-Stamp.');
    a.setAttribute('aria-label', 'Falar no WhatsApp');
    a.innerHTML = DS.icon('whats');
    document.body.appendChild(a);
  };

  /* -------------------------------- HOME -------------------------------- */
  App.home = function (el) {
    const cfg = DS.config(), b = cfg.brand || {}, c = DS.catalog(), r = cfg.rules || {}, pr = c.prices || {};
    const dry = ((pr.total || {}).dryfit || []), poly = ((pr.total || {}).poliflex || []);
    const products = DS.storeProducts();
    const w = DS.week();
    const info = b0 => (c.info || []).find(x => x.id === b0) || {};

    el.innerHTML = `
    <!-- HERO -->
    <section class="hero"><div class="wrap">
      <div class="grid grid-hero">
        <div>
          <span class="eyebrow">Estamparia em Praia Grande/SP · desde a primeira peça</span>
          <h1>Sua <span class="grad">estampa total</span> feita sob encomenda, a partir de 1 peça</h1>
          <p class="lead">A peça <b>inteira estampada</b>: frente, costas, mangas e gola. Sem mínimo de quantidade e com o preço na tela antes de enviar.</p>
          <div class="hero-cta">
            <a class="btn big lime" href="#/montar">${DS.icon('check')}<span>Montar meu pedido</span></a>
            <a class="btn big ghost" href="#/total">${DS.icon('shirt')}<span>Ver modelagens e preços</span></a>
            ${DS.waBtn('Olá! Quero fazer camisetas em estampa total. Pode me ajudar?', 'Tirar dúvida no WhatsApp', 'big')}
          </div>
          <div class="stats">
            <div class="stat"><b>${DS.money(dry[1] ? dry[1].price : 50)}</b><span>camiseta Dry Fit acima de 10 peças</span></div>
            <div class="stat"><b>${DS.esc(DS.leadTotalLabel())}</b><span>prazo da estampa total (lote de sábado)</span></div>
            <div class="stat"><b>1 peça</b><span>quantidade mínima: não existe</span></div>
            <div class="stat"><b>PP ao G6</b><span>grade completa + infantil 2 a 14</span></div>
          </div>
        </div>
        <div>
          <div class="hero-art">
            <img src="/img/exemplo-total-1.jpg" alt="Camiseta em estampa total com arte cobrindo frente, costas e mangas">
            <div class="hero-badges">
              <span class="tagchip">${DS.icon('clock', 'sm')} Próxima data: ${DS.esc(DS.batchShort())}</span>
            </div>
          </div>
          <div class="card mini mt12">
            <div class="row between"><b class="small">Próxima data disponível</b><span class="small muted">só estampa total</span></div>
            ${DS.capacityCard()}
          </div>
        </div>
      </div>
    </div></section>

    <!-- PASSO A PASSO -->
    <section class="section"><div class="wrap">
      <span class="eyebrow">Simples assim</span>
      <h2>Como funciona em 5 passos</h2>
      <p class="muted">Você monta, aprova a arte e acompanha até a retirada.</p>
      <div class="grid c3 mt16">
        ${[
          ['Escolha a modelagem', 'Camiseta, baby look, regata, nadador, machão, infantil ou calça capoeira.', 'shirt'],
          ['Monte passo a passo', 'Tecido, gola, manga, tamanhos e arte. O preço aparece na hora.', 'check'],
          ['Aprove a arte', 'Nada vai para produção sem o seu "ok".', 'palette'],
          ['Pague', 'PIX 50% + 50%, PIX integral com 5% off ou cartão em 3x.', 'money'],
          ['Acompanhe e retire', 'Você vê as etapas e é avisado quando ficar pronto.', 'truck']
        ].map(([t, d, i], idx) => `<div class="card hover">
          <div class="row between"><span class="badge" style="--b:#7C5CFF">Passo ${idx + 1}</span>${DS.icon(i)}</div>
          <h3 class="mt8">${DS.esc(t)}</h3><p class="muted small mb0">${DS.esc(d)}</p>
        </div>`).join('')}
        <div class="card" style="background:linear-gradient(140deg,rgba(124,92,255,.22),rgba(34,211,238,.12))">
          <h3>Prefere falar com a gente?</h3>
          <p class="muted small">Localizada, brindes e peça sua: orçamento no WhatsApp em minutos.</p>
          <div class="btn-row">
            <a class="btn sm" href="#/localizada">${DS.icon('palette', 'sm')}<span>Ver localizada</span></a>
            ${DS.waBtn('Olá! Quero um orçamento de estampa localizada.', 'Chamar agora', 'sm')}
          </div>
        </div>
      </div>
    </div></section>

    <!-- VITRINE -->
    <section class="section tight"><div class="wrap">
      <div class="row between wrap-row">
        <div><span class="eyebrow">Vitrine</span><h2 class="mb0">Modelagens em estampa total</h2></div>
        <a class="btn ghost" href="#/total">${DS.icon('grid')}<span>Ver todas</span></a>
      </div>
      <div class="grid-products mt16">${products.slice(0, 8).map(cardProduto).join('')}</div>
    </div></section>

    <!-- TABELA DE PREÇOS -->
    <section class="section"><div class="wrap">
      <div class="grid c2" style="align-items:start">
        <div>
          <span class="eyebrow">Transparência</span>
          <h2>Tabela de preço da estampa total</h2>
          <p class="muted">Mesmo preço em todas as modelagens. O que muda é o tecido e os adicionais.</p>
          ${DS.tableHtml({
            head: ['Tecido', 'Até 10 peças', 'Acima de 10 peças'],
            rows: [
              ['Dry Fit', DS.money(dry[0] ? dry[0].price : 55), DS.money(dry[1] ? dry[1].price : 50)],
              ['Poliflex', DS.money(poly[0] ? poly[0].price : 65), DS.money(poly[1] ? poly[1].price : 60)]
            ]
          })}
          <div class="chips mt12">
            ${(c.totalAddons || []).map(a => `<span class="chip radio">${DS.esc(a.label)} <b>+ ${DS.money(a.price)}</b></span>`).join('')}
            <span class="chip radio">Tamanho acima do GG <b>+ ${DS.money(pr.sizeSurchargeAboveGG || 3)}/tamanho</b></span>
          </div>
          <div class="alert info mt12">${DS.icon('info')}<span><b>Sem quantidade mínima.</b> A faixa de preço muda automaticamente quando o pedido passa de 10 peças do mesmo tecido.</span></div>
        </div>
        <div>
          <div class="card">
            <h3>${DS.icon('ruler')} Tamanhos</h3>
            <p class="muted small mb0">PP ao GG sem acréscimo. Acima do GG (EXG, G1 a G6) soma ${DS.money(pr.sizeSurchargeAboveGG || 3)} por tamanho. Infantil 2 a 14 usa a mesma tabela.</p>
            <a class="btn ghost sm mt12" href="#/guia#guia-tamanhos">${DS.icon('info', 'sm')}<span>Tabela completa e medidas</span></a>
          </div>
          <div class="card mt12">
            <h3>${DS.icon('star')} Extras que agregam valor</h3>
            <div class="chips">${(c.extras || []).map(x => `<span class="chip radio">${DS.esc(x.label)} ${x.price != null ? `<b>+ ${DS.money(x.price)}</b>` : '<span class="muted small">consulta</span>'}</span>`).join('')}</div>
          </div>
        </div>
      </div>
    </div></section>

    <!-- CHECKLIST -->
    <section class="section"><div class="wrap">
      <div class="card pad" style="background:linear-gradient(140deg,rgba(124,92,255,.24),rgba(34,211,238,.10))">
        <div class="grid c2" style="align-items:center">
          <div>
            <span class="eyebrow">Passo a passo</span>
            <h2>Monte o pedido em uma tela por vez</h2>
            <p class="muted">Cada etapa só libera a próxima quando está completa. O preço e a data aparecem o tempo todo.</p>
            <div class="btn-row mt12">
              <a class="btn big lime" href="#/montar">${DS.icon('check')}<span>Começar meu pedido</span></a>
            </div>
          </div>
          <div>
            <ol class="steps-num">
              ${['Modelagem', 'Tecido', 'Gola e manga', 'Tamanhos', 'Arte', 'Extras', 'Seus dados', 'Pagamento', 'Revisar e enviar'].map(t => `<li>${DS.esc(t)}</li>`).join('')}
            </ol>
          </div>
        </div>
      </div>
    </div></section>

    <!-- LOCALIZADA / WHATSAPP -->
    <section class="section"><div class="wrap">
      <div class="grid c2" style="align-items:start">
        <div class="card">
          <span class="eyebrow">Sublimação localizada</span>
          <h3>Peça branca ou clara · 3 a 4 dias</h3>
          <p class="muted small">A tinta entra na fibra do poliéster: toque zero. Se a arte tiver branco, aparece a cor da peça.</p>
          ${DS.tableHtml({ head: ['Estampa', 'Sublimação', 'DTF'], rows: [
            ['10 × 10 cm', DS.money((pr.print || {}).sublimacao ? pr.print.sublimacao['10x10'] : 6.5), DS.money((pr.print || {}).dtf ? pr.print.dtf['10x10'] : 6.5)],
            ['A4', DS.money((pr.print || {}).sublimacao ? pr.print.sublimacao.A4 : 13), DS.money((pr.print || {}).dtf ? pr.print.dtf.A4 : 15)],
            ['A3', DS.money((pr.print || {}).sublimacao ? pr.print.sublimacao.A3 : 16), DS.money((pr.print || {}).dtf ? pr.print.dtf.A3 : 20)]
          ] })}
          <div class="table-note">Só a estampa. A peça lisa é cobrada à parte (branca ${DS.money(15.79)} · preta ${DS.money(18.42)}, só DTF).</div>
        </div>
        <div class="card">
          <span class="eyebrow">DTF têxtil</span>
          <h3>Qualquer cor de peça · 5 a 7 dias</h3>
          <p class="muted small">Funciona em peça escura e aceita detalhe fino. Também estampamos <b>a peça que você trouxer</b>.</p>
          <ul class="bullets">
            <li>${DS.icon('check')}<span>Peça sua ou nossa: camiseta, moletom, boné, ecobag</span></li>
            <li>${DS.icon('check')}<span>Canecas, garrafas e brindes em sublimação</span></li>
          </ul>
          <div class="alert warn">${DS.icon('alert')}<span><b>Orçamento somente pelo WhatsApp.</b> Depende da cor da peça, do tamanho e da posição da estampa.</span></div>
          <div class="btn-row">
            <a class="btn" href="#/localizada">${DS.icon('palette')}<span>Montar mensagem de orçamento</span></a>
            ${DS.waBtn('Olá! Quero orçamento de estampa localizada (sublimação ou DTF).', 'WhatsApp direto')}
          </div>
        </div>
      </div>
    </div></section>

    <!-- EXEMPLOS -->
    <section class="section"><div class="wrap">
      <div class="row between wrap-row"><div><span class="eyebrow">Portfólio</span><h2 class="mb0">Exemplos que já produzimos</h2></div>
      <a class="btn ghost" href="#/exemplos">${DS.icon('grid')}<span>Ver todos</span></a></div>
      <div class="gal mt16">${(cfg.examples || []).slice(0, 3).map(exemploCard).join('')}</div>
    </div></section>

    <!-- PRAZO / LOTE -->
    <section class="section"><div class="wrap">
      <div class="grid c2">
        ${DS.infoBlock(Object.assign({}, info('prazo'), { group: 'Prazo' }))}
        ${DS.infoBlock(Object.assign({}, info('pagamento'), { group: 'Pagamento' }))}
      </div>
      <div class="center mt16"><a class="btn ghost" href="#/guia">${DS.icon('note')}<span>Guia completo</span></a></div>
    </div></section>

    <!-- FAQ -->
    <section class="section"><div class="wrap narrow">
      <span class="eyebrow">Dúvidas</span>
      <h2>Perguntas frequentes</h2>
      <div class="mt16">${(cfg.faq || []).slice(0, 5).map(f => `<details class="faq-item"><summary>${DS.esc(f.q)}${DS.icon('plus', 'sm')}</summary><div class="a">${DS.esc(f.a)}</div></details>`).join('')}</div>
      <div class="center mt16"><a class="btn ghost" href="#/guia">${DS.icon('info')}<span>Ver todas as respostas</span></a></div>
    </div></section>

    <!-- LOCAL -->
    <section class="section"><div class="wrap">
      <div class="card pad">
        <div class="grid c2" style="align-items:center">
          <div>
            <span class="eyebrow">Onde estamos</span>
            <h2 class="mb0">Retirada na loja em Praia Grande</h2>
            <p class="muted mt8">${DS.esc(b.address || '')}<br>${DS.esc(b.hours || '')}</p>
            <div class="kv mt12">
              <b>WhatsApp</b><span>${DS.esc(b.whatsappLabel || '')}</span>
              <b>E-mail</b><span>${DS.esc(b.email || '')}</span>
              <b>Entrega</b><span>Retirada na loja · envio para outras cidades sob consulta</span>
              <b>Loja oficial</b><span><a href="${DS.esc((cfg.store || {}).externalStore || '#')}" target="_blank" rel="noopener">${DS.esc((cfg.store || {}).externalStoreLabel || 'dstamp.com.br')}</a> (peças lisas, insumos e brindes)</span>
            </div>
            <div class="btn-row mt16">
              <a class="btn" href="${DS.mapsLink('google')}" target="_blank" rel="noopener">${DS.icon('map')}<span>Abrir no Google Maps</span></a>
              <a class="btn ghost" href="${DS.mapsLink('apple')}" target="_blank" rel="noopener">${DS.icon('map')}<span>Abrir no Apple Maps</span></a>
              ${DS.waBtn('Olá! Quero confirmar o endereço e o horário de retirada.', 'Falar com a loja')}
            </div>
          </div>
          <div class="hero-art" style="aspect-ratio:4/3">
            <img src="/img/hero-estamparia.jpg" alt="Atelier de estamparia D-Stamp">
          </div>
        </div>
      </div>
    </div></section>`;
  };

  /* cards reutilizáveis */
  function cardProduto(p) {
    const from = DS.fromPrice(p);
    const specs = [];
    if ((p.collar || []).length) specs.push(p.collar.map(c => DS.collarName(c)).join(' ou '));
    if ((p.sleeve || []).length) specs.push(p.sleeve.map(s => DS.sleeveName(s)).join(' ou '));
    const sizes = DS.sizesFor(p.id, 'total', 'estampa');
    if (sizes.length) specs.push(sizes[0] + ' ao ' + sizes[sizes.length - 1]);
    return `<a class="p-card" href="#/produto/${p.id}">
      <div class="p-art">${p.img ? `<img src="${DS.esc(p.img)}" alt="${DS.esc(p.name)} em estampa total" loading="lazy">` : `<div class="ph">${DS.icon('shirt')}</div>`}
        ${p.badge ? `<span class="p-flag ${p.badge === 'Mais vendida' ? 'hot' : ''}">${DS.esc(p.badge)}</span>` : ''}</div>
      <div class="p-body">
        <h3>${DS.esc(p.name)}</h3>
        <p class="desc">${DS.esc(p.short || '')}</p>
        <div class="p-specs">${specs.map(s => `<span>${DS.esc(s)}</span>`).join('')}</div>
        <div class="p-foot">
          <span class="price">${p.priceOnRequest ? 'Sob consulta' : DS.money(from)}<small>${p.priceOnRequest ? 'WhatsApp' : 'a partir de · peça estampada'}</small></span>
          <span class="btn sm">${DS.icon('check', 'sm')}<span>Montar</span></span>
        </div>
      </div>
    </a>`;
  }
  App.cardProduto = cardProduto;

  function exemploCard(ex) {
    return `<article class="gal-card">
      <div class="im">${ex.img ? `<img src="${DS.esc(ex.img)}" alt="${DS.esc(ex.title)}" loading="lazy">` : ''}</div>
      <div class="bd">
        <span class="badge" style="--b:${ex.technique === 'total' ? '#7C5CFF' : '#22D3EE'}">${DS.esc(DS.techShort(ex.technique))}</span>
        <h3>${DS.esc(ex.title)}</h3>
        <p class="muted small">${DS.esc(ex.desc)}</p>
        <div class="meta">${['product', 'qty', 'leadTime'].map(k => ex[k] ? `<span>${DS.esc(ex[k])}</span>` : '').join('')}</div>
        <div class="mt8">${ex.technique === 'total' ? `<a class="btn sm" href="#/montar">${DS.icon('check', 'sm')}<span>Quero igual</span></a>`
          : `<a class="btn btn-wa sm" target="_blank" rel="noopener" href="${DS.waLink('Olá! Vi o exemplo "' + ex.title + '" no site e quero um orçamento igual.')}">${DS.icon('whats', 'sm')}<span>Orçamento</span></a>`}</div>
      </div>
    </article>`;
  }
  App.exemploCard = exemploCard;

  /* -------------------------------- ROUTER ------------------------------- */
  const ROUTES = [
    { re: /^#?\/?$/, name: 'home' },
    { re: /^#\/total$/, name: 'total' },
    { re: /^#\/produto\/([^/]+)$/, name: 'produto' },
    { re: /^#\/montar$/, name: 'montar' },
    { re: /^#\/montar\/([^/]+)$/, name: 'montar' },
    { re: /^#\/localizada$/, name: 'localizada' },
    { re: /^#\/guia$/, name: 'guia' },
    { re: /^#\/exemplos$/, name: 'exemplos' },
    { re: /^#\/carrinho$/, name: 'carrinho' },
    { re: /^#\/acompanhar$/, name: 'acompanhar' },
    { re: /^#\/pedido\/([^/]+)$/, name: 'pedido' },
    { re: /^#\/painel(?:\/([^/]*))?(?:\/([^/]*))?$/, name: 'painel' }
  ];

  /* aceita âncora secundária: #/guia#guia-preco */
  App.parse = function (hash) {
    const parts = String(hash || location.hash || '#/').split('#').filter(x => x !== '');
    const path = '#' + (parts[0] || '/');
    const anchor = parts[1] || '';
    for (const r of ROUTES) {
      const m = path.match(r.re);
      if (m) return { name: r.name, params: m.slice(1).filter(x => x !== undefined), anchor: anchor, path: path };
    }
    return { name: '404', params: [], anchor: anchor, path: path };
  };

  App.route = async function () {
    const el = document.getElementById('conteudo');
    const r = App.parse(location.hash);
    document.body.classList.remove('menu-open');
    DS.clearDock();
    el.innerHTML = '<section class="section"><div class="wrap"><div class="card center muted">Carregando…</div></div></section>';
    try { await DS.boot(); } catch (e) {
      el.innerHTML = `<section class="section"><div class="wrap narrow"><div class="alert err">${DS.icon('alert')}<span>Não foi possível carregar os dados: ${DS.esc(e.message)}</span></div></div></section>`;
      return;
    }
    App.renderHeader(r.name === 'painel' ? 'painel' : r.name);
    App.renderFooter();
    App.renderFloat();

    if (r.name === 'painel') { window.scrollTo(0, 0); return Painel.mount(el, r.params[0] || '', r.params[1] || ''); }
    if (r.name === '404') {
      el.innerHTML = `<section class="section"><div class="wrap narrow center">
        <span class="eyebrow">Página não encontrada</span><h1>Ops, esse endereço não existe</h1>
        <p class="muted">Volte para o início ou monte seu pedido pelo checklist.</p>
        <div class="btn-row" style="justify-content:center"><a class="btn" href="#/">Ir para o início</a><a class="btn lime" href="#/montar">Montar pedido</a></div>
      </div></section>`;
      return;
    }
    window.scrollTo(0, 0);
    try {
      await Loja.mount(el, r.name, r.params[0] || '');
    } catch (e) {
      console.error('[rota ' + r.name + ']', e);
      el.innerHTML = `<section class="section"><div class="wrap narrow">
        <div class="alert err">${DS.icon('alert')}<span>Não consegui abrir esta tela: ${DS.esc(e && e.message || e)}</span></div>
        <a class="btn" href="#/">${DS.icon('chevron')}<span>Voltar para o início</span></a></div></section>`;
    }
    if (r.anchor) setTimeout(() => {
      const t = document.getElementById(r.anchor);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', App.route);
    App.route();
  });
  window.addEventListener('resize', () => { if (document.getElementById('dock').innerHTML) DS.dock(document.getElementById('dock').innerHTML); });
})();
