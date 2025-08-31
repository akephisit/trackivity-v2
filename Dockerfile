FROM oven/bun:1.2-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run prepare && bun run build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./

EXPOSE 3000
CMD ["bun", "run", "build/index.js"]