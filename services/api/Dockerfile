FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY services/api/src ./services/api/src
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "services/api/src/index.ts"]
