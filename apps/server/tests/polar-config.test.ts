import { describe, expect, it } from "bun:test";

const baseEnv = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:5005",
  CORS_ORIGIN: "http://localhost:5006",
  NODE_ENV: "test",
  POLAR_ACCESS_TOKEN: "",
  POLAR_WEBHOOK_SECRET: "",
  POLAR_SUCCESS_URL: "",
};

async function runEnvImport(env: Record<string, string | undefined>) {
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "-e",
      "import './packages/env/src/env.server.ts'; console.log('imported');",
    ],
    cwd: new URL("../../..", import.meta.url).pathname,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

describe("Polar config", () => {
  it("requires Redis URL", async () => {
    const result = await runEnvImport({
      ...baseEnv,
      REDIS_URL: undefined,
      ENABLE_POLAR: "false",
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("REDIS_URL");
  });

  it("allows missing Polar secrets when Polar is disabled", async () => {
    const result = await runEnvImport({
      ...baseEnv,
      ENABLE_POLAR: "false",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("imported");
  });

  it("fails fast when Polar is enabled without required secrets", async () => {
    const result = await runEnvImport({
      ...baseEnv,
      ENABLE_POLAR: "true",
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "Polar is enabled but missing required env vars",
    );
    expect(result.stderr).toContain("POLAR_ACCESS_TOKEN");
    expect(result.stderr).toContain("POLAR_WEBHOOK_SECRET");
    expect(result.stderr).toContain("POLAR_SUCCESS_URL");
  });
});
