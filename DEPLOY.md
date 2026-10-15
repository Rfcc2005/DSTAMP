# Deploy da D-Stamp — grátis agora, pronto para 20 mil visitas/mês depois

**Resumo da resposta:** sim, dá para hospedar **de graça e sem cartão**. O caminho é o **Render free** (sobe em ~10 minutos, `https://seusite.onrender.com`), com duas limitações que dá para contornar: o site **dorme** depois de 15 minutos sem acesso (um ping grátis em `/api/health` resolve) e o **disco é apagado a cada deploy/restart** (por isso o `npm run backup` diário).

A **Oracle Cloud "Always Free"** é o único grátis *de verdade* (VM ligada 24h, 200 GB de disco, 10 TB de tráfego), **mas exige cartão de crédito para verificação** — a Oracle declara que não cobra no plano Always Free, ainda assim faz uma pré-autorização temporária. Como você pediu "sem cartão, ou com cartão apenas se não houver cobrança nenhuma", ela fica como **plano B**, para quando o site começar a receber pedidos reais. Koyeb e Northflank também pedem cartão; Fly.io e Heroku não têm mais plano grátis; Vercel e Netlify não servem (não rodam um servidor Node contínuo que grava em disco).

Para as **20 mil visitas/mês** da fase 2, o gargalo não é processamento — é **tráfego de imagens**. O plano free do Render (5 GB/mês) não cobre; Oracle Always Free (10 TB/mês), Render Starter (US$ 7 ≈ R$ 40/mês, 200 GB) ou uma VPS brasileira (R$ 25–40/mês) cobrem com folga. Colocar o **Cloudflare grátis** na frente resolve quase tudo (cache das imagens em São Paulo).

---

## 1. O que já deixei pronto no código para o deploy

| Recurso | Como usar | Por quê |
|---|---|---|
| `PORT` e `HOST` por ambiente | `PORT=8080 node server.js` | toda plataforma PaaS define a porta |
| `DSTAMP_DATA` | `DSTAMP_DATA=/var/data node server.js` | banco e uploads num **disco persistente** (fora da pasta do código) |
| `DSTAMP_NO_DEMO=1` | cria o banco **vazio**, sem os 8 pedidos de exemplo | produção não pode nascer com dados falsos |
| `DSTAMP_ADMIN_EMAIL` / `DSTAMP_ADMIN_PASSWORD` | define o administrador inicial | sem `admin123` em produção; se não informar senha, uma é **gerada e impressa uma vez** |
| `GET /api/health` | `{"ok":true,"version":"1.1.0","uptime":…}` | health check da plataforma + ping anti-sleep |
| `Dockerfile` + `docker-compose.yml` | `docker compose up -d` | sobe igual em Koyeb, Fly, Northflank, Oracle ou VPS |
| `render.yaml` | conectar o repositório no Render | cria o serviço com as variáveis certas |
| `npm run backup` / `restore` / `list` | `node tools/backup.js` | backup `.tar.gz` do banco + uploads, mantém os últimos 14 |
| Zero dependências | só Node 18+ | build de 5 segundos, nada para quebrar |

**Regra de ouro:** em produção **nunca** defina `DSTAMP_DEV` (ele liga a rota `POST /api/dev/reset`, que zera o banco).

---

## 2. Comparativo dos gratuitos (verificado em outubro/2026)

