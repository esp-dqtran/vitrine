FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src ./src
COPY services/api/src ./services/api/src
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "services/api/src/index.ts"]
