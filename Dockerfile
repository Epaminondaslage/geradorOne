FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN apk add --no-cache chromium font-dejavu

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

COPY --chown=node:node package.json package-lock.json server.js ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node scripts ./scripts
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
