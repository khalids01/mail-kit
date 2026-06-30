import { describe, expect, it } from "bun:test";
import { Permissions, RolePermissionMap, Roles } from "@rbac";
import { decryptSecret, encryptSecret } from "../src/modules/mail/mail-secrets";
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
      Permissions.MailMailboxesManage,
    );
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailInboundRead,
    );
    expect(RolePermissionMap[Roles.PlatformUser]).toContain(
      Permissions.MailInboundManage,
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
    expect(RolePermissionMap[Roles.PlatformAdmin]).toContain(
      Permissions.AdminMailboxesRead,
    );
    expect(RolePermissionMap[Roles.PlatformAdmin]).not.toContain(
      Permissions.AdminMailManage,
    );
    expect(RolePermissionMap[Roles.PlatformAdmin]).not.toContain(
      Permissions.AdminMailboxesManage,
    );
    expect(RolePermissionMap[Roles.PlatformOwner]).toContain(
      Permissions.AdminMailManage,
    );
    expect(RolePermissionMap[Roles.PlatformOwner]).toContain(
      Permissions.AdminMailboxesManage,
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

  it("encrypts mailbox secrets before storage and decrypts them for IMAP", () => {
    const encrypted = encryptSecret("mailbox-password");

    expect(encrypted?.startsWith("enc:v1:")).toBe(true);
    expect(encrypted).not.toContain("mailbox-password");
    expect(decryptSecret(encrypted)).toBe("mailbox-password");
  });
});
