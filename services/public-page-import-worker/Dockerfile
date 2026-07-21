FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
RUN npx playwright install --with-deps chromium
COPY src ./src
COPY migrations ./migrations
COPY services/public-page-import-worker/src ./services/public-page-import-worker/src
ENV HEADLESS=true
CMD ["npx", "tsx", "services/public-page-import-worker/src/index.ts"]
