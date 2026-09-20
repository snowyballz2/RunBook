import { describe, expect, it } from "vitest";
import {
  groupCredentialSections,
  migrateLegacyCredentials,
  sectionTitleFor,
} from "./credentials";
import type { CredentialField } from "./credentials";

const field = (key: string, guideId: string, guideTitle: string): CredentialField => ({
  key,
  label: key,
  secret: false,
  guideId,
  guideTitle,
  collection: "My Build",
});

describe("groupCredentialSections", () => {
  it("merges the pages that touch one system into one section, in first-seen order", () => {
    const sections = groupCredentialSections([
      field("proxmox-ip", "start-here", "Start Here"),
      field("truenas-ip", "virtual-machines", "Virtual Machines"),
      field("proxmox-user", "install-proxmox", "Install Proxmox"),
      field("mirror-a-serial", "truenas-storage", "TrueNAS Storage"),
      field("vaultwarden-ip", "vaultwarden", "Vaultwarden"),
    ]);
    expect(sections.map((s) => s.title)).toEqual([
      "Proxmox host",
      "TrueNAS & storage",
      "Vaultwarden",
    ]);
    expect(sections[0].fields.map((f) => f.key)).toEqual(["proxmox-ip", "proxmox-user"]);
    expect(sections[1].fields.map((f) => f.key)).toEqual(["truenas-ip", "mirror-a-serial"]);
    expect(sections[1].accentGuideId).toBe("virtual-machines");
    expect(sections[1].id).toBe("truenas-storage");
  });

  it("keeps an unmapped guide's title as its section", () => {
    expect(sectionTitleFor("Vaultwarden")).toBe("Vaultwarden");
    expect(sectionTitleFor("Some Other Guide")).toBe("Some Other Guide");
  });
});

describe("migrateLegacyCredentials", () => {
  it("moves a retired key's value to its successor when the successor is empty", () => {
    const all = { "zfs-mirror-disk1-serial": "ZL2ABC" };
    expect(migrateLegacyCredentials(all)).toBe(true);
    expect(all).toEqual({ "mirror-a-serial": "ZL2ABC" });
  });

  it("never discards a value that differs from the successor's", () => {
    const all = { "zfs-mirror-disk1-serial": "OLD", "mirror-a-serial": "NEW" };
    expect(migrateLegacyCredentials(all)).toBe(false);
    expect(all).toEqual({ "zfs-mirror-disk1-serial": "OLD", "mirror-a-serial": "NEW" });
  });

  it("drops the retired key once the successor already holds the same value", () => {
    const all = { "zfs-mirror-disk2-serial": "SAME", "mirror-b-serial": "SAME" };
    expect(migrateLegacyCredentials(all)).toBe(true);
    expect(all).toEqual({ "mirror-b-serial": "SAME" });
  });

  it("is a no-op without retired keys", () => {
    const all = { "mirror-a-serial": "ZL2ABC", "ha-ip": "192.168.1.51" };
    expect(migrateLegacyCredentials(all)).toBe(false);
    expect(all).toEqual({ "mirror-a-serial": "ZL2ABC", "ha-ip": "192.168.1.51" });
  });
});
