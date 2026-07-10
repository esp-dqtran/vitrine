FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src ./src
COPY services/discover/src ./services/discover/src
ENV PORT=3001
EXPOSE 3001
CMD ["npx", "tsx", "services/discover/src/index.ts"]
