FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src ./src
COPY migrations ./migrations
COPY services/search-index-worker/src ./services/search-index-worker/src
CMD ["npx", "tsx", "services/search-index-worker/src/index.ts"]
