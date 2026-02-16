# Trackivity v2 - npm Development Guide

## 🚀 Quick Start with npm

### Installation

```bash
# Install dependencies
npm install
```

### Development Commands

```bash
npm run dev              # Start development server with DB push
npm run dev:db           # Dev server with explicit DB push
npm run dev:db:migrate   # Dev server with pending migrations
npm run dev:watch        # Alias for npm run dev
npm run dev:node         # Run dev tooling without pre-hooks
```

### Build & Runtime

```bash
npm run build            # Standard Vite build
npm run start            # Start production build locally
npm run start:dev        # Run built output for local testing
npm run start:cloud      # Production start used in Docker/Cloud Run
npm run preview          # Preview production build
```

### Database Operations

```bash
npm run db:push          # Push schema changes
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio
npm run db:start         # Start Docker Compose for PostgreSQL
```

### Code Quality & Tooling

```bash
npm run format           # Format code with Prettier
npm run format:check     # Check formatting
npm run lint             # Run Prettier + ESLint
npm run lint:fix         # Auto-fix linting issues
npm run check            # Svelte type checking
```

### Utilities

```bash
npm run create-super-admin  # Seed super admin user
npm run clean               # Clean build artifacts and caches
npm run loadtest -- --url http://localhost:8080  # Simple load tester
```

## 🛠️ Tooling Notes

- Requires Node.js 18+ (recommend 20+) and npm 9+
- TypeScript scripts use [`tsx`](https://github.com/esbuild-kit/tsx) via `npx`
- Docker and Cloud Run flows now assume Node.js instead of Bun
- `scripts/init-db.sh` will automatically use the local `drizzle-kit` binary or `npx`

## 🔄 Migrating from Bun

The project previously relied on Bun. If you still have Bun-specific artifacts locally:

```bash
rm -f bun.lock
rm -rf ~/.bun
```

After cleaning up, reinstall dependencies with `npm install`.
