/* =========================================================================
   D-Stamp · PAINEL DA EQUIPE
   Perfis: administrador · atendente · designer
   ========================================================================= */
(function () {
  'use strict';
  const DS = window.DS;
  const Painel = window.Painel = {};

  const ROLE_LABEL = { admin: 'Administrador', atendente: 'Atendente', designer: 'Designer' };

  Painel.mount = async function (el, sub, arg) {
    const user = DS.user();
    if (!user || !DS.token()) return renderLogin(el);
    try { await DS.boot(); } catch (e) { DS.setSession(null, null); return renderLogin(el); }
    Painel.nav = sub || '';
    renderShell(el, sub, arg);
  };

  /* ------------------------------- LOGIN ------------------------------- */
  function renderLogin(el) {
    el.innerHTML = `
      <section class="section"><div class="wrap narrow">
        <div class="card login">
          <span class="eyebrow">Área da equipe</span>
          <h1>Painel D-Stamp</h1>
          <p class="muted">Atendimento, designer e administrador. Cada perfil vê e altera o que precisa.</p>
          <div class="form-grid mt16">
            <label>E-mail<input id="lg-email" placeholder="atendente@dstamp.com.br" autocomplete="username"></label>
            <label>Senha<input id="lg-pass" type="password" placeholder="••••••" autocomplete="current-password"></label>
          </div>
          <div id="lg-err" class="mt8"></div>
          <button class="btn big w100 mt12" id="lg-go">${DS.icon('user')}<span>Entrar no painel</span></button>
          <div class="card mini mt16">
            <b>Acessos de demonstração</b>
            <div class="small muted">Admin: admin@dstamp.com.br / admin123<br>Atendente: atendente@dstamp.com.br / atende123<br>Designer: designer@dstamp.com.br / arte123</div>
          </div>
        </div>
      </div></section>`;
    const go = async () => {
      try {
        const r = await DS.api('/auth/login', { method: 'POST', body: { email: el.querySelector('#lg-email').value, password: el.querySelector('#lg-pass').value } });
        DS.setSession(r.token, r.user);
        DS.resetBoot();
        DS.toast('Bem-vindo, ' + r.user.name + ' (' + ROLE_LABEL[r.user.role] + ')');
        location.hash = '#/painel';
        Painel.mount(el, '');
      } catch (e) {
        el.querySelector('#lg-err').innerHTML = `<div class="alert err">${DS.icon('alert')}<span>${DS.esc(e.message)}</span></div>`;
      }
    };
    el.querySelector('#lg-go').addEventListener('click', go);
    el.querySelector('#lg-pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    el.querySelector('#lg-email').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  /* ------------------------------- SHELL ------------------------------- */
  function renderShell(el, sub, arg) {
    const u = DS.user();
    const tabs = [
      { k: '', l: 'Painel', roles: ['admin', 'atendente', 'designer'] },
      { k: 'pedidos', l: 'Pedidos', roles: ['admin', 'atendente', 'designer'] },
      { k: 'lotes', l: 'Lotes', roles: ['admin', 'atendente'] },
      { k: 'comprovantes', l: 'Comprovantes', roles: ['admin', 'atendente'] },
      { k: 'chamados', l: 'Chamados', roles: ['admin', 'atendente', 'designer'] },
      { k: 'clientes', l: 'Clientes', roles: ['admin', 'atendente'] },
      { k: 'designer', l: 'Ficha do designer', roles: ['admin', 'atendente', 'designer'] },
      { k: 'admin', l: 'Administração', roles: ['admin'] }
    ].filter(t => t.roles.includes(u.role));

    el.innerHTML = `
      <section class="section painel"><div class="wrap wide">
        <div class="painel-head">
          <div class="row between wrap-row">
            <div>
              <span class="eyebrow">Painel da equipe · ${DS.esc(ROLE_LABEL[u.role])}</span>
              <h1>${DS.esc(u.name)}</h1>
            </div>
            <div class="row gap">
              <button class="btn ghost" id="pf-bell">${DS.icon('bell')}<span>Notificações</span><b class="pill" id="pf-count">0</b></button>
              <button class="btn ghost" id="pf-loggout">${DS.icon('x')}<span>Sair</span></button>
            </div>
          </div>
          <nav class="tabs">${tabs.map(t => `<a class="tab ${Painel.nav === t.k ? 'on' : ''}" href="#/painel${t.k ? '/' + t.k : ''}">${DS.esc(t.l)}</a>`).join('')}</nav>
        </div>
        <div id="painel-week"></div>
        <div id="painel-body"></div>
      </div></section>`;

    el.querySelector('#pf-loggout').addEventListener('click', async () => {
      try { await DS.api('/auth/logout', { method: 'POST' }); } catch (e) {}
      DS.setSession(null, null); DS.resetBoot();
      location.hash = '#/painel'; renderLogin(el);
    });
    el.querySelector('#pf-bell').addEventListener('click', () => showNotifications());
    loadNotifications(el);

    Painel.renderWeekStrip(el.querySelector('#painel-week'));
    const body = el.querySelector('#painel-body');
    const map = {
      '': Painel.renderDashboard, 'pedidos': Painel.renderPedidos, 'pedido': Painel.renderPedido,
      'lotes': Painel.renderLotes,
      'comprovantes': Painel.renderComprovantes, 'chamados': Painel.renderChamados,
      'clientes': Painel.renderClientes, 'designer': Painel.renderDesigner, 'admin': Painel.renderAdmin
    };
    const fn = map[sub] || Painel.renderDashboard;
    if (['comprovantes', 'clientes'].includes(sub) && u.role === 'designer') { body.innerHTML = '<div class="alert warn">Seu perfil (designer) não tem acesso a esta aba.</div>'; return; }
    if (sub === 'admin' && u.role !== 'admin') { body.innerHTML = '<div class="alert warn">Somente o perfil administrador acessa a Administração.</div>'; return; }
    fn(body, arg);
  }

  async function loadNotifications(el) {
    try {
      const r = await DS.api('/notifications?role=' + (DS.user().role));
      const c = el.querySelector('#pf-count');
      if (c) { c.textContent = r.unread; c.classList.toggle('hide', !r.unread); }
      Painel._notifications = r.notifications;
    } catch (e) {}
  }
  async function showNotifications() {
    const list = Painel._notifications || [];
    const m = DS.modal('Notificações da equipe', list.length ? `<div class="list">${list.map(n => `
      <div class="line ${n.read ? '' : 'unread'}">
        <div class="row between"><b>${DS.esc(n.title)}</b><span class="muted small">${DS.timeAgo(n.createdAt)}</span></div>
        <div class="muted small">${DS.esc(n.body || '')}</div>
        ${n.orderCode ? `<a class="small" href="#/painel/pedido/${encodeURIComponent(n.orderCode)}" data-close>abrir pedido ${DS.esc(n.orderCode)} →</a>` : ''}
      </div>`).join('')}</div>` : '<p class="muted">Sem notificações.</p>',
      { footer: '<button class="btn ghost" data-close>Fechar</button><button class="btn" id="nt-read">Marcar todas como lidas</button>' });
    m.el.querySelector('#nt-read').addEventListener('click', async () => {
      await DS.api('/notifications/read', { method: 'POST', body: {} });
      DS.toast('Notificações marcadas como lidas.');
      m.close();
      location.reload();
    });
  }

  /* ------------------------------ LOTES ---------------------------------- */
  /* Lotes subsequentes: só o lote atual recebe pedidos. O cliente não consegue
     comprar hoje para receber em um lote futuro. */
  Painel.renderLotes = async function (body) {
    let k;
    try { k = await DS.api('/kpis'); } catch (e) { body.innerHTML = '<div class="alert err">Sem acesso aos indicadores.</div>'; return; }
    const cfg = DS.config();
    const limit = (k.week || {}).limit || ((cfg.capacity || {}).totalPerWeek) || 250;
    const b = DS.catalog().batch || {};
    const base = b.nextDate ? new Date(b.nextDate) : new Date();
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push({ d: new Date(base.getTime() + i * 7 * 864e5), atual: i === 0 });
    const used = (k.week || {}).loadTotal || 0;
    body.innerHTML = `
      <div class="card"><h3>${DS.icon('layers')} Lotes de estampa total (sábados)</h3>
        <div class="alert info mt8">${DS.icon('info')}<span>Os lotes são <b>subsequentes</b>: só o lote da data atual recebe pedidos. O cliente <b>não consegue comprar hoje para receber em um lote futuro</b> — quando o lote atual enche, o site passa a oferecer a próxima data.</span></div>
        <div class="table-scroll mt12"><table class="tbl">
          <thead><tr><th>Lote (sábado)</th><th>Situação</th><th>Peças</th><th>Vagas</th><th>Pedidos</th><th>Observação</th></tr></thead>
          <tbody>
          ${rows.map(r => `<tr class="${r.atual ? 'urgent-row' : ''}">
              <td><b>${DS.esc(r.d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }))}</b></td>
              <td>${r.atual ? '<span class="pill lime">Recebendo pedidos</span>' : '<span class="pill">Previsto</span>'}</td>
              <td>${r.atual ? `<b>${DS.num(used)}</b> / ${DS.num(limit)}` : '—'}</td>
              <td>${r.atual ? `<b>${DS.num(Math.max(0, limit - used))}</b>` : '—'}</td>
              <td>${r.atual ? DS.num((k.week || {}).orders || 0) : '—'}</td>
              <td class="muted small">${r.atual ? 'Data mostrada ao cliente como “próxima data disponível”.' : 'Abre para pedidos quando o lote anterior fechar.'}</td>
            </tr>`).join('')}
          </tbody></table></div>
        <div class="muted small mt12">Lote atual configurado em Administração → Lote, janela e prazos. Prazo de produção: ${DS.esc(DS.leadTotalLabel())} após arte aprovada e pagamento.</div>
      </div>`;
  };

  /* ------------------------- SEMANA DISPONÍVEL -------------------------- */
  /* Bloco fixo acima de todas as abas: janela de estampa total, lote atual e próximo lote.
     Os números de peças aparecem SOMENTE aqui (a equipe) — o cliente vê nível + data. */
  Painel.renderWeekStrip = async function (host) {
    if (!host) return;
    let k;
    try { k = await DS.api('/kpis'); } catch (e) { return; }
    if (!host.isConnected) return;
    const cfg = DS.config(), w = k.week || {};
    const limit = w.limit || ((cfg.capacity || {}).totalPerWeek) || 250;
    const used = w.loadTotal || 0;
    const vagas = Math.max(0, limit - used);
    const pct = Math.min(100, Math.round((used / (limit || 1)) * 100));
    const lvl = pct >= 100 ? 'fechado' : pct >= 80 ? 'ultimas' : 'aberto';
    const batch = DS.catalog().batch || {};
    const loteAtual = batch.nextDate ? new Date(batch.nextDate) : null;
    const loteSeguinte = loteAtual ? new Date(loteAtual.getTime() + 7 * 864e5) : null;
    host.innerHTML = `
      <div class="week-top mt16">
        <div>
          <div class="wt-h">
            <h3>${DS.icon('layers')} Semana disponível · estampa total</h3>
            ${DS.weekPill(lvl)}
            <a class="btn ghost sm" href="#/painel/admin/producao">${DS.icon('edit', 'sm')}<span>Lote e janela</span></a>
          </div>
          <div class="bar lvl-${lvl}"><i style="width:${pct}%"></i></div>
          <div class="muted small">Semana ${DS.esc(w.id || '')} · <b>${DS.num(used)} de ${DS.num(limit)} peças</b> usadas · ${DS.num(w.orders || 0)} ${DS.plural(w.orders || 0, 'pedido')} na semana.</div>
          <div class="muted small">Lote atual (sábado): <b>${DS.esc(DS.batchShort())}</b>${loteSeguinte ? ' · se lotar, o próximo é <b>' + DS.esc(loteSeguinte.toLocaleDateString('pt-BR')) + '</b>' : ''} · prazo ${DS.esc(DS.leadTotalLabel())} após arte aprovada + pagamento autorizado.</div>
        </div>
        <div class="wt-nums">
          <div class="wt-n"><span>Peças usadas</span><b>${DS.num(used)}</b></div>
          <div class="wt-n"><span>Vagas livres</span><b>${DS.num(vagas)}</b></div>
          <div class="wt-n"><span>Pedidos na semana</span><b>${DS.num(w.orders || 0)}</b></div>
          <div class="wt-n"><span>Ocupação</span><b>${pct}%</b></div>
        </div>
      </div>`;
  };

  /* ------------------------------ DASHBOARD ---------------------------- */
  Painel.renderDashboard = async function (body) {
    const k = await DS.api('/kpis');
    const stages = DS.catalog().stages || [];
    body.innerHTML = `
      <div class="cards-3">
        <div class="card mini"><span class="muted small">Pedidos abertos</span><b class="big">${k.open}</b><span class="muted small">${k.orders} no total · ${k.pieces} peças</span></div>
        <div class="card mini"><span class="muted small">Faturamento em carteira</span><b class="big">${DS.money(k.revenue)}</b><span class="muted small">autorizado ${DS.money(k.paid)}</span></div>
        <div class="card mini ${k.receiptsPending ? 'accent' : ''}"><span class="muted small">Comprovantes aguardando conferência</span><b class="big">${k.receiptsPending}</b><a class="small" href="#/painel/comprovantes">conferir agora →</a></div>
      </div>
      <div class="cards-3 mt16">
        <div class="card mini"><span class="muted small">Artes pendentes</span><b class="big">${k.artPending}</b><span class="muted small">conferir, enviar para aprovação</span></div>
        <div class="card mini ${k.urgentTickets ? 'accent' : ''}"><span class="muted small">Chamados urgentes abertos</span><b class="big">${k.urgentTickets}</b><a class="small" href="#/painel/chamados">ver chamados →</a></div>
        <div class="card mini"><span class="muted small">Prontos para retirada</span><b class="big">${k.ready}</b><span class="muted small">avisar cliente no WhatsApp</span></div>
      </div>

      <div class="card mt24"><h3>Fluxo por etapa</h3>
        <div class="kanban mt12">${k.byStage.map(s => `
          <a class="kb" href="#/painel/pedidos?stage=${s.stage}"><span class="muted small">${DS.esc(s.label)}</span><b>${s.count}</b></a>`).join('')}</div>
      </div>

      <div class="grid-2 mt24">
        <div class="card"><h3>Produção por técnica</h3>
          <table class="tbl mt12"><thead><tr><th>Técnica</th><th>Pedidos</th><th>Peças</th></tr></thead><tbody>
          ${k.byTechnique.map(t => `<tr><td>${DS.esc(t.label)}</td><td>${t.orders}</td><td><b>${t.pieces}</b></td></tr>`).join('')}
          </tbody></table>
          <div class="muted small mt8">Personalização Total limitada a ${k.week.limit} peças por semana (abadás, times, eventos).</div>
        </div>
        <div class="card"><h3>Ações rápidas</h3>
          <div class="row gap wrap-row mt12">
            <a class="btn ghost" href="#/painel/comprovantes">${DS.icon('money')}<span>Validar comprovantes</span></a>
            <a class="btn ghost" href="#/painel/chamados">${DS.icon('ticket')}<span>Chamados</span></a>
            <a class="btn ghost" href="#/painel/designer">${DS.icon('palette')}<span>Ficha do designer</span></a>
            <a class="btn ghost" href="#/painel/pedidos">${DS.icon('search')}<span>Buscar pedido</span></a>
            <button class="btn ghost" id="dl-olist">${DS.icon('download')}<span>Exportar Olist (CSV)</span></button>
            <button class="btn ghost" id="dl-sys">${DS.icon('download')}<span>Exportar Sysloja (CSV)</span></button>
          </div>
          <div class="muted small mt12">Comprovantes autorizados geram identificação automática (<b>REC-0000</b>) enviada ao administrador — com o comprovante anexado ao pedido.</div>
        </div>
      </div>`;
    body.querySelector('#dl-olist').addEventListener('click', () => downloadCsv('olist'));
    body.querySelector('#dl-sys').addEventListener('click', () => downloadCsv('sysloja'));
  };

  async function downloadCsv(target) {
    try {
      const r = await fetch('/api/export/' + target + '.csv', { headers: { Authorization: 'Bearer ' + DS.token() } });
      if (!r.ok) throw new Error('Falha ao exportar');
      const txt = await r.text();
      const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'dstamp-' + target + '.csv'; a.click();
      URL.revokeObjectURL(url);
      DS.toast('Planilha ' + target.toUpperCase() + ' gerada (separador ; · UTF-8).');
    } catch (e) { DS.toastErr(e); }
  }

  /* ------------------------------- PEDIDOS ------------------------------ */
  Painel.renderPedidos = async function (body, arg) {
    const u = DS.user();
    const state = { q: '', stage: '', technique: '', art: '' };
    body.innerHTML = `
      <div class="card">
        <div class="row between wrap-row">
          <h3>Pedidos</h3>
          <div class="row gap wrap-row">
            <input id="f-q" placeholder="Buscar por número, cliente, telefone ou e-mail">
            <select id="f-stage"><option value="">Todas as etapas</option>${(DS.catalog().stages || []).map(s => `<option value="${s.id}">${DS.esc(s.label)}</option>`).join('')}</select>
            <select id="f-tech"><option value="">Todas as técnicas</option><option value="total">Personalização Total</option><option value="sublimacao_localizada">Sublimação localizada</option><option value="dtf">DTF Têxtil</option></select>
            <select id="f-art"><option value="">Arte (todas)</option><option value="pendente">não enviada</option><option value="em_analise">em análise</option><option value="aguardando_aprovacao">aguardando cliente</option><option value="ajuste_solicitado">ajuste solicitado</option><option value="aprovada">aprovada</option></select>
            <button class="btn ghost" id="f-clear">Limpar</button>
          </div>
        </div>
        <div id="pl" class="mt16"></div>
      </div>`;
    if (u.role === 'designer') body.querySelector('#f-art').value = 'em_analise';

    const load = async () => {
      const qs = new URLSearchParams();
      Object.entries(state).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const r = await DS.api('/orders?' + qs.toString());
      const list = r.orders;
      body.querySelector('#pl').innerHTML = list.length ? `
        <div class="table-scroll"><table class="tbl">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Técnica</th><th>Peças</th><th>Valor</th><th>Etapa</th><th>Arte</th><th>Pagamento</th><th>Previsão</th><th></th></tr></thead>
          <tbody>${list.map(o => `
            <tr>
              <td><b>${DS.esc(o.code)}</b><div class="muted small">${DS.dt(o.createdAt)}</div></td>
              <td>${DS.esc(o.customer.name)}<div class="muted small">${DS.esc(o.customer.phone)}</div></td>
              <td>${o.techniques.map(t => DS.esc(DS.techShort(t))).join(' + ')}<div class="muted small">${o.items.map(i => DS.esc(DS.productName(i.productId))).join(', ')}</div></td>
              <td><b>${o.qtyTotal}</b></td>
              <td>${DS.money(o.totals.total)}<div class="muted small">pago ${DS.money(o.paid)}</div></td>
              <td>${DS.stageBadge(o)}</td>
              <td>${DS.artBadge(o)}</td>
              <td>${DS.payBadge(o)}</td>
              <td>${DS.dt(o.predictedDate)}<div class="muted small">${DS.esc(o.predictedLabel || '')}</div></td>
              <td class="row gap">
                <a class="btn small" href="#/painel/pedido/${encodeURIComponent(o.code)}">Abrir</a>
                ${DS.waBtn(`Olá ${o.customer.name}! Aqui é a D-Stamp, sobre o pedido ${o.code}:`, 'WhatsApp', 'btn ghost small')}
              </td>
            </tr>`).join('')}</tbody></table></div>
        <div class="muted small mt8">${list.length} pedido(s) · janela desta semana: ${r.week.load}/${r.week.limit} peças de estampa total</div>`
        : '<div class="empty small">Nenhum pedido encontrado com esses filtros.</div>';
    };
    body.querySelector('#f-q').addEventListener('input', e => { state.q = e.target.value; load(); });
    ['stage', 'tech', 'art'].forEach(k => {
      body.querySelector('#f-' + k).addEventListener('change', e => { state[k === 'tech' ? 'technique' : k] = e.target.value; load(); });
    });
    body.querySelector('#f-clear').addEventListener('click', () => { state.q = state.stage = state.technique = state.art = ''; body.querySelectorAll('input,select').forEach(x => { if (x.tagName === 'SELECT') x.value = ''; else if (x.id === 'f-q') x.value = ''; }); load(); });

    const hashQuery = new URLSearchParams((location.hash.split('?')[1] || ''));
    if (hashQuery.get('stage')) { state.stage = hashQuery.get('stage'); body.querySelector('#f-stage').value = state.stage; }
    load();
  };

  /* --------------------- PEDIDO (visão da equipe) ---------------------- */
  Painel.renderPedido = async function (body, code) {
    const u = DS.user();
    const state = { tab: 'pedido' };
    let o = null;
    const load = async () => {
      const r = await DS.api('/orders/' + encodeURIComponent(code) + '/view', { method: 'POST', body: {} });
      o = r.order;
    };
    await load();

    const draw = () => {
      const items = o.items;
      body.innerHTML = `
        <div class="row between wrap-row">
          <div>
            <a class="small muted" href="#/painel/pedidos">← todos os pedidos</a>
            <h2 class="code">${DS.esc(o.code)} <span class="muted small">${DS.esc(o.customer.name)} · ${DS.esc(o.customer.phone)}</span></h2>
            <div class="row gap wrap-row mt8">${DS.stageBadge(o)} ${DS.artBadge(o)} ${DS.payBadge(o)} ${DS.badge(o.weekId, '#818CF8')} <span class="muted small">Total ${DS.money(o.totals.total)} · pago ${DS.money(o.paid)} · saldo ${DS.money(o.balance)} · previsão ${DS.dt(o.predictedDate)}</span></div>
          </div>
          <div class="row gap wrap-row">
            ${DS.waBtn(`Olá ${o.customer.name}! D-Stamp aqui, sobre o pedido ${o.code}: `, 'WhatsApp cliente', 'btn wa')}
            <button class="btn ghost" id="p-print">${DS.icon('printer')}<span>Imprimir</span></button>
          </div>
        </div>
        <nav class="tabs mt16">
          ${[['pedido', 'Pedido e dados'], ['comprovantes', 'Comprovantes'], ['arte', 'Arte'], ['notas', 'Anotações'], ['chamados', 'Chamados'], ['ficha', 'Ficha técnica']]
            .filter(([k]) => u.role !== 'designer' || ['arte', 'ficha', 'notas'].includes(k))
            .map(([k, l]) => `<button class="tab ${state.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
        </nav>
        <div id="p-body" class="mt16"></div>`;
      body.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; draw(); }));
      body.querySelector('#p-print').addEventListener('click', () => DS.printBlock('Pedido ' + o.code, window.Loja.printHtml(o)));

      const host = body.querySelector('#p-body');
      if (state.tab === 'pedido') tabPedido(host, o, load, draw);
      if (state.tab === 'comprovantes') tabComprovantes(host, o, load, draw);
      if (state.tab === 'arte') tabArte(host, o, load, draw);
      if (state.tab === 'notas') tabNotas(host, o, load, draw);
      if (state.tab === 'chamados') tabChamados(host, o, load, draw);
      if (state.tab === 'ficha') tabFicha(host, o);
    };
    draw();
  };

  /* --- aba: pedido --- */
  function tabPedido(host, o, reload, redraw) {
    const c = DS.catalog();
    const printsText = i => (i.prints || []).map(p => p.size + (p.position ? '(' + p.position + ')' : '')).join(', ');
    const parsePrints = txt => String(txt || '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const m = x.match(/^([0-9A-Za-z×x]+)\s*(?:\((.*)\))?$/);
      return m ? { size: m[1], position: (m[2] || '').trim() } : { size: x, position: '' };
    });
    const card = (i) => {
      const t = o.totals.lines.find(l => l.itemId === i.id) || {};
      const sizes = DS.sizesFor(i.productId, i.technique, i.mode);
      const prod = DS.product(i.productId);
      const isTotal = i.mode !== 'revenda' && i.technique === 'total';
      const isRevenda = i.mode === 'revenda';
      return `<div class="card mini mt12" data-item="${i.id}">
        <div class="row between"><b>Item ${i.id.slice(-4)} · ${DS.esc(DS.productName(i.productId))}</b>
          <div class="row gap">
            <span class="muted small">${DS.num(t.qty || 0)} un · ${t.onRequest ? 'sob consulta' : DS.money(t.unit || 0) + '/un'} · ${DS.money(t.subtotal || 0)}</span>
            <button class="icon-btn" data-edit-item="${i.id}">${DS.icon('edit')}</button>
            <button class="icon-btn danger" data-del-item="${i.id}">${DS.icon('x')}</button>
          </div>
        </div>
        <div class="grid-2 mt8">
          <label>Como saiu<select data-item="${i.id}" data-field="mode">
            <option value="estampa" ${!isRevenda ? 'selected' : ''}>Estampado</option>
            <option value="revenda" ${isRevenda ? 'selected' : ''}>Peça lisa (revenda)</option></select></label>
          <label>Técnica<select data-item="${i.id}" data-field="technique" ${isRevenda ? 'disabled' : ''}>${(prod.techniques || []).map(t2 => `<option value="${t2}" ${t2 === i.technique ? 'selected' : ''}>${DS.esc(DS.techName(t2))}</option>`).join('')}</select></label>
          ${isTotal ? `<label>Tecido<select data-item="${i.id}" data-field="fabricId">
              <option value="dryfit" ${i.fabricId === 'dryfit' ? 'selected' : ''}>Dry Fit</option>
              <option value="poliflex" ${i.fabricId === 'poliflex' ? 'selected' : ''}>Poliflex</option></select></label>
            <label>Gola<select data-item="${i.id}" data-field="collar">
              <option value="redonda" ${i.collar !== 'v' ? 'selected' : ''}>Gola redonda</option>
              <option value="v" ${i.collar === 'v' ? 'selected' : ''}>Gola V (+ R$1,50)</option></select></label>
            <label>Manga<select data-item="${i.id}" data-field="sleeve">
              <option value="curta" ${i.sleeve !== 'longa' ? 'selected' : ''}>Manga curta</option>
              <option value="longa" ${i.sleeve === 'longa' ? 'selected' : ''}>Manga longa (+ R$5,50)</option></select></label>` : ''}
          ${(prod.colors || []).length && !isTotal ? `<label>Cor da peça<select data-item="${i.id}" data-field="colorId">
              ${prod.colors.map(cc => `<option value="${cc.id}" ${cc.id === i.colorId ? 'selected' : ''}>${DS.esc(cc.name)} — ${DS.money(cc.price)}</option>`).join('')}</select></label>` : ''}
          ${!isRevenda && !isTotal && (prod.printSizes || []).length ? `<label>Estampa (tamanho e onde)<input data-item="${i.id}" data-field="printsText" value="${DS.esc(printsText(i))}" placeholder="A3(costas), 10x10(peito)"></label>` : ''}
        </div>
        <div class="mt8">${sizes.length ? `<b class="small">Grade (edite direto)</b>
          <div class="grid-sizes compact">${sizes.map(sz => `<label class="size-cell"><span>${sz}${(t.sizePrices || {})[sz] ? `<i class="muted">${DS.money(t.sizePrices[sz])}</i>` : ''}</span><input type="number" min="0" value="${Number((i.sizes || {})[sz] || 0)}" data-item="${i.id}" data-s="${sz}"></label>`).join('')}</div>`
          : `<label class="small">Quantidade<input type="number" min="0" style="max-width:140px" value="${Number(i.qty || 0)}" data-item="${i.id}" data-q></label>`}</div>
        ${(i.extras || []).length ? `<div class="muted small mt8">Extras: ${i.extras.map(e => DS.esc(((c.extras || []).find(x => x.code === e.code) || {}).label || e.code)).join(', ')}${t.extrasSum ? ' · ' + DS.money(t.extrasSum) : ''}</div>` : ''}
        ${t.surcharge ? `<div class="muted small">Acréscimo de tamanhos acima do GG: ${DS.money(t.surcharge)}</div>` : ''}
        ${i.observation ? `<div class="muted small">Obs. do item: ${DS.esc(i.observation)}</div>` : ''}
      </div>`;
    };

    const collect = () => {
      host.querySelectorAll('[data-s]').forEach(inp => {
        const it = o.items.find(x => x.id === inp.dataset.item);
        if (!it) return;
        const v = Math.max(0, Math.floor(Number(inp.value || 0)));
        it.sizes = it.sizes || {};
        if (v > 0) it.sizes[inp.dataset.s] = v; else delete it.sizes[inp.dataset.s];
      });
      host.querySelectorAll('[data-q]').forEach(inp => {
        const it = o.items.find(x => x.id === inp.dataset.item);
        if (it) it.qty = Math.max(0, Math.floor(Number(inp.value || 0)));
      });
      host.querySelectorAll('[data-field]').forEach(inp => {
        const it = o.items.find(x => x.id === inp.dataset.item);
        if (!it) return;
        const f = inp.dataset.field;
        if (f === 'printsText') { it.prints = parsePrints(inp.value); return; }
        if (f === 'colorId') { it.colorId = inp.value; const cc = DS.colorOf(DS.product(it.productId), inp.value); if (cc) it.colorName = cc.name; return; }
        if (f === 'mode') { it.mode = inp.value; if (inp.value === 'revenda') it.technique = 'revenda'; return; }
        it[f] = inp.value;
      });
    };

    host.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="card"><h3>Itens, quantidades, cores e estampas</h3>
            <div class="muted small">Edite direto na grade e salve. Para trocar produto, extras e observação, use o lápis.</div>
            ${o.items.map(card).join('')}
            <div class="row gap mt12">
              <button class="btn" id="ip-save">${DS.icon('check')}<span>Salvar itens</span></button>
              <button class="btn ghost" id="ip-add">${DS.icon('plus')}<span>Adicionar item</span></button>
            </div>
          </div>

          <div class="card mt16"><h3>Etapa da produção</h3>
            <div class="row gap wrap-row mt8">
              <select id="ip-stage">${(o.stages || []).map(s => `<option value="${s.id}" ${s.id === o.stage ? 'selected' : ''}>${DS.esc(s.label)}</option>`).join('')}</select>
              <button class="btn" id="ip-stage-ok">${DS.icon('check')}<span>Salvar etapa</span></button>
              ${o.stage === 'pronto' ? DS.waBtn(`Olá ${o.customer.name}! Seu pedido ${o.code} já está PRONTO PARA RETIRADA na D-Stamp. Endereço: ${DS.config().brand.address}`, 'Avisar cliente (pronto)') : ''}
            </div>
            <div class="list mt12">${(o.timeline || []).slice().reverse().map(t => `<div class="line"><span class="muted small">${DS.dtTime(t.at)}</span> <b>${DS.esc(t.label)}</b> <span class="muted small">· ${DS.esc(t.by || '')}</span></div>`).join('')}</div>
          </div>
        </div>

        <div>
          <div class="card"><h3>Dados do cliente (editável)</h3>
            <div class="form-grid mt12">
              <label>Nome / empresa<input id="cu-name" value="${DS.esc(o.customer.name)}"></label>
              <label>WhatsApp<input id="cu-phone" value="${DS.esc(o.customer.phone)}"></label>
              <label>E-mail<input id="cu-email" value="${DS.esc(o.customer.email || '')}"></label>
              <label>CPF/CNPJ<input id="cu-doc" value="${DS.esc(o.customer.doc || '')}"></label>
            </div>
            <button class="btn small mt8" id="cu-save">${DS.icon('check')}<span>Salvar cadastro</span></button>
          </div>

          <div class="card mt16"><h3>Pagamento</h3>
            <div class="form-grid mt12">
              <label>Forma combinada<select id="pm-method">${['pix_50', 'pix_total', 'cartao_3x', 'cartao', 'dinheiro', 'pix'].map(m => `<option value="${m}" ${m === o.payment.method ? 'selected' : ''}>${DS.payMethodName(m)}</option>`).join('')}</select></label>
              <label>Status<select id="pm-status">${['aguardando_comprovante', 'em_analise', 'autorizado', 'recusado'].map(s => `<option value="${s}" ${s === o.payment.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            </div>
            <div class="row between mt8"><span>Autorizado</span><b>${DS.money(o.paid)}</b></div>
            <div class="row between"><span>Saldo</span><b>${DS.money(o.balance)}</b></div>
            <button class="btn small mt8" id="pm-save">${DS.icon('check')}<span>Salvar pagamento</span></button>
            <div class="muted small mt8">Nº de comprovantes: ${(o.payment.receipts || []).length} · autorizados: ${(o.payment.receipts || []).filter(r => r.status === 'autorizado').length}</div>
          </div>

          <div class="card mt16"><h3>Resumo para copiar (WhatsApp)</h3>
            <textarea id="ip-summary" rows="6" readonly>${DS.esc(summaryText(o))}</textarea>
            <button class="btn ghost small mt8" id="ip-copy">${DS.icon('note')}<span>Copiar resumo</span></button>
          </div>
        </div>
      </div>`;

    host.querySelectorAll('[data-edit-item]').forEach(b => b.addEventListener('click', () => {
      const it = o.items.find(x => x.id === b.dataset.editItem);
      DS.openItemEditor({ item: it, canPrice: true, title: 'Editar item (equipe)', onSave: nv => { const i = o.items.findIndex(x => x.id === it.id); o.items[i] = Object.assign({}, nv, { id: it.id }); save(true); } });
    }));
    host.querySelectorAll('[data-del-item]').forEach(b => b.addEventListener('click', async () => {
      if (!(await DS.confirm('Remover este item do pedido?'))) return;
      o.items = o.items.filter(x => x.id !== b.dataset.delItem);
      if (!o.items.length) return DS.toast('O pedido precisa de ao menos 1 item.', 'err');
      save(true);
    }));
    host.querySelector('#ip-add').addEventListener('click', () => DS.openItemEditor({ item: {}, canPrice: true, title: 'Adicionar item ao pedido', onSave: nv => { o.items.push(nv); save(true); } }));
    host.querySelector('#ip-save').addEventListener('click', () => { collect(); save(true); });
    host.querySelector('#ip-stage-ok').addEventListener('click', async () => {
      collect();
      try {
        await DS.api('/orders/' + o.code, { method: 'PATCH', body: { items: o.items, stage: host.querySelector('#ip-stage').value } });
        DS.toast('Etapa atualizada. Histórico registrado.');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
    host.querySelector('#cu-save').addEventListener('click', async () => {
      try {
        await DS.api('/orders/' + o.code, { method: 'PATCH', body: { customer: { name: host.querySelector('#cu-name').value, phone: host.querySelector('#cu-phone').value.replace(/\D/g, ''), email: host.querySelector('#cu-email').value, doc: host.querySelector('#cu-doc').value } } });
        DS.toast('Cadastro do cliente atualizado.'); await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
    host.querySelector('#pm-save').addEventListener('click', async () => {
      try { await DS.api('/orders/' + o.code, { method: 'PATCH', body: { payment: { method: host.querySelector('#pm-method').value, status: host.querySelector('#pm-status').value } } }); DS.toast('Pagamento atualizado.'); await reload(); redraw(); } catch (e) { DS.toastErr(e); }
    });
    host.querySelector('#ip-copy').addEventListener('click', () => DS.copy(summaryText(o)));

    async function save(stay) {
      try {
        await DS.api('/orders/' + o.code, { method: 'PATCH', body: { items: o.items } });
        DS.toast('Pedido salvo (quantidades, cores, tecidos e estampas).');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    }
  }

  function summaryText(o) {
    return `PEDIDO ${o.code} — ${o.customer.name} (${o.customer.phone})
Etapa: ${DS.stageName(o.stage)} · Arte: ${(o.art || {}).status} · Pagamento: ${DS.payMethodName(o.payment.method)} (${o.payment.status})
Previsão: ${DS.dt(o.predictedDate)} · Total: ${DS.money(o.totals.total)} · Pago: ${DS.money(o.paid)} · Saldo: ${DS.money(o.balance)}
${o.items.map((i, idx) => { const l = (o.totals.lines || []).find(x => x.itemId === i.id) || {};
  const det = i.mode === 'revenda' ? 'peça lisa (revenda)' : i.technique === 'total' ? [DS.fabricName(i.fabricId), DS.golaLabel(i), DS.mangaLabel(i)].join(' | ') : [DS.colorLabel(i), 'estampa ' + DS.printsLabel(i)].join(' | ');
  const grade = Object.entries(i.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ');
  return `Item ${idx + 1}: ${DS.productName(i.productId)} | ${DS.techName(i.mode === 'revenda' ? 'revenda' : i.technique)} | ${det}${grade ? ' | grade ' + grade : ''} | ${DS.num(l.qty || DS.itemQty(i))} un | ${l.onRequest ? 'sob consulta' : DS.money(l.unit || 0) + '/un'}${i.observation ? ' | obs: ' + i.observation : ''}`; }).join('\n')}`;
  }

  /* --- aba: comprovantes --- */
  function tabComprovantes(host, o, reload, redraw) {
    host.innerHTML = `
      <div class="card">
        <h3>Comprovantes do pedido ${DS.esc(o.code)}</h3>
        <div class="muted small">Conferir, autorizar (gera identificação automática e notifica o administrador) ou recusar com motivo.</div>
        <div class="mt16">${(o.payment.receipts || []).length ? (o.payment.receipts || []).map(r => receiptCard(r, o, reload, redraw)).join('') : '<div class="empty small">Nenhum comprovante enviado pelo cliente ainda. O cliente pode enviar pelo site, no acompanhamento do pedido.</div>'}</div>
        <hr>
        <h4>Lançamento manual (equipe)</h4>
        <div class="form-grid">
          <label>Valor<input type="number" step="0.01" id="rc-m-amount" placeholder="0,00"></label>
          <label>Forma<select id="rc-m-method">${['pix', 'pix_50', 'pix_total', 'cartao_3x', 'cartao', 'dinheiro'].map(m => `<option value="${m}">${DS.payMethodName(m)}</option>`).join('')}</select></label>
        </div>
        <label class="block mt8">Observação<input id="rc-m-note" placeholder="Ex.: pagou em dinheiro na loja"></label>
        <button class="btn small mt8" id="rc-m-add">${DS.icon('plus')}<span>Registrar comprovante na mão</span></button>
      </div>`;
    host.querySelector('#rc-m-add').addEventListener('click', async () => {
      const amount = Number(host.querySelector('#rc-m-amount').value || 0);
      if (!amount) return DS.toast('Informe o valor.', 'err');
      try {
        const r = await DS.api('/orders/' + o.code + '/receipts', { method: 'POST', body: { amount: amount, method: host.querySelector('#rc-m-method').value, note: host.querySelector('#rc-m-note').value, upload: { name: 'registro-manual.txt', dataUrl: 'data:text/plain;base64,' + btoa('Registro manual pela equipe: ' + amount) } } });
        DS.toast('Comprovante registrado. Autorize para gerar a identificação.');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
    bindReceiptActions(host, reload, redraw);
  }

  function receiptCard(r, o, reload, redraw) {
    const color = r.status === 'autorizado' ? '#3DD68C' : r.status === 'recusado' ? '#FF5C7A' : '#38BDF8';
    return `<div class="card mini mt8">
      <div class="row between wrap-row">
        <div>
          <b>${DS.esc(r.seq || 'Comprovante em análise')}</b> ${DS.badge(r.status, color)}
          <div class="muted small">${DS.money(r.amount)} · ${DS.payMethodName(r.method)} · enviado ${DS.dtTime(r.uploadedAt)} por ${DS.esc(r.by || o.customer.name)}</div>
          ${r.note ? `<div class="muted small">Obs.: ${DS.esc(r.note)}</div>` : ''}
          ${r.identification ? `<div class="small ident mt8"><b>Identificação:</b> ${DS.esc(r.identification)}</div>` : ''}
          ${r.decidedBy ? `<div class="muted small">Conferido por ${DS.esc(r.decidedBy)} em ${DS.dtTime(r.decidedAt)}</div>` : ''}
        </div>
        <div class="row gap wrap-row">
          ${r.url ? `<a class="btn ghost small" target="_blank" href="${r.url}">${DS.icon('search')}<span>Ver arquivo</span></a>` : ''}
          ${r.status !== 'autorizado' ? `<button class="btn small" data-rec-ok="${r.id}">${DS.icon('check')}<span>Autorizar</span></button>` : ''}
          ${r.status !== 'recusado' ? `<button class="btn ghost small" data-rec-no="${r.id}">${DS.icon('x')}<span>Recusar</span></button>` : ''}
          ${r.seq ? `<button class="btn ghost small" data-rec-copy="${r.id}">${DS.icon('note')}<span>Copiar identificação</span></button>` : ''}
        </div>
      </div>
      ${r.seq ? `<div class="muted small mt8">Notificação enviada automaticamente ao administrador com a identificação ${DS.esc(r.seq)}.</div>` : ''}
    </div>`;
  }

  function bindReceiptActions(host, reload, redraw) {
    host.querySelectorAll('[data-rec-ok]').forEach(b => b.addEventListener('click', async () => {
      try {
        const r = await DS.api('/receipts/' + b.dataset.recOk + '/decision', { method: 'POST', body: { approve: true } });
        DS.toast('Comprovante autorizado · identificação ' + r.receipt.seq + ' enviada ao administrador.');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    }));
    host.querySelectorAll('[data-rec-no]').forEach(b => b.addEventListener('click', () => {
      const m = DS.modal('Recusar comprovante', `<label class="block">Motivo (vai para o cliente)<textarea id="rj-note" rows="3" placeholder="Ex.: o valor enviado não confere com a entrada combinada."></textarea></label>`,
        { footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn danger" id="rj-go">Recusar</button>' });
      m.el.querySelector('#rj-go').addEventListener('click', async () => {
        try {
          await DS.api('/receipts/' + b.dataset.recNo + '/decision', { method: 'POST', body: { approve: false, note: m.el.querySelector('#rj-note').value } });
          m.close(); DS.toast('Comprovante recusado — o cliente foi notificado.');
          await reload(); redraw();
        } catch (e) { DS.toastErr(e); }
      });
    }));
    host.querySelectorAll('[data-rec-copy]').forEach(b => b.addEventListener('click', () => {
      const r = (DS._lastReceipts || []).find(x => x.id === b.dataset.recCopy);
      if (r) DS.copy(r.identification || '');
    }));
  }

  /* --- aba: arte --- */
  function tabArte(host, o, reload, redraw) {
    const pending = (o.art.approvals || []).filter(a => !a.decision).slice(-1)[0];
    host.innerHTML = `
      <div class="grid-2">
        <div class="card"><h3>${DS.icon('palette')} Arte principal (cliente)</h3>
          ${o.art.main ? `<div class="file-line">${DS.icon('download')} <a href="${o.art.main.url}" target="_blank">${DS.esc(o.art.main.name)}</a> <span class="muted small">${DS.dtTime(o.art.main.at)} · ${DS.esc(o.art.main.by || '')}</span></div>` : '<div class="muted small">Nenhuma arte anexada ainda.</div>'}
          <input type="file" id="a-main" class="mt12" accept="image/*,.pdf,.ai,.cdr,.psd">
          <button class="btn small mt8" id="a-main-up">${DS.icon('upload')}<span>Anexar / substituir arte principal</span></button>
          <div class="muted small mt12">Conferência técnica: verifique sangria, cores (Pantone x CMYK), resolução (mín. 300dpi no tamanho real), textos, fontes convertidas e viabilidade de recorte. O que não for possível alterar, combine com o cliente no WhatsApp e registre na aba Anotações.</div>
        </div>
        <div class="card"><h3>${DS.icon('check')} Arte final para aprovação</h3>
          ${o.art.final ? `<div class="file-line">${DS.icon('download')} <a href="${o.art.final.url}" target="_blank">${DS.esc(o.art.final.name)}</a> <span class="muted small">${DS.dtTime(o.art.final.at)}</span></div>` : '<div class="muted small">Nenhuma arte final anexada.</div>'}
          <input type="file" id="a-final" class="mt12" accept="image/*,.pdf">
          <button class="btn small mt8" id="a-final-up">${DS.icon('upload')}<span>Anexar arte final (exportada do CorelDRAW)</span></button>
          <label class="block mt12">Nota técnica do designer (aparece para o cliente)
            <textarea id="a-notes" rows="2">${DS.esc(o.art.notes || '')}</textarea></label>
          <label class="block">Mensagem que o cliente vai receber junto da arte
            <textarea id="a-msg" rows="3" placeholder="Ex.: Arte final pronta! Confere a manga em degradê? Aprovando até hoje, entra na produção desta semana.">${pending ? DS.esc(pending.message) : ''}</textarea></label>
          <div class="row gap mt8">
            <button class="btn" id="a-send">${DS.icon('whats')}<span>Enviar para aprovação do cliente</span></button>
            ${pending ? '<span class="muted small">Já existe uma arte aguardando resposta desde ' + DS.timeAgo(pending.sentAt) + '.</span>' : ''}
          </div>
        </div>
      </div>
      <div class="card mt16"><h3>Histórico</h3>
        <div class="list mt8">
          ${(o.art.history || []).slice().reverse().map(h => `<div class="line"><b>${h.kind === 'final' ? 'Arte final' : 'Arte principal'}</b> ${DS.esc(h.name)} <span class="muted small">${DS.dtTime(h.at)} · ${DS.esc(h.by || '')}</span></div>`).join('') || '<div class="muted small">Sem histórico de arquivos.</div>'}
          ${(o.art.approvals || []).map(a => `<div class="line"><b>Enviada ao cliente</b> <span class="muted small">${DS.dtTime(a.sentAt)} · ${DS.esc(a.sentBy || '')} — “${DS.esc(a.message)}”</span>
            <div class="muted small">${a.decision ? '<b>' + (a.decision === 'aprovada' ? 'APROVADA' : 'AJUSTE PEDIDO') + '</b> em ' + DS.dtTime(a.decisionAt) + ' — ' + DS.esc(a.decisionMessage || '') : 'aguardando resposta do cliente'}</div></div>`).join('')}
        </div>
      </div>`;

    host.querySelector('#a-main-up').addEventListener('click', () => uploadArt(host, '#a-main', o, 'main', reload, redraw));
    host.querySelector('#a-final-up').addEventListener('click', () => uploadArt(host, '#a-final', o, 'final', reload, redraw));
    host.querySelector('#a-send').addEventListener('click', async () => {
      const msg = host.querySelector('#a-msg').value.trim();
      if (!msg) return DS.toast('Escreva a mensagem que o cliente vai receber (o texto é registrado no pedido).', 'err');
      try {
        const r = await DS.api('/orders/' + o.code + '/art/send', { method: 'POST', body: { message: msg, notes: host.querySelector('#a-notes').value } });
        DS.toast('Arte enviada para aprovação. Notificação criada para o cliente.');
        window.open(DS.waLink(r.whatsappText), '_blank');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
  }

  async function uploadArt(host, sel, o, kind, reload, redraw) {
    const f = host.querySelector(sel).files[0];
    if (!f) return DS.toast('Selecione o arquivo.', 'err');
    try {
      const up = await DS.fileToDataUrl(f);
      await DS.api('/orders/' + o.code + '/art', { method: 'POST', body: { kind: kind, upload: up } });
      DS.toast(kind === 'final' ? 'Arte final anexada.' : 'Arte principal anexada.');
      await reload(); redraw();
    } catch (e) { DS.toastErr(e); }
  }

  /* --- aba: anotações (bloco de notas indexado) --- */
  function tabNotas(host, o, reload, redraw) {
    const notes = o.notes || [];
    const num = n => notes.findIndex(x => x.id === n.id) + 1;
    host.innerHTML = `
      <div class="card">
        <h3>${DS.icon('note')} Bloco de notas do pedido ${DS.esc(o.code)}</h3>
        <div class="muted small">Cada anotação recebe numeração própria (Anotação #1, #2…) e pode ser vinculada a um item específico — assim o número de cada peça fica separado para o designer e a produção.</div>
        <div class="form-grid mt12">
          <label>Referente a
            <select id="nt-ref">
              <option value="">Pedido geral</option>
              ${o.items.map((it, i) => `<option value="Item ${i + 1}: ${DS.productName(it.productId)} ${Object.entries(it.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ')}">Item ${i + 1} — ${DS.esc(DS.productName(it.productId))} (${DS.num(DS.itemQty(it))} un)</option>`).join('')}
            </select></label>
          <label>Visibilidade
            <select id="nt-vis"><option value="internal">Interna (só a equipe)</option><option value="public">Visível para o cliente</option></select></label>
        </div>
        <textarea id="nt-text" class="mt8" rows="3" placeholder="Ex.: cliente pediu nome individual — lista enviada no WhatsApp; conferir 3 nomes com acento."></textarea>
        <button class="btn small mt8" id="nt-add">${DS.icon('plus')}<span>Adicionar anotação</span></button>
      </div>
      <div class="card mt16"><h3>Anotações registradas</h3>
        <div class="list mt8">${notes.slice().reverse().map(n => {
          const ref = n.ref ? n.ref : 'Pedido geral';
          return `<div class="line ${n.internal ? 'internal' : ''}">
            <div class="row between"><b>Anotação #${num(n)} · ${DS.esc(ref)}</b><span class="muted small">${DS.dtTime(n.at)} · ${DS.esc(n.by)} (${DS.esc(n.role || '')}) ${n.internal ? DS.badge('interna', '#8A93A6') : DS.badge('cliente vê', '#3DD68C')}</span></div>
            <p>${DS.esc(n.text)}</p></div>`;
        }).join('') || '<div class="muted small">Nenhuma anotação ainda.</div>'}</div>
      </div>`;
    host.querySelector('#nt-add').addEventListener('click', async () => {
      const text = host.querySelector('#nt-text').value.trim();
      if (!text) return DS.toast('Escreva a anotação.', 'err');
      try {
        await DS.api('/orders/' + o.code + '/notes', { method: 'POST', body: { text: text, internal: host.querySelector('#nt-vis').value === 'internal', ref: host.querySelector('#nt-ref').value } });
        DS.toast('Anotação registrada.'); await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
  }

  /* --- aba: chamados do pedido --- */
  function tabChamados(host, o, reload, redraw) {
    host.innerHTML = `
      <div class="card">
        <h3>${DS.icon('ticket')} Chamados do pedido ${DS.esc(o.code)}</h3>
        <div class="form-grid mt12">
          <label>Categoria<select id="t-cat">${Object.entries(DS.catalog().ticketCategories || {}).map(([k, v]) => `<option value="${k}">${DS.esc(v.label)} (${v.prefix})</option>`).join('')}</select></label>
          <label>Assunto<input id="t-title" placeholder="Ex.: incluir nome individual nas costas"></label>
        </div>
        <textarea id="t-body" class="mt8" rows="2" placeholder="Detalhe o que precisa. Isso fica registrado com número próprio."></textarea>
        <label class="chip mt8"><input type="checkbox" id="t-urgent"> Marcar como URGENTE</label>
        <button class="btn small mt8" id="t-add">${DS.icon('plus')}<span>Abrir chamado</span></button>
      </div>
      <div class="card mt16"><h3>Histórico de chamados</h3>
        <div class="list mt8">${(o.tickets || []).length ? (o.tickets || []).map(t => `<div class="line"><b>${DS.esc(t.code)}</b> ${t.urgent ? DS.badge('URGENTE', '#FF5C7A') : ''} ${DS.badge(t.status, '#8A93A6')} <span class="muted small">${DS.esc(t.title)} · ${DS.dtTime(t.at)}</span></div>`).join('') : '<div class="muted small">Nenhum chamado neste pedido.</div>'}</div>
      </div>`;
    host.querySelector('#t-add').addEventListener('click', async () => {
      const title = host.querySelector('#t-title').value.trim();
      if (!title) return DS.toast('Informe o assunto.', 'err');
      try {
        const r = await DS.api('/tickets', { method: 'POST', body: { orderCode: o.code, category: host.querySelector('#t-cat').value, title: title, body: host.querySelector('#t-body').value, urgent: host.querySelector('#t-urgent').checked } });
        DS.toast('Chamado ' + r.ticket.code + ' aberto' + (r.ticket.urgent ? ' (URGENTE)' : '') + '.');
        await reload(); redraw();
      } catch (e) { DS.toastErr(e); }
    });
  }

  /* --- aba: ficha técnica do pedido --- */
  function tabFicha(host, o) {
    const groups = {};
    o.items.forEach((i, idx) => {
      const g = groups[i.productId] = groups[i.productId] || { name: DS.productName(i.productId), rows: [] };
      g.rows.push({ idx: idx + 1, it: i });
    });
    host.innerHTML = `
      <div class="card">
        <div class="row between wrap-row"><h3>${DS.icon('layers')} Ficha técnica — informações separadas por tipo de peça</h3>
          <div class="row gap"><button class="btn ghost small" id="fc-copy">${DS.icon('note')}<span>Copiar ficha</span></button>
          <button class="btn ghost small" id="fc-dl">${DS.icon('download')}<span>Baixar CSV</span></button></div>
        </div>
        ${Object.values(groups).map(g => `
          <h4 class="mt16">${DS.esc(g.name)}</h4>
          ${g.rows.map(r => `<div class="ficha">
            <div class="row between"><b>Item ${r.idx}</b><span class="muted small">${DS.esc(DS.techName(r.it.technique))}</span></div>
            <div class="grid-3 small">
              <div><b>Tecido:</b> ${r.it.technique === 'total' ? DS.esc(DS.fabricName(r.it.fabricId)) : '—'}</div>
              <div><b>Gola / manga:</b> ${r.it.technique === 'total' ? DS.esc(DS.golaLabel(r.it)) + ' · ' + DS.esc(DS.mangaLabel(r.it)) : '—'}</div>
              <div><b>Cor da peça:</b> ${DS.esc(DS.colorLabel(r.it))}</div>
              <div><b>Estampa:</b> ${r.it.mode === 'revenda' ? 'peça lisa (revenda)' : r.it.technique === 'total' ? 'peça inteira (total)' : DS.esc(DS.printsLabel(r.it))}</div>
              <div><b>Total:</b> ${DS.num(DS.itemQty(r.it))} ${DS.sizesFor(r.it.productId, r.it.technique, r.it.mode).length ? 'peças' : 'unidades'}</div>
              <div><b>Extras:</b> ${(r.it.extras || []).map(e => DS.esc(((DS.catalog().extras || []).find(x => x.code === e.code) || {}).label || e.code)).join(', ') || '—'}</div>
            </div>
            <div class="grade"><b>Grade separada:</b> ${Object.entries(r.it.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `<span class="pill">${k}: ${v}</span>`).join(' ') || '<span class="pill">' + DS.num(r.it.qty || 0) + ' un</span>'}</div>
            ${r.it.observation ? `<div class="small muted">Obs.: ${DS.esc(r.it.observation)}</div>` : ''}
          </div>`).join('')}`).join('')}
      </div>`;
    host.querySelector('#fc-copy').addEventListener('click', () => DS.copy(fichaText(o)));
    host.querySelector('#fc-dl').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob(['\ufeff' + fichaCsv(o)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'ficha-' + o.code + '.csv'; a.click(); URL.revokeObjectURL(url);
    });
  }
  function fichaText(o) {
    return `FICHA TÉCNICA — PEDIDO ${o.code} — ${o.customer.name}\nEtapa: ${DS.stageName(o.stage)} · Arte: ${(o.art || {}).status}\n\n` +
      o.items.map((i, idx) => [`ITEM ${idx + 1}`,
        `Produto: ${DS.productName(i.productId)}`,
        i.mode === 'revenda' ? `Revenda: peça lisa` : `Técnica: ${DS.techName(i.technique)}`,
        i.technique === 'total' ? `Tecido: ${DS.fabricName(i.fabricId)}` : null,
        i.technique === 'total' ? `Gola: ${DS.golaLabel(i)} · Manga: ${DS.mangaLabel(i)}` : null,
        `Cor da peça: ${DS.colorLabel(i)}`,
        i.mode !== 'revenda' && i.technique !== 'total' ? `Estampa: ${DS.printsLabel(i)}` : null,
        `Grade: ${Object.entries(i.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join('  ') || DS.num(i.qty || 0) + ' un'}`,
        `Total: ${DS.num(DS.itemQty(i))} ${DS.sizesFor(i.productId, i.technique, i.mode).length ? 'peças' : 'unidades'}`,
        (i.extras || []).length ? `Extras: ${i.extras.map(e => ((DS.catalog().extras || []).find(x => x.code === e.code) || {}).label || e.code).join(', ')}` : null,
        i.observation ? `Obs.: ${i.observation}` : null].filter(Boolean).join('\n')).join('\n\n');
  }
  function fichaCsv(o) {
    const rows = [['Pedido', 'Item', 'Produto', 'Tecnica', 'Tecido', 'Gola', 'Manga', 'Cor', 'Estampa', 'Grade', 'Quantidade', 'Extras', 'Observacao'].join(';')];
    o.items.forEach((i, idx) => {
      rows.push([o.code, idx + 1, DS.productName(i.productId), DS.techName(i.mode === 'revenda' ? 'revenda' : i.technique),
        i.technique === 'total' ? DS.fabricName(i.fabricId) : '-', i.technique === 'total' ? DS.golaLabel(i) : '-', i.technique === 'total' ? DS.mangaLabel(i) : '-',
        DS.colorLabel(i), i.mode === 'revenda' ? 'peça lisa' : (i.technique === 'total' ? 'peça inteira' : DS.printsLabel(i)),
        Object.entries(i.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' '), DS.itemQty(i),
        (i.extras || []).map(e => ((DS.catalog().extras || []).find(x => x.code === e.code) || {}).label || e.code).join(' '), i.observation || ''].join(';'));
    });
    return rows.join('\r\n');
  }

  /* --------------------------- COMPROVANTES ---------------------------- */
  Painel.renderComprovantes = async function (body) {
    const state = { status: 'em_analise' };
    const draw = async () => {
      const r = await DS.api('/receipts' + (state.status ? '?status=' + state.status : ''));
      const all = await DS.api('/receipts');
      DS._lastReceipts = all.receipts;
      const group = status => all.receipts.filter(x => x.status === status).length;
      body.innerHTML = `
        <div class="card">
          <div class="row between wrap-row">
            <div><h3>${DS.icon('money')} Validação de comprovantes</h3>
              <div class="muted small">Autorizar gera a identificação (REC-0000) com comprovante, valor e responsável — e notifica o administrador automaticamente.</div></div>
            <div class="row gap"><a class="btn ghost small" href="#/painel/pedidos">Ver pedidos</a></div>
          </div>
          <div class="chips mt12">
            ${[['em_analise', 'Aguardando conferência'], ['autorizado', 'Autorizados'], ['recusado', 'Recusados'], ['', 'Todos']].map(([k, l]) =>
              `<button class="chip ${state.status === k ? 'on' : ''}" data-st="${k}">${l} <b>${k ? group(k) : all.total}</b></button>`).join('')}
          </div>
          <div class="mt16">${r.receipts.length ? r.receipts.map(x => `
            <div class="card mini mt8">
              <div class="row between wrap-row">
                <div><b>${DS.esc(x.seq || 'Em análise')} · ${DS.esc(x.orderCode)}</b> ${DS.badge(x.status, x.status === 'autorizado' ? '#3DD68C' : x.status === 'recusado' ? '#FF5C7A' : '#38BDF8')}
                  <div class="muted small">${DS.esc(x.customer)} — ${DS.money(x.amount)} · ${DS.payMethodName(x.method)} · enviado ${DS.dtTime(x.uploadedAt)} por ${DS.esc(x.by || '')}</div>
                  ${x.identification ? `<div class="small ident mt8">${DS.esc(x.identification)}</div>` : ''}
                </div>
                <div class="row gap wrap-row">
                  ${x.url ? `<a class="btn ghost small" target="_blank" href="${x.url}">${DS.icon('search')}<span>Conferir arquivo</span></a>` : ''}
                  <a class="btn ghost small" href="#/painel/pedido/${encodeURIComponent(x.orderCode)}">Abrir pedido</a>
                  ${x.status !== 'autorizado' ? `<button class="btn small" data-ok="${x.id}">${DS.icon('check')}<span>Autorizar</span></button>` : ''}
                  ${x.status !== 'recusado' ? `<button class="btn ghost small" data-no="${x.id}">${DS.icon('x')}<span>Recusar</span></button>` : ''}
                </div>
              </div>
            </div>`).join('') : '<div class="empty small">Nada por aqui neste filtro. 🎉</div>'}</div>
        </div>`;
      body.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { state.status = b.dataset.st; draw(); }));
      body.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', async () => {
        try {
          const res = await DS.api('/receipts/' + b.dataset.ok + '/decision', { method: 'POST', body: { approve: true } });
          await identModal(res);
          draw();
        } catch (e) { DS.toastErr(e); }
      }));
      body.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', async () => {
        const m = DS.modal('Recusar comprovante', '<label class="block">Motivo<textarea id="rj" rows="3"></textarea></label>', { footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn danger" id="rgo">Recusar</button>' });
        m.el.querySelector('#rgo').addEventListener('click', async () => {
          try { await DS.api('/receipts/' + b.dataset.no + '/decision', { method: 'POST', body: { approve: false, note: m.el.querySelector('#rj').value } }); m.close(); DS.toast('Comprovante recusado.'); draw(); } catch (e) { DS.toastErr(e); }
        });
      }));
    };
    draw();
  };

  function identModal(res) {
    return new Promise(resolve => {
      const r = res.receipt, o = res.order;
      const txt = res.adminWhatsAppText;
      const m = DS.modal('Identificação gerada e enviada ao administrador',
        `<div class="ident-block">
          <div class="row between"><span class="muted small">Identificação</span><b>${DS.esc(r.seq)}</b></div>
          <div class="row between"><span class="muted small">Pedido</span><b>${DS.esc(o.code)}</b></div>
          <div class="row between"><span class="muted small">Cliente</span><b>${DS.esc(o.customer.name)}</b></div>
          <div class="row between"><span class="muted small">Valor autorizado</span><b>${DS.money(r.amount)}</b></div>
          <div class="row between"><span class="muted small">Forma</span><b>${DS.payMethodName(r.method)}</b></div>
          <div class="row between"><span class="muted small">Conferido por</span><b>${DS.esc(r.decidedBy)}</b></div>
          <div class="row between"><span class="muted small">Pago / saldo do pedido</span><b>${DS.money(o.paid)} / ${DS.money(o.balance)}</b></div>
          <div class="muted small mt8">O administrador recebeu a notificação automática com o comprovante anexado ao pedido. Envie também no WhatsApp, se preferir.</div>
        </div>`,
        { footer: `<button class="btn ghost" data-close>Fechar</button><button class="btn ghost" id="id-copy">${DS.icon('note')}<span>Copiar identificação</span></button><a class="btn wa" target="_blank" rel="noopener" href="${DS.waLink(txt)}">${DS.icon('whats')}<span>Enviar ao admin no WhatsApp</span></a>` });
      m.el.querySelector('#id-copy').addEventListener('click', () => DS.copy(r.identification));
      m.el.addEventListener('click', e => { if (e.target === m.el || e.target.closest('[data-close]')) resolve(true); });
      setTimeout(resolve, 60000);
    });
  }

  /* ------------------------------ CHAMADOS ------------------------------ */
  Painel.renderChamados = async function (body) {
    const state = { category: '', urgent: false, status: '' };
    const draw = async () => {
      const qs = new URLSearchParams();
      if (state.category) qs.set('category', state.category);
      if (state.status) qs.set('status', state.status);
      if (state.urgent) qs.set('urgent', '1');
      const r = await DS.api('/tickets?' + qs.toString());
      const all = await DS.api('/tickets');
      body.innerHTML = `
        <div class="card">
          <div class="row between wrap-row">
            <div><h3>${DS.icon('ticket')} Tabelas de chamados</h3>
              <div class="muted small">Cada tipo tem numeração própria: <b>ALT</b> alteração · <b>ACO</b> acompanhamento · <b>FIN</b> finalização · <b>ERR</b> erro. Todos ficam indexados ao número do pedido.</div></div>
            <div class="row gap"><label class="chip ${state.urgent ? 'on' : ''}" style="cursor:pointer"><input type="checkbox" id="c-urg" ${state.urgent ? 'checked' : ''}> somente URGENTES</label></div>
          </div>
          <div class="chips mt12">
            <button class="chip ${state.category === '' ? 'on' : ''}" data-cat="">Todos <b>${all.tickets.length}</b></button>
            ${Object.entries(all.categories).map(([k, v]) => `<button class="chip ${state.category === k ? 'on' : ''}" data-cat="${k}">${DS.esc(v.label)} <b>${all.byCategory[k] ? all.byCategory[k].length : 0}</b></button>`).join('')}
            ${[['aberto', 'Abertos'], ['em_andamento', 'Em andamento'], ['resolvido', 'Resolvidos']].map(([k, l]) => `<button class="chip ${state.status === k ? 'on' : ''}" data-status="${k}">${l}</button>`).join('')}
          </div>
          <div class="table-scroll mt16"><table class="tbl">
            <thead><tr><th>Número</th><th>Pedido</th><th>Tipo</th><th>Assunto</th><th>Aberto por</th><th>Quando</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${r.tickets.length ? r.tickets.map(t => `
              <tr class="${t.urgent ? 'urgent-row' : ''}">
                <td><b>${DS.esc(t.code)}</b>${t.urgent ? DS.badge('URGENTE', '#FF5C7A') : ''}</td>
                <td><a href="#/painel/pedido/${encodeURIComponent(t.orderCode)}">${DS.esc(t.orderCode)}</a></td>
                <td>${DS.esc((all.categories[t.category] || {}).label || t.category)}</td>
                <td>${DS.esc(t.title)}<div class="muted small">${DS.esc(t.body || '')}</div></td>
                <td>${DS.esc(t.by)} <span class="muted small">(${DS.esc(t.byRole || '')})</span></td>
                <td>${DS.dtTime(t.createdAt)}</td>
                <td>${DS.badge(t.status, t.status === 'aberto' ? '#FFB020' : t.status === 'em_andamento' ? '#38BDF8' : '#3DD68C')}</td>
                <td class="row gap">
                  <button class="btn ghost small" data-ticket="${t.id}">Abrir</button>
                  ${t.status !== 'resolvido' ? `<button class="btn small" data-done="${t.id}">Resolver</button>` : ''}
                </td>
              </tr>`).join('') : '<tr><td colspan="8" class="muted small">Nenhum chamado nesse filtro.</td></tr>'}</tbody>
          </table></div>
        </div>`;
      body.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { state.category = b.dataset.cat; draw(); }));
      body.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => { state.status = state.status === b.dataset.status ? '' : b.dataset.status; draw(); }));
      body.querySelector('#c-urg').addEventListener('change', e => { state.urgent = e.target.checked; draw(); });
      body.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', async () => { await DS.api('/tickets/' + b.dataset.done, { method: 'PATCH', body: { status: 'resolvido' } }); DS.toast('Chamado resolvido.'); draw(); }));
      body.querySelectorAll('[data-ticket]').forEach(b => b.addEventListener('click', () => openTicket(b.dataset.ticket, draw)));
    };
    draw();
  };

  async function openTicket(id, refresh) {
    const r = await DS.api('/tickets');
    const t = r.tickets.find(x => x.id === id);
    if (!t) return;
    const m = DS.modal('Chamado ' + t.code,
      `<div class="small">
        <div class="row between"><span class="muted small">Pedido</span><b>${DS.esc(t.orderCode)}</b></div>
        <div class="row between"><span class="muted small">Tipo</span><b>${DS.esc((r.categories[t.category] || {}).label || t.category)}</b></div>
        <div class="row between"><span class="muted small">Aberto por</span><b>${DS.esc(t.by)} (${DS.esc(t.byRole || '')})</b></div>
        <div class="row between"><span class="muted small">Urgência</span><b>${t.urgent ? 'URGENTE' : 'normal'}</b></div>
        <p class="mt8"><b>${DS.esc(t.title)}</b><br>${DS.esc(t.body || '')}</p>
        <div class="list mt12">${(t.messages || []).map(x => `<div class="line"><b>${DS.esc(x.by)}</b> <span class="muted small">${DS.dtTime(x.at)}</span><p>${DS.esc(x.text)}</p></div>`).join('') || '<div class="muted small">Sem mensagens.</div>'}</div>
        <textarea id="tk-msg" class="mt8" rows="2" placeholder="Escrever andamento do chamado"></textarea>
        <div class="row gap mt8">
          <button class="btn small" id="tk-send">${DS.icon('plus')}<span>Adicionar andamento</span></button>
          <button class="btn ghost small" id="tk-start">Marcar em andamento</button>
          <button class="btn ghost small" id="tk-done">Resolver</button>
          <button class="btn ghost small" id="tk-urg">${t.urgent ? 'Remover urgência' : 'Marcar urgente'}</button>
        </div></div>`,
      { wide: true, footer: '<button class="btn ghost" data-close>Fechar</button>' });
    const act = async (payload) => { await DS.api('/tickets/' + t.id, { method: 'PATCH', body: payload }); m.close(); refresh(); };
    m.el.querySelector('#tk-send').addEventListener('click', () => act({ message: m.el.querySelector('#tk-msg').value }));
    m.el.querySelector('#tk-start').addEventListener('click', () => act({ status: 'em_andamento' }));
    m.el.querySelector('#tk-done').addEventListener('click', () => act({ status: 'resolvido' }));
    m.el.querySelector('#tk-urg').addEventListener('click', () => act({ urgent: !t.urgent }));
  }

  /* ------------------------------ CLIENTES ------------------------------ */
  Painel.renderClientes = async function (body) {
    const state = { q: '' };
    const draw = async () => {
      const r = await DS.api('/customers?q=' + encodeURIComponent(state.q));
      body.innerHTML = `
        <div class="card">
          <div class="row between wrap-row">
            <h3>Clientes</h3>
            <div class="row gap"><input id="cl-q" placeholder="Buscar nome, telefone, e-mail, CNPJ" value="${DS.esc(state.q)}">
            <button class="btn" id="cl-new">${DS.icon('plus')}<span>Novo cliente</span></button></div>
          </div>
          <div class="table-scroll mt16"><table class="tbl">
            <thead><tr><th>Cliente</th><th>Contato</th><th>CNPJ/CPF</th><th>Pedidos</th><th>Total comprado</th><th></th></tr></thead>
            <tbody>${r.customers.map(c => `<tr>
              <td><b>${DS.esc(c.name)}</b>${c.note ? `<div class="muted small">${DS.esc(c.note)}</div>` : ''}</td>
              <td>${DS.esc(c.phone)}<div class="muted small">${DS.esc(c.email || '')}</div></td>
              <td>${DS.esc(c.doc || '—')}</td>
              <td>${c.orders}</td>
              <td>${DS.money(c.spent)}</td>
              <td class="row gap"><button class="btn ghost small" data-edit="${c.id}">Editar</button>
                ${DS.waBtn('Olá ' + c.name + '! Aqui é a D-Stamp.', 'WhatsApp', 'btn ghost small')}</td>
            </tr>`).join('')}</tbody>
          </table></div>
          <div class="muted small mt8">${r.total} cliente(s)</div>
        </div>`;
      body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const c = r.customers.find(x => x.id === b.dataset.edit);
        const m = DS.modal('Editar cliente', `<div class="form-grid">
          <label>Nome / empresa<input id="e-name" value="${DS.esc(c.name)}"></label>
          <label>Telefone<input id="e-phone" value="${DS.esc(c.phone)}"></label>
          <label>E-mail<input id="e-email" value="${DS.esc(c.email || '')}"></label>
          <label>CPF/CNPJ<input id="e-doc" value="${DS.esc(c.doc || '')}"></label></div>
          <label class="block mt8">Observações de atendimento<textarea id="e-note" rows="2">${DS.esc(c.note || '')}</textarea></label>
          <div class="muted small mt8">Alterar o telefone atualiza todos os pedidos vinculados a este cliente.</div>`,
          { footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="e-save">Salvar</button>' });
        m.el.querySelector('#e-save').addEventListener('click', async () => {
          try {
            await DS.api('/customers/' + c.id, { method: 'PATCH', body: { name: m.el.querySelector('#e-name').value, phone: m.el.querySelector('#e-phone').value, email: m.el.querySelector('#e-email').value, doc: m.el.querySelector('#e-doc').value, note: m.el.querySelector('#e-note').value } });
            m.close(); DS.toast('Cliente atualizado.'); draw();
          } catch (e) { DS.toastErr(e); }
        });
      }));
      body.querySelector('#cl-new').addEventListener('click', () => {
        const m = DS.modal('Novo cliente', `<div class="form-grid">
          <label>Nome / empresa<input id="n-name"></label><label>Telefone<input id="n-phone"></label>
          <label>E-mail<input id="n-email"></label><label>CPF/CNPJ<input id="n-doc"></label></div>`,
          { footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="n-save">Cadastrar</button>' });
        m.el.querySelector('#n-save').addEventListener('click', async () => {
          try { await DS.api('/customers', { method: 'POST', body: { name: m.el.querySelector('#n-name').value, phone: m.el.querySelector('#n-phone').value, email: m.el.querySelector('#n-email').value, doc: m.el.querySelector('#n-doc').value } }); m.close(); DS.toast('Cliente cadastrado.'); draw(); } catch (e) { DS.toastErr(e); }
        });
      });
      const q = body.querySelector('#cl-q');
      let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value; draw(); }, 300); });
    };
    draw();
  };

  /* --------------------- FICHA DO DESIGNER (GLOBAL) --------------------- */
  Painel.renderDesigner = async function (body) {
    const r = await DS.api('/designer/sheet');
    body.innerHTML = `
      <div class="card">
        <div class="row between wrap-row">
          <div><h3>${DS.icon('palette')} Ficha técnica para o designer</h3>
            <div class="muted small">Informações <b>separadas por tipo de produto</b> (camiseta, baby look, regata, regata feminina, infantil, regata infantil, machão, calça capoeira, canecas, garrafas…) de todos os pedidos em aberto que precisam de arte. Atualizado em ${DS.dtTime(r.generatedAt)}.</div></div>
          <div class="row gap">
            <button class="btn ghost small" id="d-copy">${DS.icon('note')}<span>Copiar tudo</span></button>
            <button class="btn ghost small" id="d-csv">${DS.icon('download')}<span>Baixar CSV</span></button>
          </div>
        </div>
        <div class="mt16">${r.groups.length ? r.groups.map(g => `
          <div class="card mini mt12">
            <div class="row between"><b>${DS.esc(g.name)}</b><span class="muted small">${g.pieces} peças · ${g.rows.length} linha(s)</span></div>
            <div class="table-scroll mt8"><table class="tbl small">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Técnica</th><th>Tecido</th><th>Gola/manga</th><th>Cor</th><th>Estampa</th><th>Grade</th><th>Extras / obs.</th><th>Arte</th><th></th></tr></thead>
              <tbody>${g.rows.map(x => `<tr>
                <td>${DS.esc(x.orderCode)}</td><td>${DS.esc(x.customer)}</td><td>${DS.esc(DS.techShort(x.technique))}</td>
                <td>${DS.esc(DS.fabricName(x.fabric))}</td><td class="muted small">${DS.esc(x.collar || '—')}${x.sleeve ? '<br>' + DS.esc(x.sleeve) : ''}</td><td>${DS.esc(x.color)}</td>
                <td class="small">${DS.esc(x.prints || '—')}</td>
                <td>${Object.entries(x.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `<span class="pill">${k}:${v}</span>`).join(' ') || `<span class="pill">${DS.num(x.qty)} un</span>`}</td>
                <td class="muted small">${(x.extras || []).map(e => DS.esc(((DS.catalog().extras || []).find(y => y.code === e.code) || {}).label || e.code)).join(', ')}${x.observation ? ' · ' + DS.esc(x.observation) : ''}</td>
                <td>${DS.badge(x.artStatus, x.artStatus === 'aprovada' ? '#3DD68C' : x.artStatus === 'aguardando_aprovacao' ? '#FFB020' : '#38BDF8')}
                  ${x.mainArt ? `<div><a class="small" href="${x.mainArt.url}" target="_blank">arte principal</a></div>` : ''}</td>
                <td><a class="btn small" href="#/painel/pedido/${encodeURIComponent(x.orderCode)}">Abrir</a></td>
              </tr>`).join('')}</tbody></table></div>
          </div>`).join('') : '<div class="empty small">Nenhum pedido em aberto no momento.</div>'}</div>
      </div>`;
    const text = r.groups.map(g => `== ${g.name.toUpperCase()} (${g.pieces} peças) ==\n` + g.rows.map(x =>
      `Pedido ${x.orderCode} | ${x.customer} | ${DS.techName(x.technique)} | ${x.fabric ? DS.fabricName(x.fabric) + ' | ' : ''}${x.collar && x.collar !== '-' ? x.collar + ' / ' + (x.sleeve || '') + ' | ' : ''}${x.color} | estampa ${x.prints} | grade ${Object.entries(x.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ') || x.qty + ' un'} | ${DS.num(x.qty)} un${x.observation ? ' | obs: ' + x.observation : ''}`).join('\n')).join('\n\n');
    body.querySelector('#d-copy').addEventListener('click', () => DS.copy(text));
    body.querySelector('#d-csv').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob(['\ufeff' + text.replace(/==/g, '')], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'ficha-designer.csv'; a.click(); URL.revokeObjectURL(url);
    });
  };

  /* ----------------------------- ADMINISTRAÇÃO -------------------------- */
  Painel.renderAdmin = async function (body) {
    const cfg = DS.config();
    const cat = DS.catalog();
    let tab = 'marca';
    const draw = () => {
      body.innerHTML = `
        <nav class="tabs">
          ${[['marca', 'Marca e contato'], ['loja', 'Loja e foco'], ['producao', 'Lote, janela e prazos'], ['precos', 'Preços e estampas'], ['catalogo', 'Catálogo (modelagens)'], ['guia', 'Guia do site (conteúdo)'], ['acabamentos', 'Extras e acabamentos'], ['regras', 'Pagamento e regras'], ['faq', 'FAQ do site'], ['usuarios', 'Usuários'], ['integracoes', 'Integrações'], ['logs', 'Log de auditoria']]
            .map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-atab="${k}">${l}</button>`).join('')}
        </nav>
        <div id="a-body" class="mt16"></div>`;
      body.querySelectorAll('[data-atab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.atab; draw(); }));
      const host = body.querySelector('#a-body');
      if (tab === 'marca') host.innerHTML = `
        <div class="card"><h3>Marca, WhatsApp e endereço</h3>
          <div class="form-grid mt12">
            <label>Nome da marca<input id="k-name" value="${DS.esc(cfg.brand.name)}"></label>
            <label>WhatsApp (formato 5511999999999)<input id="k-wa" value="${DS.esc(cfg.brand.whatsapp)}"></label>
            <label>WhatsApp exibido<input id="k-wal" value="${DS.esc(cfg.brand.whatsappLabel)}"></label>
            <label>E-mail<input id="k-email" value="${DS.esc(cfg.brand.email)}"></label>
            <label>Instagram<input id="k-inst" value="${DS.esc(cfg.brand.instagram || '')}"></label>
            <label>Cidade<input id="k-city" value="${DS.esc(cfg.brand.city || '')}"></label>
          </div>
          <label class="block mt8">Endereço completo (retirada)<input id="k-addr" value="${DS.esc(cfg.brand.address)}"></label>
          <label class="block mt8">Busca no Maps (Google/Apple usam este texto)<input id="k-maps" value="${DS.esc(cfg.maps.query)}"></label>
          <button class="btn mt12" id="k-save">${DS.icon('check')}<span>Salvar</span></button>
        </div>
        <div class="card mt16"><h3>${DS.icon('bell')} Avisos da faixa do topo (o que o cliente vê)</h3>
          <p class="muted small">Aparecem no topo do site, acima de tudo, em todas as páginas. Use para recados, datas e promoções — <b>sem números de peças</b> (isso é informação da equipe).</p>
          <div id="an-list">${(cfg.brand.announcements || []).map(a => `
            <div class="row gap mt8 an-row">
              <input class="grow" data-an-text="${DS.esc(a.id)}" value="${DS.esc(a.text || '')}" placeholder="Texto do aviso (ex.: Abadás de verão: garanta sua data no lote de 31/10.)">
              <label class="chip"><input type="checkbox" data-an-on="${DS.esc(a.id)}" ${a.active ? 'checked' : ''}> ativo</label>
              <button class="icon-btn danger" data-an-del="${DS.esc(a.id)}" aria-label="Remover aviso">${DS.icon('x')}</button>
            </div>`).join('')}
          </div>
          <div class="btn-row mt12">
            <button class="btn ghost" id="an-add">${DS.icon('plus')}<span>Adicionar aviso</span></button>
          </div>
        </div>`;
      const anList = host.querySelector('#an-list');
      if (anList) {
        host.querySelector('#an-add').addEventListener('click', () => {
          const id = 'an_' + Date.now();
          const row = host.ownerDocument.createElement('div');
          row.className = 'row gap mt8 an-row';
          row.innerHTML = `<input class="grow" data-an-text="${id}" placeholder="Texto do aviso">
            <label class="chip"><input type="checkbox" data-an-on="${id}" checked> ativo</label>
            <button class="icon-btn danger" data-an-del="${id}" aria-label="Remover aviso">${DS.icon('x')}</button>`;
          row.querySelector('[data-an-del]').addEventListener('click', () => row.remove());
          anList.appendChild(row);
        });
        anList.querySelectorAll('[data-an-del]').forEach(b => b.addEventListener('click', () => b.closest('.an-row').remove()));
      }
      if (tab === 'loja') host.innerHTML = `
        <div class="grid-2">
          <div class="card"><h3>Foco da loja</h3>
            <div class="muted small">O site é uma vitrine de <b>estampa total</b>. A estampa localizada (sublimação, DTF, brindes e peça de terceiros) é orçada pelo WhatsApp.</div>
            <label class="block mt12">Técnica em destaque<select id="s-focus">
              ${[['total', 'Estampa total (recomendado)'], ['sublimacao_localizada', 'Sublimação localizada'], ['dtf', 'DTF têxtil']].map(([v, l]) => `<option value="${v}" ${(cfg.store || {}).focus === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
            <label class="chip mt8"><input type="checkbox" id="s-self" ${(cfg.store || {}).localizedSelfService ? 'checked' : ''}> Permitir fechar estampa localizada pelo site (hoje: só WhatsApp)</label>
            <label class="chip mt8"><input type="checkbox" id="s-ref" ${(cfg.store || {}).showReferencePrices !== false ? 'checked' : ''}> Mostrar valores de referência da localizada</label>
            <label class="chip mt8"><input type="checkbox" id="s-nomin" ${(cfg.rules || {}).noMinimum !== false ? 'checked' : ''}> Sem quantidade mínima (a partir de 1 peça)</label>
          </div>
          <div class="card"><h3>Loja oficial e atendimento</h3>
            <div class="form-grid mt8">
              <label>Site oficial (peças lisas e insumos)<input id="s-ext" value="${DS.esc((cfg.store || {}).externalStore || '')}"></label>
              <label>Rótulo exibido<input id="s-extl" value="${DS.esc((cfg.store || {}).externalStoreLabel || '')}"></label>
              <label>Horário de atendimento<input id="s-hours" value="${DS.esc(cfg.brand.hours || '')}"></label>
              <label>Instagram<input id="s-ig" value="${DS.esc(cfg.brand.instagram || '')}"></label>
            </div>
            <div class="muted small mt8">Vitrine: <b>${DS.storeProducts().length}</b> modelagens em estampa total · <b>${DS.waProducts().length}</b> itens orçados pelo WhatsApp.</div>
            <div class="alert info mt8">${DS.icon('info')}<span>Para tirar um item da vitrine, marque "só WhatsApp" na aba <b>Catálogo</b>.</span></div>
          </div>
        </div>
        <button class="btn mt16" id="s-save">${DS.icon('check')}<span>Salvar configurações da loja</span></button>`;
      if (tab === 'producao') host.innerHTML = `
        <div class="grid-2">
          <div class="card"><h3>Janela semanal de estampa total</h3>
            <label class="block">Limite de peças por semana (somente estampa total)<input type="number" id="p-cap" value="${cfg.capacity.totalPerWeek}"></label>
            <label class="chip mt8"><input type="checkbox" id="p-enforce" ${cfg.capacity.enforce ? 'checked' : ''}> Bloquear pedidos que passem do limite (o site oferece o próximo lote/WhatsApp)</label>
            <div class="muted small mt8">Sublimação localizada, DTF e revenda <b>não</b> entram nesta contagem.</div>
          </div>
          <div class="card"><h3>Lote de estampa total (sábados)</h3>
            <div class="form-grid mt8">
              <label>Próxima data de lote<input type="date" id="p-batch" value="${(cfg.batch.nextDate || '').slice(0, 10)}"></label>
              <label>Dia da semana do lote<select id="p-weekday">${[[6, 'Sábado'], [5, 'Sexta'], [4, 'Quinta'], [1, 'Segunda']].map(([v, l]) => `<option value="${v}" ${cfg.batch.weekday === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            </div>
            <label class="block mt8">Aviso exibido no site<input id="p-bnote" value="${DS.esc(cfg.batch.note || '')}"></label>
            <div class="muted small mt8">O lote fecha conforme o volume de pedidos. Quando a data passar, o sistema avança sozinho para o próximo ${cfg.batch.weekday === 6 ? 'sábado' : 'dia configurado'}.</div>
          </div>
          <div class="card"><h3>Prazos (dias após arte aprovada + pagamento)</h3>
            <div class="form-grid mt8">
              <label>Estampa total — mínimo<input type="number" id="p-tmin" value="${cfg.leadTimes.total.min}"></label>
              <label>Estampa total — máximo<input type="number" id="p-tmax" value="${cfg.leadTimes.total.max}"></label>
              <label>Sublimação localizada — mínimo<input type="number" id="p-smin" value="${cfg.leadTimes.sublimacao_localizada.min}"></label>
              <label>Sublimação localizada — máximo<input type="number" id="p-smax" value="${cfg.leadTimes.sublimacao_localizada.max}"></label>
              <label>DTF — mínimo<input type="number" id="p-dmin" value="${cfg.leadTimes.dtf.min}"></label>
              <label>DTF — máximo<input type="number" id="p-dmax" value="${cfg.leadTimes.dtf.max}"></label>
              <label>Revenda — mínimo<input type="number" id="p-rmin" value="${cfg.leadTimes.revenda.min}"></label>
              <label>Revenda — máximo<input type="number" id="p-rmax" value="${cfg.leadTimes.revenda.max}"></label>
            </div>
          </div>
          <div class="card"><h3>Regras do pedido</h3>
            <div class="form-grid mt8">
              <label>Parcelas no cartão (pedido estampado)<input type="number" id="r-inst" value="${cfg.rules.installmentMax}"></label>
              <label>Parcelas na revenda<input type="number" id="r-inst2" value="${cfg.rules.installmentMaxResale || 12}"></label>
              <label>Entrada sugerida (%)<input type="number" id="r-dep" value="${cfg.rules.depositPercent}"></label>
              <label>Desconto PIX (%)<input type="number" id="r-pix" value="${cfg.rules.pixDiscountPercent || 0}"></label>
            </div>
            <label class="chip mt8"><input type="checkbox" id="r-art" ${cfg.rules.requireArtApproval ? 'checked' : ''}> Exigir aprovação de arte antes de produzir</label>
            <div class="alert info mt8">${DS.icon('note')}<span><b>Sem quantidade mínima</b> em qualquer item: o sistema aceita pedidos de 1 unidade em diante.</span></div>
            <div class="muted small mt8">Alterações do cliente pelo site: somente na mesma semana do pedido.</div>
          </div>
        </div>
        <button class="btn mt16" id="p-save">${DS.icon('check')}<span>Salvar lote, janela e prazos</span></button>`;
      if (tab === 'precos') host.innerHTML = `
        <div class="grid-2">
          <div class="card"><h3>Estampa total — faixas de quantidade</h3>
            ${['dryfit', 'poliflex'].map(f => `<h4 class="mt12">${DS.esc(DS.fabricName(f))}</h4>
              <div class="form-grid">${(cfg.prices.total[f] || []).map((t, i) => `
                <label>Até ${t.upTo == null ? '∞' : t.upTo} peças<input type="number" step="0.01" data-tier="${f}|${i}" value="${t.price}"></label>`).join('')}</div>`).join('')}
            <div class="muted small mt8">Ex.: Dry Fit R$55,00 até 10 peças e R$50,00 acima de 10. A faixa é calculada pelo total de peças de estampa total do mesmo tecido no pedido.</div>
            <h4 class="mt16">Gola e manga (estampa total)</h4>
            <div class="form-grid">${(cfg.totalAddons || []).map((x, i) => `<label>${DS.esc(x.label)}<input type="number" step="0.01" data-addon="${i}" value="${x.price}"></label>`).join('')}</div>
            <h4 class="mt16">Adicional por modelagem (delta)</h4>
            <div class="muted small">Use quando uma modelagem tiver preço diferente da camiseta (ex.: regata, baby look, nadador, machão, calça capoeira). Hoje está zerado — todas usam a mesma tabela.</div>
            <div class="form-grid mt8">${DS.storeProducts().map(p2 => `<label>${DS.esc(p2.name)}<input type="number" step="0.01" data-delta="${p2.id}" value="${p2.delta || 0}"></label>`).join('')}</div>
            <h4 class="mt16">Tamanhos acima do GG</h4>
            <div class="form-grid">
              <label>Acréscimo por tamanho (EXG, G1…G6)<input type="number" step="0.01" id="pr-sur" value="${cfg.prices.sizeSurchargeAboveGG}"></label>
              <label>Tamanho de referência<select id="pr-fallback">${(cfg.prices.sizeOrder || []).map(sz => `<option value="${sz}" ${sz === cfg.prices.sizeFallback ? 'selected' : ''}>${sz}</option>`).join('')}</select></label>
            </div>
          </div>
          <div class="card"><h3>Estampa localizada — valor por tamanho</h3>
            <table class="tbl mt8"><thead><tr><th>Tamanho</th><th>Sublimação</th><th>DTF</th></tr></thead><tbody>
              ${['10x10', 'A4', 'A3'].map(sz => `<tr><td><b>${sz === '10x10' ? '10 × 10 cm' : sz}</b></td>
                <td><input type="number" step="0.01" style="max-width:120px" data-print="sublimacao|${sz}" value="${(cfg.prices.print.sublimacao || {})[sz]}"></td>
                <td><input type="number" step="0.01" style="max-width:120px" data-print="dtf|${sz}" value="${(cfg.prices.print.dtf || {})[sz]}"></td></tr>`).join('')}
            </tbody></table>
            <div class="muted small mt8">O valor da estampa é somado ao valor da peça lisa (tabela do marketplace). Duas estampas no mesmo item somam (ex.: A3 nas costas + 10×10 no peito).</div>
            <h4 class="mt16">Itens extras (por unidade)</h4>
            ${(cfg.extras || []).map((x, i) => `<div class="row gap mt8"><input data-extra="${i}|label" value="${DS.esc(x.label)}"><input type="number" step="0.01" data-extra="${i}|price" value="${x.price == null ? '' : x.price}" placeholder="sob consulta" style="max-width:130px"><button class="icon-btn danger" data-extra-del="${i}">${DS.icon('x')}</button></div>`).join('')}
            <button class="btn ghost small mt12" id="ext-add">${DS.icon('plus')}<span>Adicionar item extra</span></button>
          </div>
        </div>
        <button class="btn mt16" id="pr-save">${DS.icon('check')}<span>Salvar preços</span></button>`;
      if (tab === 'acabamentos') host.innerHTML = `
        <div class="card"><h3>Itens extras e acabamentos</h3>
          <div class="muted small">Estes valores entram por unidade no pedido (nome, número, etiqueta, embalagem…). Deixe o preço vazio para “sob consulta”.</div>
          ${(cfg.extras || []).map((x, i) => `<div class="row gap mt8"><input data-extra="${i}|label" value="${DS.esc(x.label)}"><input type="number" step="0.01" data-extra="${i}|price" value="${x.price == null ? '' : x.price}" placeholder="sob consulta" style="max-width:130px"><button class="icon-btn danger" data-extra-del="${i}">${DS.icon('x')}</button></div>`).join('')}
          <button class="btn ghost small mt12" id="ext-add">${DS.icon('plus')}<span>Adicionar item extra</span></button>
          <h4 class="mt16">Gola e manga da estampa total</h4>
          ${(cfg.totalAddons || []).map((x, i) => `<div class="row gap mt8"><input data-addon-label="${i}" value="${DS.esc(x.label)}"><input type="number" step="0.01" data-addon="${i}" value="${x.price}" style="max-width:130px"></div>`).join('')}
        </div>
        <button class="btn mt16" id="ac-save">${DS.icon('check')}<span>Salvar extras e acabamentos</span></button>`;
      if (tab === 'catalogo') host.innerHTML = `
        <div class="card"><h3>Marketplace — produtos e valores de revenda</h3>
          <div class="muted small">Mesma base da loja <a href="${DS.esc(cfg.brand.site || '#')}" target="_blank" rel="noopener">dstamp.com.br</a>. O valor da peça lisa é usado na revenda <b>e</b> como base da estampa localizada (peça + estampa).</div>
          <div class="table-scroll mt12"><table class="tbl small"><thead><tr><th>Produto</th><th>Categoria</th><th>Cor / versão</th><th>Valor (R$)</th><th>Adicional</th><th>Sob consulta</th><th>Só WhatsApp</th></tr></thead><tbody>
          ${DS.products().map(p => (p.colors || []).length
            ? p.colors.map((cc, ci) => `<tr><td>${ci === 0 ? DS.esc(p.name) : ''}</td><td>${ci === 0 ? DS.esc(DS.categoryName(p.category)) : ''}</td><td>${DS.esc(cc.name)}${cc.light === false ? ' <span class="muted small">(só DTF)</span>' : ''}</td>
                <td><input type="number" step="0.01" style="max-width:110px" data-color="${p.id}|${ci}" value="${cc.price}"></td>
                <td>${ci === 0 ? `<input type="number" step="0.01" style="max-width:90px" data-delta="${p.id}" value="${p.delta || 0}">` : ''}</td>
                <td>${ci === 0 ? `<label class="chip"><input type="checkbox" data-onreq="${p.id}" ${p.priceOnRequest ? 'checked' : ''}> consulta</label>` : ''}</td>
                <td>${ci === 0 ? `<label class="chip"><input type="checkbox" data-wa="${p.id}" ${p.whatsappOnly ? 'checked' : ''}> ocultar da vitrine</label>` : ''}</td></tr>`).join('')
            : `<tr><td>${DS.esc(p.name)}</td><td>${DS.esc(DS.categoryName(p.category))}</td><td class="muted small">${p.blank != null ? 'peça única' : '—'}</td>
                <td>${p.blank != null ? `<input type="number" step="0.01" style="max-width:110px" data-blank="${p.id}" value="${p.blank}">` : `<span class="muted small">${(p.techniques || []).includes('total') ? 'tabela Dry Fit/Poliflex' : '—'}</span>`}</td>
                <td><input type="number" step="0.01" style="max-width:90px" data-delta="${p.id}" value="${p.delta || 0}"></td>
                <td><label class="chip"><input type="checkbox" data-onreq="${p.id}" ${p.priceOnRequest ? 'checked' : ''}> consulta</label></td>
                <td><label class="chip"><input type="checkbox" data-wa="${p.id}" ${p.whatsappOnly ? 'checked' : ''}> ocultar da vitrine</label></td></tr>`).join('')}
          </tbody></table></div>
          <div class="row gap mt12">
            <button class="btn" id="cat-save">${DS.icon('check')}<span>Salvar valores do marketplace</span></button>
            <button class="btn ghost" id="cat-add">${DS.icon('plus')}<span>Novo produto</span></button>
          </div>
          <div class="muted small mt8">Técnicas aceitas, tamanhos de estampa e grades de tamanho de cada produto ficam no cadastro do produto (edite pelo botão “Novo produto” ou peça ao dev para incluir em lote).</div>
        </div>`;
      if (tab === 'regras') host.innerHTML = `
        <div class="card"><h3>Pagamento e regras comerciais</h3>
          <div class="form-grid mt12">
            <label>Parcelas no cartão<input type="number" id="g-inst" value="${cfg.rules.installmentMax}"></label>
            <label>Entrada sugerida (%)<input type="number" id="g-dep" value="${cfg.rules.depositPercent}"></label>
          </div>
          <label class="chip mt8"><input type="checkbox" id="g-art" ${cfg.rules.requireArtApproval ? 'checked' : ''}> Exigir aprovação de arte antes de produzir</label>
          <div class="alert warn mt12">${DS.icon('alert')}<span>Janela de alteração pelo cliente: <b>somente na mesma semana do pedido</b>. Depois disso, apenas o atendente altera — o sistema já bloqueia a edição do cliente automaticamente.</span></div>
          <button class="btn mt12" id="g-save">${DS.icon('check')}<span>Salvar regras</span></button>
        </div>`;
      if (tab === 'faq') host.innerHTML = `
        <div class="card"><h3>Perguntas frequentes do site</h3>
          ${(cfg.faq || []).map((f, i) => `<div class="card mini mt8">
            <input data-faq="${i}|q" value="${DS.esc(f.q)}" placeholder="Pergunta">
            <textarea data-faq="${i}|a" rows="2" class="mt8" placeholder="Resposta">${DS.esc(f.a)}</textarea>
            <button class="btn ghost small mt8" data-faq-del="${i}">remover</button></div>`).join('')}
          <button class="btn ghost small mt12" id="faq-add">${DS.icon('plus')}<span>Adicionar pergunta</span></button>
          <button class="btn mt12" id="faq-save">${DS.icon('check')}<span>Salvar FAQ</span></button>
        </div>`;
      if (tab === 'guia') host.innerHTML = `
        <div class="card"><h3>Conteúdo explicativo do site (página "Como funciona")</h3>
          <div class="muted small">Cada bloco vira uma seção da página do cliente. É aqui que você explica tecido, prazo, tamanho, arte, pagamento e cuidados — sem precisar do programador.</div>
          ${(cfg.info || []).map((b, i) => `<div class="card mini mt12">
            <div class="row between wrap-row"><b>${i + 1}. ${DS.esc(b.title)}</b><span class="muted small">${DS.esc(b.group || '')} · #${DS.esc(b.id)}</span></div>
            <div class="form-grid mt8">
              <label>Título<input data-info="${i}|title" value="${DS.esc(b.title)}"></label>
              <label>Grupo<select data-info="${i}|group">${[...new Set((cfg.info || []).map(x => x.group))].map(g => `<option ${g === b.group ? 'selected' : ''}>${DS.esc(g)}</option>`).join('')}</select></label>
              <label>Ícone<select data-info="${i}|icon">${DS.iconNames().map(n => `<option value="${n}" ${n === b.icon ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
              <label>Tags (separadas por vírgula)<input data-info="${i}|tags" value="${DS.esc((b.tags || []).join(', '))}"></label>
            </div>
            <label class="block mt8">Introdução<textarea data-info="${i}|lead" rows="2">${DS.esc(b.lead || '')}</textarea></label>
            <label class="block mt8">Passo a passo (um por linha)<textarea data-info="${i}|steps" rows="3">${DS.esc((b.steps || []).join('\n'))}</textarea></label>
            <label class="block mt8">Tópicos (um por linha)<textarea data-info="${i}|bullets" rows="4">${DS.esc((b.bullets || []).join('\n'))}</textarea></label>
            <label class="block mt8">Tabela em JSON (opcional — head/rows)<textarea data-info="${i}|table" rows="3">${DS.esc(b.table ? JSON.stringify(b.table) : '')}</textarea></label>
            <label class="block mt8">Aviso final<textarea data-info="${i}|note" rows="2">${DS.esc(b.note || '')}</textarea></label>
            <button class="btn ghost small mt8" data-info-del="${i}">remover bloco</button>
          </div>`).join('')}
          <div class="btn-row mt12">
            <button class="btn ghost" id="info-add">${DS.icon('plus')}<span>Adicionar bloco</span></button>
            <button class="btn" id="info-save">${DS.icon('check')}<span>Salvar guia do site</span></button>
          </div>
        </div>`;
      if (tab === 'usuarios') renderUsers(host);
      if (tab === 'integracoes') host.innerHTML = `
        <div class="grid-2">
          <div class="card"><h3>Olist</h3>
            <label class="chip mt8"><input type="checkbox" id="i-olist" ${cfg.integrations.olist.enabled ? 'checked' : ''}> Integração ativa</label>
            <p class="muted small mt8">${DS.esc(cfg.integrations.olist.note)}</p>
            <div class="row gap mt12"><button class="btn ghost small" id="i-olist-dl">${DS.icon('download')}<span>Baixar CSV (padrão Olist)</span></button></div>
            <div class="muted small mt8">Campos: Número do Pedido · Data · Situação · Cliente · CPF/CNPJ · E-mail · Telefone · SKU · Produto · Variação · Quantidade · Valor Unitário · Valor Total · Forma de Pagamento · Observações.</div>
          </div>
          <div class="card"><h3>Sysloja</h3>
            <label class="chip mt8"><input type="checkbox" id="i-sys" ${cfg.integrations.sysloja.enabled ? 'checked' : ''}> Integração ativa</label>
            <p class="muted small mt8">${DS.esc(cfg.integrations.sysloja.note)}</p>
            <div class="row gap mt12"><button class="btn ghost small" id="i-sys-dl">${DS.icon('download')}<span>Baixar CSV (grade/ref.)</span></button></div>
            <div class="muted small mt8">Campos: Pedido · Cliente · Referência · Produto · Técnica · Tecido · Cor · Gola · Grade · Qtd · Preço · Total · Status. Use a referência <b>PRODUTO-TECIDO</b> para casar com o cadastro do Sysloja.</div>
          </div>
        </div>
        <div class="card mt16"><h3>Próximos passos da integração</h3>
          <ol class="steps-list">
            <li>Exportar o CSV e importar no Olist/Sysloja (ou pedir à TI a leitura automática).</li>
            <li>Padronizar o SKU: <code>PRODUTO-TECNICA-TECIDO</code> (ex.: <code>camiseta-total-dryfit</code>).</li>
            <li>Para automatizar de verdade: usar as URLs de notificação de pedido do Olist e o endpoint de pedidos do Sysloja apontando para este servidor — as mesmas rotas da API podem ser reusadas.</li>
          </ol>
        </div>
        <button class="btn mt16" id="i-save">${DS.icon('check')}<span>Salvar integrações</span></button>`;
      if (tab === 'logs') host.innerHTML = '<div class="card"><h3>Log de auditoria</h3><div id="lg-list" class="list mt12 muted small">carregando…</div></div>', loadLogs(host);

      /* binds */
      const save = async (payload, msg) => {
        try { await DS.api('/config', { method: 'PUT', body: payload }); DS.resetBoot(); await DS.boot(true); DS.toast(msg || 'Configuração salva.'); draw(); } catch (e) { DS.toastErr(e); }
      };
      if (tab === 'marca') host.querySelector('#k-save').addEventListener('click', () => {
        const anns = [...host.querySelectorAll('#an-list [data-an-text]')].map(inp => {
          const row = inp.closest('.an-row');
          const on = row.querySelector('input[type=checkbox]');
          return { id: inp.getAttribute('data-an-text'), text: inp.value.trim(), active: !!(on && on.checked) };
        }).filter(a => a.text);
        save({ brand: { name: host.querySelector('#k-name').value, whatsapp: host.querySelector('#k-wa').value.replace(/\D/g, ''), whatsappLabel: host.querySelector('#k-wal').value, email: host.querySelector('#k-email').value, instagram: host.querySelector('#k-inst').value, city: host.querySelector('#k-city').value, address: host.querySelector('#k-addr').value, announcements: anns }, maps: { query: host.querySelector('#k-maps').value } }, 'Marca, contato e avisos atualizados.');
      });
      if (tab === 'producao') host.querySelector('#p-save').addEventListener('click', () => save({
        capacity: { totalPerWeek: Number(host.querySelector('#p-cap').value), enforce: host.querySelector('#p-enforce').checked },
        batch: { nextDate: host.querySelector('#p-batch').value, weekday: Number(host.querySelector('#p-weekday').value), note: host.querySelector('#p-bnote').value },
        leadTimes: {
          total: { min: Number(host.querySelector('#p-tmin').value), max: Number(host.querySelector('#p-tmax').value), batch: true },
          sublimacao_localizada: { min: Number(host.querySelector('#p-smin').value), max: Number(host.querySelector('#p-smax').value) },
          dtf: { min: Number(host.querySelector('#p-dmin').value), max: Number(host.querySelector('#p-dmax').value) },
          revenda: { min: Number(host.querySelector('#p-rmin').value), max: Number(host.querySelector('#p-rmax').value) }
        },
        rules: { installmentMax: Number(host.querySelector('#r-inst').value), installmentMaxResale: Number(host.querySelector('#r-inst2').value), depositPercent: Number(host.querySelector('#r-dep').value), pixDiscountPercent: Number(host.querySelector('#r-pix').value), requireArtApproval: host.querySelector('#r-art').checked, editWindow: 'same_week', noMinimum: true }
      }, 'Lote, janela, prazos e regras atualizados.'));
      if (tab === 'precos') host.querySelector('#pr-save').addEventListener('click', () => {
        const prices = JSON.parse(JSON.stringify(cfg.prices));
        const addons = JSON.parse(JSON.stringify(cfg.totalAddons || []));
        const extras = JSON.parse(JSON.stringify(cfg.extras || []));
        host.querySelectorAll('[data-tier]').forEach(i => { const [f, idx] = i.dataset.tier.split('|'); prices.total[f][Number(idx)].price = Number(i.value); });
        host.querySelectorAll('[data-print]').forEach(i => { const [t, sz] = i.dataset.print.split('|'); prices.print[t][sz] = Number(i.value); });
        host.querySelectorAll('[data-addon]').forEach(i => { addons[Number(i.dataset.addon)].price = Number(i.value); });
        host.querySelectorAll('[data-extra]').forEach(i => { const [idx, f] = i.dataset.extra.split('|'); extras[Number(idx)][f] = f === 'price' ? (i.value === '' ? null : Number(i.value)) : i.value; });
        prices.sizeSurchargeAboveGG = Number(host.querySelector('#pr-sur').value);
        prices.sizeFallback = host.querySelector('#pr-fallback').value;
        const products = JSON.parse(JSON.stringify(DS.products()));
        host.querySelectorAll('[data-delta]').forEach(i => { const p2 = products.find(x => x.id === i.dataset.delta); if (p2) p2.delta = Number(i.value || 0); });
        save({ prices: prices, totalAddons: addons, extras: extras, catalog: { products: products } }, 'Preços atualizados no site e no carrinho.');
      });
      if (tab === 'acabamentos') {
        host.querySelector('#ext-add').addEventListener('click', () => { const e2 = DS.catalog().extras.concat([{ code: 'extra_' + Date.now(), label: 'Novo item extra', price: null, unit: 'peça', techniques: ['total', 'sublimacao_localizada', 'dtf'] }]); save({ extras: e2 }, 'Item extra adicionado.'); });
        host.querySelectorAll('[data-extra-del]').forEach(b2 => b2.addEventListener('click', () => { const e2 = DS.catalog().extras.filter((x, i) => i !== Number(b2.dataset.extraDel)); save({ extras: e2 }, 'Item extra removido.'); }));
        host.querySelector('#ac-save').addEventListener('click', () => {
          const extras = DS.catalog().extras.slice(), addons = (cfg.totalAddons || []).slice();
          host.querySelectorAll('[data-extra]').forEach(inp => { const [i, f] = inp.dataset.extra.split('|'); extras[Number(i)][f] = f === 'price' ? (inp.value === '' ? null : Number(inp.value)) : inp.value; });
          host.querySelectorAll('[data-addon]').forEach(inp => { addons[Number(inp.dataset.addon)].price = Number(inp.value); });
          host.querySelectorAll('[data-addon-label]').forEach(inp => { addons[Number(inp.dataset.addonLabel)].label = inp.value; });
          save({ extras: extras, totalAddons: addons }, 'Extras e acabamentos salvos.');
        });
      }
      if (tab === 'catalogo') {
        host.querySelector('#cat-save').addEventListener('click', () => {
          const products = JSON.parse(JSON.stringify(DS.products()));
          host.querySelectorAll('[data-color]').forEach(inp => {
            const [pid, ci] = inp.dataset.color.split('|');
            const p2 = products.find(x => x.id === pid); if (p2) p2.colors[Number(ci)].price = Number(inp.value);
          });
          host.querySelectorAll('[data-blank]').forEach(inp => {
            const p2 = products.find(x => x.id === inp.dataset.blank); if (p2) p2.blank = Number(inp.value);
          });
          host.querySelectorAll('[data-onreq]').forEach(inp => {
            const p2 = products.find(x => x.id === inp.dataset.onreq); if (p2) p2.priceOnRequest = inp.checked;
          });
          host.querySelectorAll('[data-delta]').forEach(inp => {
            const p2 = products.find(x => x.id === inp.dataset.delta); if (p2) p2.delta = Number(inp.value || 0);
          });
          host.querySelectorAll('[data-wa]').forEach(inp => {
            const p2 = products.find(x => x.id === inp.dataset.wa); if (p2) p2.whatsappOnly = inp.checked;
          });
          save({ catalog: { products: products } }, 'Valores do marketplace atualizados.');
        });
        host.querySelector('#cat-add').addEventListener('click', () => {
          const id = 'prod_' + Date.now().toString(36);
          const products = DS.products().concat([{
            id: id, name: 'Nova modelagem', short: 'descreva em poucas palavras', category: (DS.categories()[0] || {}).id || 'total', kind: 'textil',
            techniques: ['total'], sizesKey: { total: 'total' }, collar: ['redonda', 'v'], sleeve: ['curta', 'longa'], delta: 0,
            img: '/img/exemplo-total-1.jpg', desc: '', bullets: [], tags: []
          }]);
          save({ catalog: { products: products } }, 'Produto criado — edite o nome e o valor.');
        });
      }
      if (tab === 'loja') host.querySelector('#s-save').addEventListener('click', () => save({
        store: { focus: host.querySelector('#s-focus').value, localizedSelfService: host.querySelector('#s-self').checked,
                 showReferencePrices: host.querySelector('#s-ref').checked, externalStore: host.querySelector('#s-ext').value,
                 externalStoreLabel: host.querySelector('#s-extl').value },
        rules: { noMinimum: host.querySelector('#s-nomin').checked },
        brand: { hours: host.querySelector('#s-hours').value, instagram: host.querySelector('#s-ig').value }
      }, 'Configurações da loja salvas.'));
      if (tab === 'guia') {
        host.querySelector('#info-add').addEventListener('click', () => {
          const info = (DS.config().info || []).concat([{ id: 'bloco-' + Date.now().toString(36), group: 'Entenda a estampa', icon: 'info', tags: [], title: 'Novo assunto', lead: '', bullets: [], steps: [], note: '' }]);
          save({ info: info }, 'Bloco adicionado — edite o conteúdo.');
        });
        host.querySelectorAll('[data-info-del]').forEach(b => b.addEventListener('click', () => {
          const info = (DS.config().info || []).filter((x, i) => i !== Number(b.dataset.infoDel));
          save({ info: info }, 'Bloco removido.');
        }));
        host.querySelector('#info-save').addEventListener('click', () => {
          const info = JSON.parse(JSON.stringify(DS.config().info || []));
          host.querySelectorAll('[data-info]').forEach(inp => {
            const [i, k] = inp.dataset.info.split('|'); const b = info[Number(i)]; if (!b) return;
            if (k === 'tags') b.tags = inp.value.split(',').map(x => x.trim()).filter(Boolean);
            else if (k === 'steps' || k === 'bullets') b[k] = inp.value.split('\n').map(x => x.trim()).filter(Boolean);
            else if (k === 'table') { try { b.table = inp.value.trim() ? JSON.parse(inp.value) : null; } catch (e) { DS.toast('JSON da tabela inválido no bloco ' + (Number(i) + 1), 'err'); } }
            else b[k] = inp.value;
          });
          save({ info: info }, 'Guia do site atualizado.');
        });
      }
      if (tab === 'regras') host.querySelector('#g-save').addEventListener('click', () => save({ rules: { installmentMax: Number(host.querySelector('#g-inst').value), depositPercent: Number(host.querySelector('#g-dep').value), requireArtApproval: host.querySelector('#g-art').checked, editWindow: 'same_week' } }, 'Regras atualizadas.'));
      if (tab === 'faq') {
        host.querySelector('#faq-add').addEventListener('click', () => { const f = (DS.config().faq || []).concat([{ q: 'Nova pergunta', a: '' }]); save({ faq: f }, 'Pergunta adicionada.'); });
        host.querySelectorAll('[data-faq-del]').forEach(b => b.addEventListener('click', () => { const f = (DS.config().faq || []).filter((x, i) => i !== Number(b.dataset.faqDel)); save({ faq: f }, 'Pergunta removida.'); }));
        host.querySelector('#faq-save').addEventListener('click', () => {
          const f = (DS.config().faq || []).slice();
          host.querySelectorAll('[data-faq]').forEach(inp => { const [i, k] = inp.dataset.faq.split('|'); f[Number(i)][k] = inp.value; });
          save({ faq: f }, 'FAQ salvo.');
        });
      }
      if (tab === 'integracoes') {
        host.querySelector('#i-olist-dl').addEventListener('click', () => downloadCsv('olist'));
        host.querySelector('#i-sys-dl').addEventListener('click', () => downloadCsv('sysloja'));
        host.querySelector('#i-save').addEventListener('click', () => save({ integrations: { olist: { enabled: host.querySelector('#i-olist').checked, note: cfg.integrations.olist.note }, sysloja: { enabled: host.querySelector('#i-sys').checked, note: cfg.integrations.sysloja.note } } }, 'Integrações salvas.'));
      }
    };
    draw();
  };

  async function loadLogs(host) {
    try {
      const r = await DS.api('/logs');
      host.querySelector('#lg-list').innerHTML = r.logs.slice(0, 120).map(l => `<div class="line"><span class="muted small">${DS.dtTime(l.at)}</span> <b>${DS.esc(l.action)}</b> <span class="muted small">${DS.esc(JSON.stringify(l.data))} · ${DS.esc(l.by)}</span></div>`).join('') || '<div class="muted small">Sem registros.</div>';
    } catch (e) { host.querySelector('#lg-list').innerHTML = '<div class="muted small">Erro ao carregar logs.</div>'; }
  }

  async function renderUsers(host) {
    const r = await DS.api('/users');
    host.innerHTML = `
      <div class="card"><h3>Usuários e permissões</h3>
        <div class="muted small">Administrador: tudo, incluindo preços e janelas. Atendente: pedidos, clientes, comprovantes e chamados. Designer: artes e fichas técnicas.</div>
        <div class="table-scroll mt12"><table class="tbl"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
          <tbody>${r.users.map(u => `<tr>
            <td>${DS.esc(u.name)}</td><td>${DS.esc(u.email)}</td>
            <td><select data-role="${u.id}">${['admin', 'atendente', 'designer'].map(x => `<option value="${x}" ${x === u.role ? 'selected' : ''}>${ROLE_LABEL[x]}</option>`).join('')}</select></td>
            <td>${u.active ? DS.badge('ativo', '#3DD68C') : DS.badge('inativo', '#8A93A6')}</td>
            <td class="row gap"><button class="btn ghost small" data-toggle="${u.id}" data-on="${u.active}">${u.active ? 'Desativar' : 'Ativar'}</button>
            <button class="btn ghost small" data-pass="${u.id}">Trocar senha</button></td>
          </tr>`).join('')}</tbody></table></div>
        <hr><h4>Novo usuário</h4>
        <div class="form-grid mt8">
          <label>Nome<input id="u-name"></label><label>E-mail<input id="u-email"></label>
          <label>Senha<input id="u-pass" type="text"></label>
          <label>Perfil<select id="u-role"><option value="atendente">Atendente</option><option value="admin">Administrador</option><option value="designer">Designer</option></select></label>
        </div>
        <button class="btn mt12" id="u-add">${DS.icon('plus')}<span>Cadastrar usuário</span></button>
      </div>`;
    host.querySelector('#u-add').addEventListener('click', async () => {
      try {
        await DS.api('/users', { method: 'POST', body: { name: host.querySelector('#u-name').value, email: host.querySelector('#u-email').value, password: host.querySelector('#u-pass').value, role: host.querySelector('#u-role').value } });
        DS.toast('Usuário cadastrado.'); renderUsers(host);
      } catch (e) { DS.toastErr(e); }
    });
    host.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', async () => { try { await DS.api('/users/' + s.dataset.role, { method: 'PATCH', body: { role: s.value } }); DS.toast('Perfil atualizado.'); } catch (e) { DS.toastErr(e); } }));
    host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => { try { await DS.api('/users/' + b.dataset.toggle, { method: 'PATCH', body: { active: b.dataset.on !== 'true' } }); DS.toast('Status atualizado.'); renderUsers(host); } catch (e) { DS.toastErr(e); } }));
    host.querySelectorAll('[data-pass]').forEach(b => b.addEventListener('click', async () => {
      const pass = prompt('Nova senha para este usuário:');
      if (!pass) return;
      try { await DS.api('/users/' + b.dataset.pass, { method: 'PATCH', body: { password: pass } }); DS.toast('Senha atualizada.'); } catch (e) { DS.toastErr(e); }
    }));
  }
})();