| Plataforma | Plano grátis | Cartão? | Dorme? | Disco persistente | Tráfego | Serve para a D-Stamp? |
|---|---|---|---|---|---|---|
| **Render** (web service) | 750 h/mês, 512 MB, 0,1 CPU | **NÃO** | sim, 15 min sem tráfego (acorda em ~30–60 s) | **não** no free | 5 GB/mês | ✅ **recomendado para começar** — sem cartão |
| **Oracle Cloud Always Free** | VM Arm com 2–4 núcleos e 12–24 GB RAM, 200 GB de disco | **sim** (verificação; declara não cobrar) | **não** | **sim** (a VM é sua) | **10 TB/mês** | ✅ melhor grátis em recursos — plano B quando houver pedidos reais |
| **Koyeb** | 1 serviço, 512 MB, 0,1 vCPU, 2 GB SSD | sim (pré-autorização ~US$ 29) | sim, após 1 h | limitado | generoso | ⚠️ alternativa ao Render |
| **Northflank** | 2 serviços que **não dormem** | sim (verificação) | não | não no free | — | ⚠️ bom se quiser grátis sempre ligado |
| **Railway** | crédito de teste (~US$ 5) | não no teste | — | — | — | só para experimentar |
| **Fly.io** | **sem free** desde out/2024 (só trial) | sim | auto-stop | volume pago | — | pago (~US$ 2/mês) |
| **Glitch / Heroku** | **não têm mais grátis** | — | — | — | — | ❌ |
| **Vercel / Netlify** | grátis | não | n/a | **não** (serverless/estático) | 100 GB | ❌ não rodam um servidor Node contínuo que grava em disco |

