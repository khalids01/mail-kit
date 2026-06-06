import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import { magicLink } from "better-auth/plugins";
import prisma from "../../db/src/client.server";
import { env } from "../../env/src/env.server";
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { sendEmail, magicLinkTemplate } from "../../email/src/index.server";

import { polarClient } from "./lib/payments.server";
import { polarCustomersForBillingUsers } from "./lib/polar-customers.server";

function getUserIdFromPolarSubscription(
  subscription: WebhookSubscriptionCreatedPayload["data"],
): string | null {
  return subscription.customer.externalId;
}

export const authOptions = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 30, // 1 month
    },
  },
  trustedOrigins: [env.CORS_ORIGIN],
  advanced: {
    cookies: {
      session_token: {
        name: env.AUTH_SESSION_COOKIE_NAME,
      },
    },
    defaultCookieAttributes: {
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      secure: env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
  user: {
    additionalFields: {
      banned: {
        type: "boolean",
        input: false,
        returned: true,
      },
      banReason: {
        type: "string",
        input: false,
        returned: true,
      },
      archived: {
        type: "boolean",
        input: false,
        returned: true,
      },
      onboardingComplete: {
        type: "boolean",
        input: true,
        returned: true,
      },
      polarCustomerId: {
        type: "string",
        input: false,
        returned: false,
      },
      subscriptionId: {
        type: "string",
        input: false,
        returned: false,
      },
      plan: {
        type: "string",
        input: false,
        returned: true,
      },
      subscriptionStatus: {
        type: "string",
        input: false,
        returned: true,
      },
    },
  },
  plugins: [
    ...(env.ENABLE_POLAR
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: false,
            use: [
              checkout({
                products: [
                  {
                    productId: "c9fe3a9c-1663-48ec-b7c5-75fdc6be91ca",
                    slug: "pro_monthly",
                  },
                ],
                successUrl: env.POLAR_SUCCESS_URL!,
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                secret: env.POLAR_WEBHOOK_SECRET!,
                onSubscriptionCreated: async (
                  payload: WebhookSubscriptionCreatedPayload,
                ) => {
                  const userId = getUserIdFromPolarSubscription(payload.data);
                  if (!userId) {
                    return;
                  }

                  await prisma.user.update({
                    where: { id: userId },
                    data: {
                      subscriptionId: payload.data.id,
                      subscriptionStatus: payload.data.status,
                    },
                  });
                },
                onSubscriptionUpdated: async (
                  payload: WebhookSubscriptionUpdatedPayload,
                ) => {
                  const userId = getUserIdFromPolarSubscription(payload.data);
                  if (!userId) {
                    return;
                  }

                  await prisma.user.update({
                    where: { id: userId },
                    data: {
                      subscriptionStatus: payload.data.status,
                    },
                  });
                },
              }),
            ],
          }),
          polarCustomersForBillingUsers(),
        ]
      : []),
    magicLink({
      rateLimit: {
        window: 60,
        max: 5,
      },
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Sign in to TS Starter",
          html: await magicLinkTemplate(url),
        });
      },
    }),
  ],
} satisfies BetterAuthOptions;

export type AuthOptions = typeof authOptions;
