import { t } from "elysia";

export const DomainCreateDto = t.Object({
  name: t.String({ minLength: 1, maxLength: 253 }),
});

export const ApiKeyCreateDto = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
});

export const EmailSendDto = t.Object({
  from: t.String({ minLength: 3, maxLength: 320 }),
  to: t.String({ minLength: 3, maxLength: 320 }),
  subject: t.String({ minLength: 1, maxLength: 998 }),
  html: t.Optional(t.String()),
  text: t.Optional(t.String()),
});

export const EmailQueryDto = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(t.Union([
    t.Literal("queued"),
    t.Literal("sent"),
    t.Literal("failed"),
  ])),
  domainId: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const AdminMailQueryDto = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export type DomainCreate = typeof DomainCreateDto.static;
export type ApiKeyCreate = typeof ApiKeyCreateDto.static;
export type EmailSend = typeof EmailSendDto.static;
export type EmailQuery = typeof EmailQueryDto.static;
export type AdminMailQuery = typeof AdminMailQueryDto.static;
