# Mail Kit Goal

Mail Kit is a self-hostable email service provider for developers. The long-term product direction is a Resend-like sending experience plus a simple Gmail-like receiving inbox, managed through a TypeScript SaaS dashboard.

## Product Goal

Build a private email platform where users can:

- Connect their own domains.
- Verify DNS records for sending and receiving.
- Send transactional email through an API or SMTP.
- Receive inbound email into a dashboard inbox.
- Inspect email logs and delivery status.
- Manage API keys, webhooks, projects, and admin controls.

The first version is for personal/private domains, not a public email provider for arbitrary users.

## Architecture

Mail Kit should not implement the raw SMTP/mail server in TypeScript at first. The TypeScript app owns the SaaS layer:

- UI and dashboard
- Users, projects, and domains
- API keys
- DNS verification
- Send email API
- Inbound mailbox UI
- Email logs
- Webhook configuration and events
- Admin monitoring

Production mail handling should use proven infrastructure such as Mailcow, Mailu, Docker Mailserver, Postfix/Dovecot, or a similar mail stack.

## Local Development Flow

Use Mailpit for local email testing:

```txt
TS app -> Nodemailer -> Mailpit SMTP -> Mailpit web inbox
```

Mailpit ports:

```txt
SMTP: 1025
Web UI: 8025
```

Development SMTP config:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

## Production Flow

Production should run on a VPS with:

- Public static IP
- Port 25 open
- Reverse DNS / PTR support
- Docker support
- Clean IP reputation if possible

High-level flow:

```txt
User domain DNS
  -> MX points to mail server
  -> Mail server receives/sends email
  -> Mail Kit manages UI/API/logs
```

## Domain Connection Flow

When a user adds a domain, Mail Kit should show the required DNS records:

```txt
MX record for receiving email
SPF TXT record
DKIM TXT record
DMARC TXT record
Optional tracking CNAME later
```

The app should verify DNS records before allowing production sending.

## Sending Email Flow

```txt
User creates API key
User verifies domain
User calls POST /emails/send
Mail Kit validates sender/domain/API key
Mail Kit sends email through SMTP server
Email status/log is saved in database
Webhook event is triggered if configured
```

Example API:

```http
POST /emails/send
Authorization: Bearer API_KEY
```

```json
{
  "from": "hello@example.com",
  "to": "user@gmail.com",
  "subject": "Hello",
  "html": "<p>Hello world</p>"
}
```

## Receiving Email Flow

```txt
External sender emails user@customdomain.com
Domain MX points to the mail server
Mail server receives message
Mail Kit imports/reads message
Message appears in inbox UI
User can view, search, reply, archive, and delete
```

The first receiving version can be simple:

- Store inbound emails in PostgreSQL.
- Show an inbox list.
- Show an email detail page.
- Add basic reply support later.

## Known Hard Problems

The hardest parts are outside the TypeScript dashboard:

- DNS setup
- SMTP deliverability
- Spam prevention
- IP reputation
- Port 25 availability
- Bounce handling
- Abuse prevention

Mail Kit should first optimize for a private, self-hosted operator who controls their own domains.
