import { env } from "@env/server";

export type MailEngineResult = {
  status: "manual" | "provisioned" | "failed";
  engineId?: string | null;
  error?: string | null;
  dnsRecords?: Array<{
    type: string;
    name: string;
    value: string;
    purpose: string;
  }>;
};

type MailuPayload = Record<string, unknown>;

function configuredForMailu() {
  return env.MAIL_ENGINE_MODE === "mailu" && env.MAIL_ENGINE_API_URL && env.MAIL_ENGINE_API_TOKEN;
}

function endpoint(path: string) {
  const base = env.MAIL_ENGINE_API_URL!.replace(/\/$/, "");
  const apiBase = base.endsWith("/v1") ? base : `${base}/v1`;
  return `${apiBase}/${path.replace(/^\//, "")}`;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.MAIL_ENGINE_API_TOKEN}`,
  };
}

async function mailuRequest(path: string, payload: MailuPayload) {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  let parsed: unknown = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  if (!response.ok) {
    throw new Error(
      `Mailu API ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
    );
  }

  return parsed as Record<string, unknown> | null;
}

export class MailEngineService {
  async provisionDomain(domain: string): Promise<MailEngineResult> {
    if (!configuredForMailu()) {
      return { status: "manual", engineId: domain, error: null };
    }

    try {
      const result = await mailuRequest("/domain", {
        name: domain,
        comment: "Managed by Mail Kit",
      });
      return {
        status: "provisioned",
        engineId: String(result?.id ?? result?.name ?? domain),
        error: null,
      };
    } catch (error) {
      return {
        status: "failed",
        engineId: domain,
        error: error instanceof Error ? error.message : "Mailu domain provisioning failed",
      };
    }
  }

  async provisionMailbox(input: {
    address: string;
    localPart: string;
    domain: string;
    password?: string | null;
    displayName?: string | null;
  }): Promise<MailEngineResult> {
    if (!configuredForMailu()) {
      return { status: "manual", engineId: input.address, error: null };
    }

    try {
      const result = await mailuRequest("/user", {
        localpart: input.localPart,
        domain: input.domain,
        email: input.address,
        password: input.password,
        displayed_name: input.displayName,
        comment: "Managed by Mail Kit",
        enabled: true,
      });
      return {
        status: "provisioned",
        engineId: String(result?.id ?? result?.email ?? input.address),
        error: null,
      };
    } catch (error) {
      return {
        status: "failed",
        engineId: input.address,
        error: error instanceof Error ? error.message : "Mailu mailbox provisioning failed",
      };
    }
  }

  async disableMailbox(address: string): Promise<MailEngineResult> {
    if (!configuredForMailu()) {
      return { status: "manual", engineId: address, error: null };
    }

    try {
      const result = await mailuRequest("/user/disable", { email: address });
      return {
        status: "provisioned",
        engineId: String(result?.id ?? result?.email ?? address),
        error: null,
      };
    } catch (error) {
      return {
        status: "failed",
        engineId: address,
        error: error instanceof Error ? error.message : "Mailu mailbox disable failed",
      };
    }
  }
}

export const mailEngineService = new MailEngineService();
