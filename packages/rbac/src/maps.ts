import { AllPermissions, Permissions, type Permission } from "./permissions";
import { Roles, type RoleSlug } from "./roles";

const adminPermissions = AllPermissions.filter(
  (permission) =>
    permission !== Permissions.AdminUsersGrantAdmin,
) as Permission[];

const platformAdminPermissions = adminPermissions.filter(
  (permission) =>
    !permission.startsWith("admin.roles.") &&
    permission !== Permissions.AdminMailManage &&
    permission !== Permissions.AdminMailboxesManage,
) as Permission[];

const platformUserPermissions = [
  Permissions.FeedbackSubmit,
  Permissions.NotificationsUse,
  Permissions.MailDomainsManage,
  Permissions.MailApiKeysManage,
  Permissions.MailMailboxesManage,
  Permissions.MailInboundRead,
  Permissions.MailInboundManage,
  Permissions.MailEngineProvision,
  Permissions.MailEmailsSend,
  Permissions.MailEmailsRead,
] as const satisfies readonly Permission[];

export const RolePermissionMap = {
  [Roles.PlatformOwner]: AllPermissions,
  [Roles.PlatformAdmin]: platformAdminPermissions,
  [Roles.PlatformUser]: platformUserPermissions,
} as const satisfies Record<RoleSlug, readonly Permission[]>;
