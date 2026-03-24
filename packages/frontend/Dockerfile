FROM oven/bun:1.3.5 AS base
WORKDIR /app

FROM base AS build
COPY bun.lock package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
RUN bun install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
COPY packages/backend packages/backend
RUN cd packages/shared && bun run build
RUN cd packages/backend && DATABASE_URL=postgresql://x:x@localhost/x bunx prisma generate && bun run build
RUN cd packages/frontend && bun run build

FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
