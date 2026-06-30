FROM oven/bun:1.3.3-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN bun install --frozen-lockfile

FROM deps AS build
ARG VITE_SERVER_URL
ARG VITE_OWNER_SETUP_CHECK=false
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_OWNER_SETUP_CHECK=$VITE_OWNER_SETUP_CHECK
COPY . .
RUN bun run db:generate
RUN bun run --cwd apps/web build

FROM oven/bun:1.3.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bun.lock /app/turbo.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/web", "serve", "--", "--host", "0.0.0.0", "--port", "3000"]
