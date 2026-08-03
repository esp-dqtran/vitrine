FROM node:22-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PORT=3000

WORKDIR /app

COPY services/api/package.json services/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY services/api/src ./services/api/src

EXPOSE 3000
CMD ["node", "--experimental-strip-types", "services/api/src/index.ts"]
