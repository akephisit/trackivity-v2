# Multi-stage Dockerfile optimized for Bun + SvelteKit (adapter-bun)

# ----- Builder -----
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Only install deps first to leverage Docker cache
COPY package.json bun.lock* ./
RUN bun install

# Copy source and build
COPY . .
ENV NODE_ENV=production
# Ensure SvelteKit generates .svelte-kit and ambient types
RUN bun run prepare && bun run build

# ----- Runner -----
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Copy built app only
COPY --from=builder /app/build ./build

# Install runtime dependencies for the built app
WORKDIR /app/build
RUN bun install --frozen-lockfile || bun install

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

# SvelteKit adapter-bun outputs a start script inside build/package.json
CMD ["bun", "start"]
