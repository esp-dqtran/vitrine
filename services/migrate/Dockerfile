FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/migrations.ts ./src/migrations.ts
COPY scripts/migrate.ts ./scripts/migrate.ts
COPY migrations ./migrations
CMD ["node", "--experimental-strip-types", "scripts/migrate.ts"]
