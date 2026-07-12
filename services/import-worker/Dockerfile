FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
# Installs Chromium + all required system libraries for this exact Playwright version —
# more portable than pinning an mcr.microsoft.com/playwright image tag to match.
RUN npx playwright install --with-deps chromium
COPY src ./src
COPY migrations ./migrations
COPY services/import-worker/src ./services/import-worker/src
# No display in a container — reuse the profile's already-authenticated session headlessly.
# (Log in once locally with the CLI first: `npm run crawl-bulk -- <url> <name>`, which opens
# a real window; that same data/browser-profile-mobbin directory is mounted in below.)
ENV HEADLESS=true
CMD ["npx", "tsx", "services/import-worker/src/index.ts"]
