import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@env/server";

const PREFIX = "enc:v1:";

function key() {
  const secret =
    env.MAILBOX_SECRET_KEY ||
    env.BETTER_AUTH_SECRET ||
    "mail-kit-test-secret-at-least-32-characters";

  return createHash("sha256")
    .update(secret)
    .digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;

  const [ivPart, tagPart, encryptedPart] = value.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value: string | null | undefined) {
  return value ? "configured" : "missing";
}
