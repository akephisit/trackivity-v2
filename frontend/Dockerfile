# Optimized Dockerfile for Cloud Run deployment with Node.js

FROM node:20-alpine AS base
WORKDIR /app

# Install security updates and init helper
RUN apk --no-cache add dumb-init

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV="production"
# Propagate CSRF trusted origins for SvelteKit build-time config
ARG CSRF_TRUSTED_ORIGINS
ENV CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS}
RUN npm run prepare && npm run build

FROM base AS runtime
# Copy production config and package files
COPY package.json package-lock.json ./

# Use dependencies from the deps stage (avoids runtime network installs)
COPY --from=deps /app/node_modules ./node_modules

# Copy built application and necessary files
COPY --from=build /app/build ./build
COPY --from=build /app/static ./static
COPY scripts/ ./scripts/
COPY drizzle.config.ts ./
COPY src/lib/server/db/ ./src/lib/server/db/

# Change ownership to non-root user provided by the base image
RUN chown -R node:node /app

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Switch to non-root user
USER node

# Cloud Run configuration
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "./scripts/init-db.sh && npm run start:cloud"]
