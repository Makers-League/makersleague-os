import { describe, expect, it } from "vitest";

import { fixturesSource } from "./fixtures";
import { deriveStatus, mapEasyVereinMember, toIsoDate } from "./schema";
import type { EasyVereinMember } from "./schema";

const raw = (overrides: Partial<EasyVereinMember> = {}): EasyVereinMember => ({
  id: 1,
  joinDate: "2024-01-31T00:00:00+01:00",
  resignationDate: null,
  _isApplication: false,
  emailOrUserName: " Ada@Example.COM ",
  contactDetails: { firstName: " Ada ", familyName: "Lovelace" },
  ...overrides,
});

describe("toIsoDate", () => {
  it("keeps the calendar date easyVerein sends", () => {
    expect(toIsoDate("2024-01-31T00:00:00+01:00")).toBe("2024-01-31");
    expect(toIsoDate("2024-01-31")).toBe("2024-01-31");
    expect(toIsoDate(null)).toBeNull();
  });

  it("rejects values that are not dates", () => {
    expect(() => toIsoDate("31.01.2024")).toThrow(/Unexpected date/);
  });
});

describe("deriveStatus", () => {
  const today = "2026-11-18";
  it("marks open applications", () => {
    expect(deriveStatus(raw({ _isApplication: true }), today)).toBe("application");
  });
  it("is active until the exit date has passed", () => {
    expect(deriveStatus(raw({ resignationDate: "2026-11-19T00:00:00+01:00" }), today)).toBe(
      "active",
    );
    expect(deriveStatus(raw({ resignationDate: "2026-11-18T00:00:00+01:00" }), today)).toBe(
      "resigned",
    );
  });
});

describe("mapEasyVereinMember", () => {
  it("maps and normalises a member", () => {
    expect(mapEasyVereinMember(raw(), "2026-11-18")).toEqual({
      ok: true,
      member: {
        easyvereinId: "1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        status: "active",
        membershipType: null,
        joinedOn: "2024-01-31",
        leftOn: null,
      },
    });
  });

  it("skips members without a valid email", () => {
    expect(mapEasyVereinMember(raw({ emailOrUserName: "ada" }), "2026-11-18")).toEqual({
      ok: false,
      easyvereinId: "1",
      reason: "no valid email",
    });
  });
});

describe("fixturesSource", () => {
  it("reads the bundled fixtures", async () => {
    const { members, skipped } = await fixturesSource(
      undefined,
      () => new Date("2026-11-18"),
    ).listMembers();
    expect(members).toHaveLength(10);
    expect(skipped).toEqual([{ easyvereinId: "1012", reason: "no valid email" }]);
    expect(members.find((m) => m.easyvereinId === "1011")?.email).toBe("kim@example.com");
    expect(members.find((m) => m.easyvereinId === "1006")?.status).toBe("resigned");
  });
});
