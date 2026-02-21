# Blockify - Discord Bot Dashboard

## Overview

Blockify is a Discord bot management platform for gaming organizations. It consists of a landing page/dashboard built with React and a Discord bot backend built with Express and discord.js. The bot handles orders, moderation (warnings/bans), giveaways, announcements, and community engagement features. The web frontend serves as a marketing landing page showcasing the bot's features, commands, and live stats pulled from the database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark neon gaming aesthetic with purple primary/cyan secondary)
- **Animations**: Framer Motion for complex animations
- **Fonts**: Space Grotesk (display), Outfit (body), JetBrains Mono (code) — defined as CSS variables `--font-display`, `--font-body`, `--font-mono`
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend (server/)
- **Framework**: Express.js with TypeScript, run via tsx
- **Discord Bot**: discord.js v14 with slash commands, buttons, modals, and embeds. Started asynchronously from route registration
- **Database ORM**: Drizzle ORM with PostgreSQL (node-postgres driver)
- **API Pattern**: Shared route definitions in `shared/routes.ts` using Zod schemas — both client and server reference the same API contracts
- **Storage Layer**: `IStorage` interface in `server/storage.ts` with `DatabaseStorage` implementation using Drizzle. This abstraction is passed to the Discord bot

### Shared Code (shared/)
- **Schema**: `shared/schema.ts` — Drizzle table definitions for orders, warnings, owners, settings, giveaways, and giveaway_entries
- **Routes**: `shared/routes.ts` — Type-safe API route definitions with Zod response schemas

### Database Schema
PostgreSQL with the following tables:
- **orders** — tracks purchase inquiries (userId, text, status, createdAt)
- **warnings** — moderation warnings (userId, reason, createdAt)
- **owners** — bot owner permissions (userId, unique)
- **settings** — key-value config store
- **giveaways** — giveaway events with requirements (JSON), rigging options, timing
- **giveaway_entries** — participant tracking for giveaways

### Build System
- **Development**: `tsx server/index.ts` with Vite dev server middleware (HMR via `server/vite.ts`)
- **Production**: Custom build script (`script/build.ts`) — Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`. Server deps in an allowlist get bundled to reduce cold start syscalls; all others are externalized
- **Database migrations**: `drizzle-kit push` for schema sync

### Key Design Decisions
1. **Shared type contracts**: Both frontend and backend import from `shared/` to ensure API type safety without code generation
2. **Storage interface pattern**: The `IStorage` interface allows the Discord bot to use the same data layer as the Express API, keeping data access consistent
3. **Async bot startup**: The Discord bot is imported and started asynchronously during route registration so the HTTP server isn't blocked
4. **Default bot owners**: Hardcoded owner Discord IDs in `server/bot.ts` with database-backed owner management for additional owners

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Discord Bot**: Requires `DISCORD_BOT_TOKEN` environment variable. Uses discord.js v14 with slash commands

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `DISCORD_BOT_TOKEN` — Discord bot token (required for bot functionality)

### Key NPM Packages
- **discord.js** v14 — Discord bot framework
- **drizzle-orm** + **drizzle-kit** — Database ORM and migration tooling
- **express** — HTTP server
- **@tanstack/react-query** — Client-side data fetching
- **framer-motion** — Animations
- **zod** + **drizzle-zod** — Schema validation
- **wouter** — Client-side routing
- **dotenv** — Environment variable loading
- **connect-pg-simple** — PostgreSQL session store (available but sessions not yet implemented in routes)