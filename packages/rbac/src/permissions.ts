export const Permissions = {
  AdminAccess: "admin.access",

  AdminUsersList: "admin.users.list",
  AdminUsersRead: "admin.users.read",
  AdminUsersUpdate: "admin.users.update",
  AdminUsersBan: "admin.users.ban",
  AdminUsersArchive: "admin.users.archive",
  AdminUsersDelete: "admin.users.delete",
  AdminUsersInvite: "admin.users.invite",
  AdminUsersGrantAdmin: "admin.users.grant_admin",

  AdminInvitationsManage: "admin.invitations.manage",
  AdminActivityRead: "admin.activity.read",
  AdminVisitorsRead: "admin.visitors.read",
  AdminMetadataRead: "admin.metadata.read",
  AdminWebhooksRead: "admin.webhooks.read",
  AdminRateLimitManage: "admin.rate_limit.manage",
  AdminMailRead: "admin.mail.read",
  AdminMailManage: "admin.mail.manage",

  AdminRolesList: "admin.roles.list",
  AdminRolesRead: "admin.roles.read",
  AdminRolesUpdate: "admin.roles.update",
  AdminRolesManage: "admin.roles.manage",
  AdminRolesReset: "admin.roles.reset",

  FeedbackSubmit: "feedback.submit",
  FeedbackModerate: "feedback.moderate",

  NotificationsUse: "notifications.use",

  MailDomainsManage: "mail.domains.manage",
  MailApiKeysManage: "mail.api_keys.manage",
  MailEmailsSend: "mail.emails.send",
  MailEmailsRead: "mail.emails.read",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const AllPermissions: readonly Permission[] = Object.values(Permissions);

export function permissionGroup(permission: Permission): string {
  const lastDot = permission.lastIndexOf(".");
  return lastDot === -1 ? permission : permission.slice(0, lastDot);
}
