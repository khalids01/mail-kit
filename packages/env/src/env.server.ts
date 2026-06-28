import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    REDIS_KEY_PREFIX: z.string().default("mail-kit:"),
    PORT: z.coerce.number().int().positive().default(5005),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    AUTH_SESSION_COOKIE_NAME: z.string().min(1).default("better-auth.session_token"),
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_SUCCESS_URL: z.string().url().optional(),
    POLAR_PRO_MONTHLY_ID: z.string().optional(),
    POLAR_PRO_YEARLY_ID: z.string().optional(),
    POLAR_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
    ENABLE_POLAR: z
      .string()
      .default("true")
      .transform((val) => val === "true"),
    OWNER_SETUP_CHECK: z
      .string()
      .default("false")
      .transform((val) => val === "true"),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    SMTP_SECURE: z.string().optional(),
  },
  runtimeEnv: {
    ...process.env,
    SMTP_USER: process.env.SMTP_USER || process.env.EMAIL,
    SMTP_PASS: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM || process.env.EMAIL_FROM,
  },
  emptyStringAsUndefined: true,
});

type PolarEnv = {
  POLAR_ACCESS_TOKEN: string;
  POLAR_WEBHOOK_SECRET: string;
  POLAR_SUCCESS_URL: string;
  POLAR_MODE: "sandbox" | "production";
};

export function getRequiredPolarEnv(): PolarEnv {
  if (!env.ENABLE_POLAR) {
    throw new Error("Polar is disabled. Set ENABLE_POLAR=true to use Polar.");
  }

  const missing = [
    ["POLAR_ACCESS_TOKEN", env.POLAR_ACCESS_TOKEN],
    ["POLAR_WEBHOOK_SECRET", env.POLAR_WEBHOOK_SECRET],
    ["POLAR_SUCCESS_URL", env.POLAR_SUCCESS_URL],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Polar is enabled but missing required env vars: ${missing.join(", ")}`,
    );
  }

  return {
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN!,
    POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET!,
    POLAR_SUCCESS_URL: env.POLAR_SUCCESS_URL!,
    POLAR_MODE: env.POLAR_MODE,
  };
}

if (env.ENABLE_POLAR) {
  getRequiredPolarEnv();
}
