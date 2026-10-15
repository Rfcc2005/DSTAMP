# D-Stamp · imagem para Koyeb, Fly.io, Northflank, Railway, Oracle (Docker) ou VPS
# Build:   docker build -t dstamp .
# Rodar:   docker run -d --name dstamp -p 3000:3000 -v dstamp-data:/data dstamp
FROM node:20-alpine

WORKDIR /app

# o projeto não tem dependências — só copia o código
COPY package.json server.js ./
COPY public ./public
COPY tools ./tools
COPY test ./test

# banco e uploads ficam no volume /data (persistente)
ENV NODE_ENV=production \
    PORT=3000 \
    DSTAMP_DATA=/data \
    DSTAMP_NO_DEMO=1

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
