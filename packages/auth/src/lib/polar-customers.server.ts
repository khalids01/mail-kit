import type { BetterAuthPlugin, User } from "better-auth";
import prisma from "../../../db/src/client.server";
import { getPrimaryRoleSlug } from "../../../db/src/rbac/assignments.server";
import { Roles } from "@rbac";

import { polarClient } from "./payments.server";

type AuthUser = Partial<User> & {
  id?: string;
  email?: string | null;
  name?: string | null;
  isAnonymous?: boolean | null;
};

async function getPendingInvitationRoleSlug(email: string) {
  const invitation = await prisma.invitation.findFirst({
    where: {
      email: {
        equals: email.trim(),
        mode: "insensitive",
      },
      status: "pending",
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      role: {
        select: {
          slug: true,
        },
      },
    },
  });

  return invitation?.role.slug ?? null;
}

async function isBillingUser(user: AuthUser) {
  if (user.isAnonymous || !user.email) {
    return false;
  }

  const invitedRoleSlug = await getPendingInvitationRoleSlug(user.email);
  if (invitedRoleSlug && invitedRoleSlug !== Roles.PlatformUser) {
    return false;
  }

  if (!user.id) {
    return invitedRoleSlug === null || invitedRoleSlug === Roles.PlatformUser;
  }

  const primaryRoleSlug = await getPrimaryRoleSlug(user.id);
  return primaryRoleSlug === Roles.PlatformUser;
}

async function ensurePolarCustomer(user: AuthUser) {
  if (!user.id || !user.email || !(await isBillingUser(user))) {
    return;
  }

  const { result: existingCustomers } = await polarClient.customers.list({
    email: user.email,
  });
  const existingCustomer = existingCustomers.items[0];

  if (!existingCustomer) {
    const customer = await polarClient.customers.create({
      email: user.email,
      name: user.name,
      externalId: user.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { polarCustomerId: customer.id },
    });
    return;
  }

  const customer =
    existingCustomer.externalId === user.id
      ? existingCustomer
      : await polarClient.customers.update({
          id: existingCustomer.id,
          customerUpdate: {
            externalId: user.id,
          },
        });

  await prisma.user.update({
    where: { id: user.id },
    data: { polarCustomerId: customer.id },
  });
}

async function updatePolarCustomer(user: AuthUser) {
  if (!user.id || !user.email || !(await isBillingUser(user))) {
    return;
  }

  await polarClient.customers.updateExternal({
    externalId: user.id,
    customerUpdateExternalID: {
      email: user.email,
      name: user.name,
    },
  });
}

async function deletePolarCustomer(user: AuthUser) {
  if (!user.email) {
    return;
  }

  const { result: existingCustomers } = await polarClient.customers.list({
    email: user.email,
  });
  const existingCustomer = existingCustomers.items[0];

  if (existingCustomer) {
    await polarClient.customers.delete({
      id: existingCustomer.id,
    });
  }
}

export function polarCustomersForBillingUsers(): BetterAuthPlugin {
  return {
    id: "polar-customers-for-billing-users",
    init() {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                after: ensurePolarCustomer,
              },
              update: {
                after: updatePolarCustomer,
              },
              delete: {
                after: deletePolarCustomer,
              },
            },
          },
        },
      };
    },
  };
}
