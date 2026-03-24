FROM oven/bun:1.3.5 AS base
WORKDIR /app

FROM base AS build
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN bun install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/backend packages/backend
RUN cd packages/shared && bun run build
RUN cd packages/backend && DATABASE_URL=postgresql://x:x@localhost/x bunx prisma generate
RUN cd packages/backend && bun run build

FROM node:24.14.0-alpine AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/backend ./packages/backend
COPY --from=build /app/package.json ./
WORKDIR /app/packages/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
