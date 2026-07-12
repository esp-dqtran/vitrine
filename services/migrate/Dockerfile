FROM node:22.17.0-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/* \
    && pg_dump --version | grep -q ' 17\.'
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/migrations.ts src/dbRecovery.ts ./src/
COPY scripts/migrate.ts scripts/db-backup.ts scripts/db-restore-verify.ts ./scripts/
COPY migrations ./migrations
CMD ["node", "--experimental-strip-types", "scripts/migrate.ts"]
