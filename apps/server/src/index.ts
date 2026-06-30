import { cors } from "@elysiajs/cors";
import { auth } from "@auth/server";
import { env } from "@env/server";
import { connectRedis } from "@redis/server";
import { Elysia } from "elysia";
import { app } from "./modules/app";
import { openapi } from "@elysiajs/openapi";
import { enforceRateLimit } from "./modules/rate-limit/rate-limit.service";
import { startVisitorFlushWorker } from "./modules/visitors/visitors.service";
import { securityHeadersPlugin } from "./plugins/security-headers";
import { startInboundSyncWorker } from "./modules/mail/mail.service";

const shouldLogRequests = env.NODE_ENV === "development";
const docsPlugin =
  env.NODE_ENV === "development"
    ? openapi({
        path: "/docs",
      })
    : new Elysia({ name: "openapi-disabled" });

await connectRedis();
console.log("Redis is ready");
startVisitorFlushWorker();
startInboundSyncWorker();

const server = new Elysia()
  .use(securityHeadersPlugin({ production: env.NODE_ENV === "production" }))
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .use(docsPlugin)
  .onRequest(({ request }) => {
    if (!shouldLogRequests) {
      return;
    }

    const { pathname } = new URL(request.url);
    console.log(`[Server] ${request.method} ${pathname}`);
  })
  .onBeforeHandle((context) => {
    return enforceRateLimit(context as any);
  })
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  }, {
    parse: "none",
  })
  .use(app)
  .get("/", () => "OK")
  .listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`);
  });

export type App = typeof server;
