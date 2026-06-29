import { describe, expect, it } from "bun:test";
import { Permissions, RolePermissionMap, Roles } from "@rbac";
import { buildDnsRecords, hashApiKey } from "../src/modules/mail/mail.service";

describe("mail v1 RBAC", () => {
  it("gives platform users the Mail Kit user permissions", () => {
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailDomainsManage,
    );
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailApiKeysManage,
    );
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailEmailsSend,
    );
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailEmailsRead,
    );
  });

  it("gives admins mail read access and owners mail manage access", () => {
    expect(RolePermissionMap[Roles.PlatformAdmin]).toContain(
      Permissions.AdminMailRead,
    );
    expect(RolePermissionMap[Roles.PlatformOwner]).toContain(
      Permissions.AdminMailManage,
    );
  });
});

describe("mail v1 helpers", () => {
  it("hashes API keys deterministically without storing the raw key", () => {
    const token = "mk_live_example";
    const hash = hashApiKey(token);

    expect(hash).toBe(hashApiKey(token));
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });

  it("builds MX, SPF, DMARC, and DKIM DNS records for a domain", () => {
    const records = buildDnsRecords("example.com");

    expect(records.map((record) => record.purpose)).toEqual([
      "mx",
      "spf",
      "dmarc",
      "dkim",
    ]);
    expect(records.find((record) => record.purpose === "mx")?.value).toBe(
      "mail.example.com",
    );
    expect(records.find((record) => record.purpose === "spf")?.value).toContain(
      "v=spf1",
    );
    expect(records.find((record) => record.purpose === "dmarc")?.name).toBe(
      "_dmarc",
    );
  });
});
