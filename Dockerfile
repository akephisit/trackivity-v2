# Optimized Dockerfile for Cloud Run deployment with Bun

FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install security updates
RUN apk --no-cache add dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bun -u 1001

FROM base AS deps
COPY package.json bun.lockb* ./
COPY .bunfig.toml .bunfig.production.toml ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV="production"
RUN bun run prepare && bun run build

FROM base AS runtime
# Copy production config and package files
COPY package.json bun.lockb* ./
COPY .bunfig.production.toml ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application and necessary files
COPY --from=build /app/build ./build
COPY --from=build /app/static ./static
COPY scripts/ ./scripts/
COPY drizzle.config.ts ./
COPY src/lib/server/db/ ./src/lib/server/db/

# Change ownership to non-root user
RUN chown -R bun:nodejs /app

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Switch to non-root user
USER bun

# Cloud Run configuration
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "./scripts/init-db.sh && bun run start:cloud"]