Fontes: [hostgage.com/best-free-nodejs-hosting](https://hostgage.com/best-free-nodejs-hosting/) · [snapdeploy.dev/deploy-nodejs-app](https://snapdeploy.dev/deploy-nodejs-app) · [snapdeploy.dev — 14 plataformas comparadas](https://snapdeploy.dev/blog/free-cloud-deployment-platforms-2026-comparison) · [granite.so/hosting/nodejs](https://granite.so/hosting/nodejs)

---

## 3. Opção A — Render free (recomendada: sem cartão, ~10 minutos)

```bash
# 1) Suba o projeto para um repositório GitHub (privado)
# 2) https://dashboard.render.com → New → Web Service → conecte o repositório
#    (ou New → Blueprint, se quiser usar o render.yaml pronto)
# 3) Configuração:
#    Runtime: Node  ·  Build: npm install --omit=dev  ·  Start: node server.js
#    Instance type: Free  ·  Health check path: /api/health
# 4) Environment:
#    NODE_VERSION=20.18.0
#    DSTAMP_NO_DEMO=1
#    DSTAMP_ADMIN_EMAIL=voce@exemplo.com
#    DSTAMP_ADMIN_PASSWORD=sua-senha-forte
#    (NUNCA defina DSTAMP_DEV)
# 5) Create Web Service → em ~2 min você tem https://dstamp.onrender.com
```

**Limitações que você precisa conhecer**

| Limitação | Consequência | Solução |
|---|---|---|
| Dorme após 15 min sem tráfego | o primeiro acesso do dia demora ~30–60 s | ping em `/api/health` a cada 10 min ([cron-job.org](https://cron-job.org) ou [UptimeRobot](https://uptimerobot.com), grátis) |
| **Disco efêmero** | `data/db.json` e uploads **voltam ao estado inicial a cada deploy/restart** | `npm run backup` antes de cada deploy; no plano Starter (US$ 7/mês) monte um disco em `/var/data` e use `DSTAMP_DATA=/var/data` |
| 750 h/mês e 512 MB | suficiente para 1 serviço ligado o mês inteiro (744 h) | nada a fazer |
| 5 GB de tráfego/mês | ~5.000 visitas com as imagens atuais | Cloudflare na frente (cache) ou Opção B |
| Sem domínio próprio no free | fica em `*.onrender.com` | domínio próprio entra no plano pago |

> **Comece por aqui.** Para uso pessoal e para o chefe navegar/validar o site, o Render free resolve sem cartão. Quando entrar pedido real de cliente, migre para a Opção B (Oracle) ou uma VPS (Opção D) por causa do disco persistente — o backup diário (`npm run backup`) cobre o intervalo.

---


## 4. Opção B — Oracle Cloud Always Free (R$ 0/mês, mas pede cartão)

**Você ganha:** uma VM Linux sua, ligada 24h, com 200 GB de disco e 10 TB de tráfego. É o único "grátis para sempre" com recursos reais.
**Você precisa de:** **cartão de crédito para verificação de identidade**. A Oracle diz que não cobra no Always Free, mas faz uma pré-autorização temporária e **exige cartão** — como você pediu "grátis sem cartão, ou com cartão só se não cobrar nada", esta opção fica como **plano B**.
**Quando vale a pena:** quando o site começar a receber pedidos reais de clientes (disco persistente, 24h ligado, 10 TB de tráfego).

```bash
# 1) Conta: https://signup.cloud.oracle.com  (região: Brazil East - São Paulo, se disponível)
# 2) Criar a VM: Compute → Instances → Create instance
#    Image: Ubuntu 24.04 · Shape: VM.Standard.A1.Flex (Arm, 2 OCPUs / 12 GB) ou VM.Standard.E2.1.Micro (AMD)
#    Gere/ baixe a chave SSH. Depois libere as portas 80 e 443 em:
#    - Security List (VCN) → Ingress Rules: TCP 80 e TCP 443 de 0.0.0.0/0
#    - e dentro da VM: sudo iptables (a Oracle bloqueia por padrão no Ubuntu)

# 3) Entrar na VM
ssh ubuntu@SEU_IP

# 4) Instalar Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v          # v20.x

# 5) Subir o código (via git ou copiando a pasta)
sudo mkdir -p /opt/dstamp /var/lib/dstamp /var/backups/dstamp
sudo chown -R ubuntu:ubuntu /opt/dstamp /var/lib/dstamp /var/backups/dstamp
git clone SEU_REPOSITORIO /opt/dstamp          # ou: scp -r dstamp/* ubuntu@SEU_IP:/opt/dstamp/

# 6) Variáveis de produção
cat > /opt/dstamp/.env.sh <<'EOF'
export NODE_ENV=production
export PORT=3000
export DSTAMP_DATA=/var/lib/dstamp
export DSTAMP_NO_DEMO=1
export DSTAMP_ADMIN_EMAIL=seuemail@exemplo.com
export DSTAMP_ADMIN_PASSWORD='troque-esta-senha'
export DSTAMP_BACKUP=/var/backups/dstamp
EOF
chmod 600 /opt/dstamp/.env.sh

# 7) Manter no ar com pm2
sudo npm i -g pm2
cd /opt/dstamp && set -a && . ./.env.sh && set +a
pm2 start server.js --name dstamp && pm2 save && pm2 startup   # cole o comando que aparecer

# 8) HTTPS + domínio com Caddy (certificado automático, 2 linhas de config)
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
pedidos.seudominio.com.br {
    reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy

# 9) Backup diário às 3h (mantém 14)
( crontab -l 2>/dev/null; echo '0 3 * * * cd /opt/dstamp && DSTAMP_DATA=/var/lib/dstamp DSTAMP_BACKUP=/var/backups/dstamp node tools/backup.js >> /var/log/dstamp-backup.log 2>&1' ) | crontab -

# 10) Testar
curl http://localhost:3000/api/health
```

**Atenção (regra da Oracle):** instâncias Always Free com uso abaixo de ~20% de CPU/rede por 7 dias podem ser **reclamadas**. Um ping de monitoramento (UptimeRobot/cron-job.org a cada 5 min) + o site em uso normal resolvem. Se a região escolhida estiver sem capacidade Arm, tente `VM.Standard.E2.1.Micro` (AMD, sempre free).

---

---

## 5. Opção C — Docker (Koyeb, Fly, Northflank, VPS ou Oracle)

```bash
docker build -t dstamp .
docker run -d --name dstamp -p 3000:3000 -v dstamp-data:/data \
  -e DSTAMP_ADMIN_EMAIL=voce@exemplo.com \
  -e DSTAMP_ADMIN_PASSWORD='sua-senha-forte' \
  dstamp

# ou com o compose pronto:
docker compose up -d
```

O volume `dstamp-data` guarda banco e uploads fora do contêiner — pode recriar o contêiner à vontade.

---

## 6. Opção D — VPS brasileira (R$ 25–40/mês)

Se preferir pagar pouco e ter **latência baixa no Brasil**, suporte em português e disco real: Hostinger VPS, Contabo, Vultr ou DigitalOcean (US$ 6/mês). O passo a passo é **exatamente o da Opção B (Oracle)** — itens 3 a 10, só que a VM é paga. É o caminho mais simples quando o site abrir para o público.

---

## 7. Fase 2 — 20 mil visitas por mês

**Dimensionamento real:** 20.000 visitas/mês ≈ 660/dia ≈ 30–60 requisições/hora, com picos de 1–2 por segundo. Isso é **pouco**: meia CPU e 512 MB dão conta. O que pesa é o **tráfego de imagens**.

| Item | Hoje | Com 20 mil visitas/mês | O que fazer |
|---|---|---|---|
| Tráfego | ~2,5 MB de imagens no projeto | 1 visita ≈ 700 KB–1 MB → **15–20 GB/mês** | **Cloudflare grátis** (cache das imagens em São Paulo) corta ~80% do que chega ao servidor |
| Peso das imagens | JPG de 150–300 KB | — | converter para **WebP** (economia de ~70%) — comando abaixo |
| Banco | JSON em arquivo (`data/db.json`) | leitura tranquila; escrita sequencial | se 3+ pessoas gravarem ao mesmo tempo com volume alto, migrar para **Postgres** (Neon/Supabase grátis → US$ 5/mês). A leitura/escrita já está isolada em `load()`/`save()` |
| CPU/RAM | 0,1 CPU / 512 MB (free) | 0,5 CPU / 512 MB sobra | Oracle free, Render Starter (US$ 7) ou VPS R$ 25–40 |
| Domínio | `*.onrender.com` | `pedidos.d-stamp.art.br` | Registro.br ~R$ 40/ano; HTTPS grátis (Caddy/Let's Encrypt/Cloudflare) |
| Disponibilidade | dorme no free | precisa estar sempre no ar | Oracle/VPS (não dorme) ou Render pago |
| Monitoramento | — | alerta se cair | UptimeRobot grátis (50 monitores) apontando para `/api/health` |
| WhatsApp | links `wa.me` | mesmo | para responder **dentro** do site, WhatsApp Business API (custo por conversa) |

**Converter as imagens para WebP (quando quiser):**

```bash
sudo apt-get install -y webp
cd public/img
for f in *.jpg; do cwebp -q 78 "$f" -o "${f%.jpg}.webp"; done
# depois troco as referências nos .js (posso fazer isso num próximo passo)
```

**Custo estimado da fase 2:** R$ 0/mês (Oracle Always Free + Cloudflare) **ou** ~R$ 40/mês (Render Starter) **ou** ~R$ 30/mês (VPS brasileira) + **R$ 40/ano** de domínio.

---

## 8. Checklist antes de abrir para o público

- [ ] `DSTAMP_DEV` **desligado** (a rota de reset não pode existir em produção)
- [ ] `DSTAMP_NO_DEMO=1` — banco sem os 8 pedidos e 4 usuários de exemplo
- [ ] Senha do administrador forte (vinda de variável de ambiente, nunca no código)
- [ ] `DSTAMP_DATA` apontando para disco persistente (VM/volume) — não para a pasta do código
- [ ] HTTPS ativo + domínio próprio
- [ ] Cloudflare na frente (cache e proteção)
- [ ] Backup diário agendado **e um restore testado** (`npm run backup` → `npm run restore ARQUIVO --yes`)
- [ ] Monitoramento com alerta (UptimeRobot → `/api/health`)
- [ ] Conferir no painel: WhatsApp, endereço, mapas, loja oficial, **data do próximo lote**
- [ ] Preencher o **delta** de cada modelagem (Administração → Catálogo) — hoje regata/baby look/nadador/machão/infantil/short usam a tabela da camiseta
- [ ] Fotos reais dos produtos no lugar das ilustrativas
- [ ] Rodar os testes contra o servidor de produção: `npm test` (165) e `npm run test:ui` (291)

---

## 9. Comandos úteis

```bash
npm start              # produção (node server.js)
npm run dev            # desenvolvimento (DSTAMP_DEV=1 → libera /api/dev/reset)
npm test               # 165 verificações de preço/prazo/lote/janela/exports
npm run test:ui        # 291 verificações de interface (precisa de: npm i -D jsdom)
npm run backup         # gera backups/bkp-AAAA-MM-DD-HHMMSS.tar.gz (mantém 14)
npm run backup list    # lista os backups
npm run restore ARQUIVO --yes   # restaura (pare o servidor antes)
```
