FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install --global npm@11.6.2 \
    && npm ci --omit=dev --legacy-peer-deps
COPY src ./src
COPY migrations ./migrations
COPY services/project-document-collab/src ./services/project-document-collab/src
ENV NODE_ENV=production
ENV PORT=3013
EXPOSE 3013
CMD ["node", "--experimental-strip-types", "services/project-document-collab/src/index.ts"]
