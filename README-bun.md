# Trackivity v2 - Bun Development Guide

## 🚀 Quick Start with Bun

### Installation

```bash
# Install Bun 1.2+
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

### Development Commands

#### Primary (Bun-optimized)

```bash
bun run dev                    # Start development server with DB push
bun run dev:db                 # Start with DB operations
bun run dev:db:migrate         # Start with DB migration
bun run dev:watch              # Hot reload development mode
```

#### Fallback (Node.js compatibility)

```bash
bun run dev:node               # Use Node.js tools if needed
```

### Build Commands

```bash
bun run build                  # Standard Vite build
bun run build:bun              # Experimental Bun-native build
```

### Database Operations

```bash
bun run db:push                # Push schema changes
bun run db:generate            # Generate migrations
bun run db:migrate             # Run migrations
bun run db:studio              # Open Drizzle Studio
```

### Code Quality

```bash
bun run format                 # Format code
bun run format:check           # Check formatting
bun run lint                   # Run linting
bun run lint:fix               # Fix linting issues
bun run check                  # Type checking
```

### Utilities

```bash
bun run clean                  # Clean build artifacts
bun run create-super-admin     # Create admin user
```

## ⚡ Performance Benefits

### Development

- **Package Installation**: 10-20x faster than npm
- **Script Execution**: 2-4x faster than Node.js
- **Hot Reload**: Near-instant with `--hot` flag

### Production

- **Startup Time**: 60-70% faster
- **Memory Usage**: 30-40% less RAM
- **Request Handling**: 30-50% faster response times

## 📁 Configuration Files

- `.bunfig.toml` - Development configuration
- `.bunfig.production.toml` - Production optimizations
- `bun.lockb` - Binary lockfile (faster than package-lock.json)

## 🔄 Migration from Node.js

If you encounter compatibility issues:

```bash
# Use Node.js fallback commands
bun run dev:node
bun run format:check
```

All tools work seamlessly with both Bun and Node.js!
