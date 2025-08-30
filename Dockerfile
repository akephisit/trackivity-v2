# Multi-stage build for SvelteKit (adapter-bun)

# 1) Builder: install deps and build
FROM oven/bun:1.2 AS builder
WORKDIR /app

# Copy lockfile and package manifest first for better caching
COPY bun.lock package.json ./

# Install all dependencies (including dev) for building
RUN bun install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Build the SvelteKit app (outputs to ./build with adapter-bun)
RUN bun run build


# 2) Runner: copy built output and run
FROM oven/bun:1.2 AS runner
WORKDIR /app

# Runtime env
ENV NODE_ENV=production

# Copy only the build output produced by adapter-bun
COPY --from=builder /app/build ./build

# The build contains its own package.json with a start script
WORKDIR /app/build

EXPOSE 3000
CMD ["bun", "run", "start"]
