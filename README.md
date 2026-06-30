# Mail Kit

Mail Kit is a self-hostable email platform for transactional sending and simple inbound inboxes. It builds on a TypeScript SaaS foundation and turns it into the app layer around proven mail infrastructure.

## Product Direction

Mail Kit is meant to feel like a clean developer email provider:

- Send transactional email through an API and SMTP.
- Connect domains with DNS verification.
- Receive inbound mail into a dashboard inbox.
- View delivery logs and message history.
- Manage API keys, webhooks, projects, and admin controls.
- Run privately on your own VPS before becoming a public provider.

The TypeScript app is not intended to be the raw mail server in the first version. Production mail delivery and receiving should use Mailu as the hidden engine. Mail Kit manages the SaaS layer around that infrastructure.

## Stack

- TypeScript and Bun
- React, TanStack Start, and TanStack Router
- Elysia API server
- Prisma and PostgreSQL
- Better Auth
- Redis for cache, rate limits, visitor tracking, and session-related data
- Tailwind CSS and shadcn/ui
- Nodemailer for SMTP sending

## Local Development

Install dependencies:

```bash
bun install
```

Start PostgreSQL, Redis, and Mailpit:

```bash
docker compose -f docker-compose.setup.yml up -d
```

Generate Prisma client, run migrations, and seed RBAC:

```bash
bun run db:generate
bun run db:migrate
bun run db:seed
```

Local SMTP settings:

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL=you@example.com
EMAIL_PASSWORD=
EMAIL_FROM="Mail Kit"
```

Start the apps:

```bash
bun run dev
```

Open [http://localhost:5006](http://localhost:5006) for the web app.
The API runs at [http://localhost:5005](http://localhost:5005).
Mailpit is available at [http://localhost:8025](http://localhost:8025).

## Environment

Server defaults:

```bash
BETTER_AUTH_URL=http://localhost:5005
CORS_ORIGIN=http://localhost:5006
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=mail-kit:
PORT=5005
```

Web defaults:

```bash
VITE_SERVER_URL=http://localhost:5005
```

## VPS Deployment

The first production target uses Mailu as the hidden mail engine and Mail Kit as the product UI/API.

See [`docs/deploy-vps-mailu.md`](docs/deploy-vps-mailu.md) for the one-VPS deployment flow, required DNS records, Mailu SMTP/IMAP wiring, and sending/receiving tests.

## RBAC

Permissions are defined in [`packages/rbac`](packages/rbac). The maps file is the seed default only; runtime authorization reads from PostgreSQL and Redis.

```bash
bun run db:migrate
bun run db:seed
```

- Routes declare required permissions through `requirePermission(Permissions.*)`.
- Effective permissions are cached per user in Redis.
- Owner role permissions are protected; admins cannot view or modify owner accounts.

Tests live in [`apps/server/tests/rbac`](apps/server/tests/rbac).

## Redis

Redis is required for Mail Kit. The shared client lives in `packages/redis`, and the server uses it for rate limits, visitor tracking, caching, and future cross-instance coordination.

```bash
docker run --name mail-kit-redis -p 6379:6379 -d redis:7-alpine
```

Use Redis only for short-lived, regeneratable data. PostgreSQL remains the source of truth.

## Project Structure

```txt
mail-kit/
├── apps/
│   ├── web/         # Frontend application
│   └── server/      # Backend API
├── packages/
│   ├── auth/        # Authentication configuration
│   ├── db/          # Prisma schema and database client
│   ├── email/       # Email rendering and SMTP sending helpers
│   ├── env/         # Typed environment variables
│   └── rbac/        # Roles and permissions
└── docs/
    ├── goal.md
    └── progress-todo.md
```

## Available Scripts

- `bun run dev`: start all applications in development mode
- `bun run build`: build all applications
- `bun run dev:web`: start only the web application
- `bun run dev:server`: start only the server
- `bun run check-types`: check TypeScript types across all apps
- `bun run db:generate`: generate Prisma client
- `bun run db:migrate`: run database migrations
- `bun run db:seed`: seed RBAC data
- `bun run db:studio`: open Prisma Studio
