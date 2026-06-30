# Mail Kit API

Base URL:

```txt
https://api.example.com
```

API-key endpoints use:

```http
Authorization: Bearer mk_live_...
```

## Send Email

```http
POST /emails/send
Content-Type: application/json
Authorization: Bearer mk_live_...
```

```json
{
  "from": "hello@example.com",
  "to": "person@gmail.com",
  "subject": "Hello from Mail Kit",
  "html": "<p>Hello world</p>",
  "text": "Hello world"
}
```

Success:

```json
{
  "id": "email_id",
  "status": "sent",
  "messageId": "smtp-message-id"
}
```

## List Inbound Emails

```http
GET /inbound/emails?page=1&limit=20&status=unread&search=hello
Authorization: Bearer mk_live_...
```

Success:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

## Get Inbound Email

```http
GET /inbound/emails/:id
Authorization: Bearer mk_live_...
```

## Update Inbound Status

```http
POST /inbound/emails/:id/status
Content-Type: application/json
Authorization: Bearer mk_live_...
```

```json
{
  "status": "read"
}
```

Allowed statuses:

```txt
unread
read
archived
deleted
```

## Reply To Inbound Email

```http
POST /inbound/emails/:id/reply
Content-Type: application/json
Authorization: Bearer mk_live_...
```

```json
{
  "from": "hello@example.com",
  "text": "Thanks for reaching out."
}
```

## Common Errors

Invalid or revoked API key:

```json
{
  "message": "Invalid API key",
  "status": 401
}
```

Unverified sender domain:

```json
{
  "message": "Sender domain is not verified for sending",
  "status": 403
}
```

Suspended sender domain:

```json
{
  "message": "Sender domain is suspended",
  "status": 403
}
```

Rate limited:

```json
{
  "message": "Send rate limit exceeded",
  "status": 429
}
```

Rate-limit responses include:

```http
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
```

SMTP or IMAP failures return `502` with the transport error message.
