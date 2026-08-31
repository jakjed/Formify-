# Procure Ledger — staging/production API (+ optional bundled SPA)
FROM node:22-bookworm-slim AS build

RUN apt-get update -qq \
  && apt-get install -y -qq openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/config-typescript/package.json packages/config-typescript/
COPY tooling ./tooling

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @aptora/types build \
  && pnpm --filter @aptora/web build \
  && pnpm --filter @aptora/api build

FROM node:22-bookworm-slim AS run

RUN apt-get update -qq \
  && apt-get install -y -qq openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=3001
ENV SERVE_WEB=1

WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "pnpm prisma:deploy && node dist/main.js"]
