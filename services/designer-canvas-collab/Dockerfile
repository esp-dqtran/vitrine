FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
# The lockfile is generated with npm 11. Pin the installer so optional
# cross-platform packages resolve the same way in local and container builds.
RUN npm install --global npm@11.6.2 \
    && npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
COPY services/api/src/sessionCookie.ts ./services/api/src/sessionCookie.ts
COPY services/designer-canvas-collab/src ./services/designer-canvas-collab/src
ENV NODE_ENV=production
ENV PORT=3012
EXPOSE 3012
CMD ["node", "--experimental-strip-types", "services/designer-canvas-collab/src/index.ts"]
