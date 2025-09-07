# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Runtime:** This project uses Bun as the primary runtime (requires Bun >= 1.2.0).

```bash
# Development
bun run dev              # Start dev server with database push
bun run dev:db          # Start dev server with fresh database push  
bun run dev:db:migrate  # Start dev server with database migration
bun run dev:watch       # Hot reload development with file watching

# Database Management
bun run db:start        # Start Docker Compose for PostgreSQL
bun run db:push         # Push schema changes to database
bun run db:generate     # Generate Drizzle migrations
bun run db:migrate      # Run pending migrations
bun run db:studio       # Open Drizzle Studio GUI

# Build & Deploy
bun run build           # Build for production with Vite
bun run build:bun       # Build with Bun bundler
bun run start           # Start production server
bun run preview         # Preview production build

# Code Quality
bun run lint            # Run Prettier + ESLint checks
bun run lint:fix        # Auto-fix linting issues
bun run format          # Format code with Prettier
bun run check           # Run Svelte type checking

# Utilities
bun run create-super-admin  # Create initial super admin user
bun run clean              # Clean build artifacts and cache
```

## Architecture Overview

**Trackivity v2** is a Thai university activity tracking system built with SvelteKit 2 (Svelte 5), PostgreSQL, and Drizzle ORM.

### Tech Stack
- **Frontend:** SvelteKit 2 with Svelte 5 (runes syntax)
- **Runtime:** Bun (primary), Node.js (fallback)  
- **Database:** PostgreSQL with Drizzle ORM
- **UI:** shadcn/ui-svelte components + Tailwind CSS
- **Icons:** Tabler Icons for Svelte
- **Forms:** Superforms with Zod validation
- **Auth:** JWT with httpOnly cookies

### Role-Based System Architecture

The system supports three admin levels with different capabilities:

1. **SuperAdmin**: System-wide management (users, organizations, admins)
2. **OrganizationAdmin**: Organization-specific management (students, activities, departments)
3. **RegularAdmin**: Basic activity scanning and assigned activity management

**Key Role Restrictions:**
- **Reports menu**: Removed from ALL admin levels
- **Settings menu**: Only available for OrganizationAdmin with `organizationType === 'faculty'`

### Directory Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── admin-app-layout.svelte     # Main admin layout (active)
│   │   ├── app-layout.svelte           # Base layout component
│   │   └── ui/                         # shadcn/ui components
│   ├── server/
│   │   └── db/
│   │       └── schema.ts               # Drizzle database schema
│   ├── stores/
│   │   ├── auth.ts                     # JWT authentication store
│   │   └── sse.ts                      # Server-sent events
│   └── types.ts                        # TypeScript definitions
├── routes/
│   ├── admin/                          # Admin-only routes
│   │   └── +layout.svelte              # Uses AdminAppLayout
│   ├── student/                        # Student routes
│   └── api/                            # API endpoints
└── hooks.server.ts                     # Server-side hooks
```

### Database Schema

Located at `src/lib/server/db/schema.ts` using Drizzle ORM with PostgreSQL. Main entities include:
- Users (students/staff with roles)
- Organizations (faculties/offices)
- Activities (academic/sports/cultural events)
- Participations (QR code-based check-in/out)
- Admin roles with hierarchical permissions

### Authentication System

- **JWT-based** with httpOnly cookies for security
- **Role-based permissions** with fine-grained access control
- **Session management** via `src/lib/stores/auth.ts`
- **Organization-level isolation** for OrganizationAdmin users

### Layout System

**Current Active Layout:** `admin-app-layout.svelte` → `app-layout.svelte`

The system uses a centralized layout approach:
- Main admin interface routes through `/routes/admin/+layout.svelte`
- Navigation items and quick actions are defined in `admin-app-layout.svelte`
- `isActiveRoute()` function handles menu highlighting with exact path matching

### Navigation Logic

Menu item active states use:
```typescript
function isActiveRoute(href: string, exact: boolean = false): boolean {
  const currentPath = $page.url.pathname;
  if (exact) return currentPath === href;
  return currentPath === href || currentPath.startsWith(href + '/');
}
```

**Important:** Use `exact: true` for specific routes like `/admin/activities/create` to prevent multiple menu items appearing active simultaneously.

### Organization Types

The system supports two organization types:
- `faculty`: Full feature access including settings menu
- `office`: Limited feature set, no settings menu

### Development Guidelines

**Language:** All UI text, comments, and documentation use Thai language. System code uses English.

**Component Patterns:**
- Use Svelte 5 runes syntax (`$state`, `$derived`, `$props`)
- Components follow shadcn/ui patterns for consistency
- Form handling with Superforms + Zod validation

**Database Operations:**
- Always run `bun run db:push` after schema changes during development
- Use `bun run db:studio` for database inspection
- Migrations are generated with `bun run db:generate`

**Permission Checking:**
- Navigation items include `permissions` and `admin_levels` arrays
- Role-based filtering occurs at both route and component levels
- Organization-type specific features are handled in layout components

## Thai Language Context

This is a Thai university system where:
- **หน่วยงาน (Organization)** = Faculty or administrative office
- **คณะ (Faculty)** = Academic faculty (has departments)
- **สำนักงาน (Office)** = Administrative office (no departments)
- **กิจกรรม (Activity)** = University activities/events
- **นักศึกษา (Student)** = University students