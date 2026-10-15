# Como publicar o site (passo a passo curto)

## Antes: por que não dá no Google Sites
O Google Sites só monta **páginas** no editor dele (ou incorpora um iframe). Este projeto é um **aplicativo com servidor Node + banco de dados** (motor de preço, lotes, pedidos, painel da equipe, uploads de arte e comprovante). O Google Sites **não executa servidor nem guarda dados** — então ele não consegue hospedar este site.

O que dá para fazer:
1. **Publicar o site de verdade em uma hospedagem gratuita** (Render, sem cartão) → você recebe um link público.
2. **Se quiser mesmo o Google no meio:** crie uma página no Google Sites e use o componente **Incorporar → por URL** apontando para o link do Render. O site funciona dentro da página do Google.

---

## Opção 1 — Render free (recomendada, sem cartão, ~10 min)

1. Crie uma conta grátis em **github.com** e outra em **render.com** (pode usar o Google para entrar).
2. No GitHub: **New repository** → nome `dstamp` → **Private** → **Create**.
3. Na tela seguinte: **uploading an existing file** → arraste **todo o conteúdo desta pasta** (não precisa mandar `node_modules`) → **Commit changes**.
4. No Render: **New → Web Service** → conecte o repositório `dstamp`.
5. Preencha: **Runtime** Node · **Build** `npm install --omit=dev` · **Start** `node server.js` · **Instance type** **Free** · **Health check path** `/api/health`.
6. Em **Environment**, adicione:
   ```
   NODE_VERSION=20.18.0
   DSTAMP_NO_DEMO=1
   DSTAMP_ADMIN_EMAIL=seuemail@exemplo.com
   DSTAMP_ADMIN_PASSWORD=uma-senha-forte-sua
   ```
   ⚠️ **Nunca** defina `DSTAMP_DEV` em produção (ele liga a rota que zera o banco).
7. **Create Web Service** → em ~2 minutos você tem `https://dstamp.onrender.com` (esse é o seu link público).
8. Faça o login no painel com o e-mail/senha do passo 6 e confira `Administração → Marca e contato` (WhatsApp, endereço e avisos do topo).

**Duas limitações do plano grátis (dá para contornar):**
| Limitação | Solução |
|---|---|
| O site **dorme** após 15 min sem acesso (o primeiro clique demora ~40 s) | Ping grátis a cada 10 min em `/api/health` no [cron-job.org](https://cron-job.org) ou UptimeRobot |
| O **disco é apagado** a cada deploy/restart (pedidos e uploads voltam ao estado inicial) | `npm run backup` antes de deploy; quando entrar pedido real, migre para Oracle Always Free ou VPS (disco persistente) |

---

## Opção 2 — Rodar no seu computador (para testar)

```bash
npm install          # só instala o jsdom dos testes (o site não tem dependências)
npm start            # abre em http://localhost:3000
npm run reset        # volta ao banco de demonstração
npm test             # 179 verificações de preço/regra
npm run test:ui      # 344 verificações de interface
```

---

## Opção 3 — Oracle Cloud / VPS / Docker (link permanente e disco que não apaga)

Está tudo detalhado em **`DEPLOY.md`** (Opção B = Oracle Always Free, Opção C = Docker, Opção D = VPS brasileira R$ 25–40/mês) + o dimensionamento para **20 mil visitas/mês**.

---

## O que tem nesta pasta

| Arquivo / pasta | Para que serve |
|---|---|
| `server.js` | Servidor completo (API, banco JSON, regras de preço, lotes, uploads) — **zero dependências** |
| `public/` | Site inteiro: `index.html`, `js/app.js`, `js/loja.js`, `js/painel.js`, `js/core.js`, `img/` |
| `data/` | Banco e uploads (criado automaticamente na primeira execução; **não** vai para o GitHub) |
| `test/` | `price-test.js` e `dom-test.js` (523 verificações) |
| `tools/backup.js` | Backup/restore do banco + uploads (`npm run backup`) |
| `render.yaml`, `Dockerfile`, `docker-compose.yml` | Publicação no Render / contêiner |
| `README.md` | Como o sistema funciona (regras, rotas, API, painel) |
| `DEPLOY.md` | Comparativo de hospedagem grátis + passo a passo completo |
| `SWOT.md` · `PERGUNTAS-E-DECISOES.md` | Análise de negócio e decisões registradas |
