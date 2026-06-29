import Elysia from "elysia";
import { ownerController } from "./admin/owner/owner.controller";
import { usersController } from "./admin/users/users.controller";
import { adminInvitationsController } from "./admin/invitations/invitations.controller";
import { metadataController } from "./admin/metadata/metadata.controller";
import { authController } from "./auth/auth.controller";
import { sessionController } from "./session/session.controller";
import { notificationsController } from "./notifications/notifications.controller";
import { feedbackController } from "./feedback/feedback.controller";
import { polarController } from "./polar/polar.controller";
import { rateLimitController } from "./rate-limit/rate-limit.controller";
import { invitationsController } from "./invitations/invitations.controller";
import { visitorsController } from "./visitors/visitors.controller";
import { adminVisitorsController } from "./admin/visitors/visitors.controller";
import { adminActivityController } from "./admin/activity/activity.controller";
import { adminWebhooksController } from "./admin/webhooks/webhooks.controller";
import { rolesController } from "./admin/roles/roles.controller";
import { mailController } from "./mail/mail.controller";
import { adminMailController } from "./admin/mail/mail.controller";

export const app = new Elysia()
  .use(authController)
  .use(sessionController)
  .use(ownerController)
  .use(usersController)
  .use(rolesController)
  .use(adminInvitationsController)
  .use(metadataController)
  .use(rateLimitController)
  .use(visitorsController)
  .use(adminVisitorsController)
  .use(adminActivityController)
  .use(adminWebhooksController)
  .use(adminMailController)
  .use(mailController)
  .use(notificationsController)
  .use(feedbackController)
  .use(polarController)
  .use(invitationsController);
