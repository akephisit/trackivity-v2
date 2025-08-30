# Multi-stage build for SvelteKit (adapter-bun)

# 1) Builder: install deps and build
FROM oven/bun:1.1 AS builder
WORKDIR /app

# Copy lockfile and package manifest first for better caching
COPY bun.lock package.json ./

# Install all dependencies (including dev) for building
RUN bun install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Inject build-time env for SvelteKit's $env/static/private usage
ARG DATABASE_URL=postgresql://postgres:password@db:5432/trackivity
ARG JWT_SECRET=changeme-super-secret
ENV DATABASE_URL=${DATABASE_URL}
ENV JWT_SECRET=${JWT_SECRET}

# Build the SvelteKit app (outputs to ./build with adapter-bun)
RUN bun run build


# 2) Runner: copy built output and run
FROM oven/bun:1.1 AS runner
WORKDIR /app

# Runtime env
ENV NODE_ENV=production

# Copy only the build output produced by adapter-bun
COPY --from=builder /app/build ./build

# The build contains its own package.json with a start script
WORKDIR /app/build

EXPOSE 3000
CMD ["bun", "run", "start"]

