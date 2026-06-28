# Mail Kit Branding

This repository has been branded for Mail Kit.

## Product

- Product name: `Mail Kit`
- Short text logo: `Mail Kit`
- Package/app slug: `mail-kit`
- Redis key prefix: `mail-kit:`
- Local server port: `5005`
- Local web port: `5006`

## Description

Mail Kit is a self-hostable email platform for transactional sending and inbound inboxes. It provides the TypeScript SaaS layer around proven mail infrastructure: dashboard, users, projects, domains, DNS verification, API keys, email logs, inbound mailbox UI, webhooks, and admin controls.

## Local Email Testing

Use Mailpit during development:

```txt
TS app -> Nodemailer -> Mailpit SMTP -> Mailpit web inbox
```

```env
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL=you@example.com
EMAIL_PASSWORD=
EMAIL_FROM="TS Starter"
```

Mailpit ports:

```txt
SMTP: 1025
Web UI: 8025
```

## Verification

After branding changes, run checks and search for legacy product names.

```bash
bun install
bun run check-types
```
