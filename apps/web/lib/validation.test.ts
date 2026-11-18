import { describe, expect, it } from "vitest";

import { codeSchema, emailSchema, profileSchema } from "./validation";

describe("emailSchema", () => {
  it("normalises the address", () => {
    expect(emailSchema.parse({ email: " Ada@Example.com " })).toEqual({ email: "ada@example.com" });
  });
  it("rejects invalid addresses", () => {
    expect(emailSchema.safeParse({ email: "ada" }).success).toBe(false);
  });
});

describe("codeSchema", () => {
  it("accepts six digits", () => {
    expect(codeSchema.parse({ email: "a@example.com", code: " 123456 " }).code).toBe("123456");
  });
  it("rejects anything else", () => {
    expect(codeSchema.safeParse({ email: "a@example.com", code: "12345" }).success).toBe(false);
    expect(codeSchema.safeParse({ email: "a@example.com", code: "abcdef" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("turns the links field into a list", () => {
    const parsed = profileSchema.parse({
      bio: "  Hallo ",
      links: "https://example.com\n\n  http://makersleague.de  ",
      visibility: "members",
    });
    expect(parsed).toEqual({
      bio: "Hallo",
      links: ["https://example.com", "http://makersleague.de"],
      visibility: "members",
    });
  });

  it("stores an empty bio as null", () => {
    expect(profileSchema.parse({ bio: "", links: "", visibility: "board" }).bio).toBeNull();
  });

  it("rejects non-http links and unknown visibility", () => {
    expect(
      profileSchema.safeParse({ bio: "", links: "javascript:alert(1)", visibility: "members" })
        .success,
    ).toBe(false);
    expect(profileSchema.safeParse({ bio: "", links: "", visibility: "public" }).success).toBe(
      false,
    );
  });

  it("allows at most five links", () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join("\n");
    expect(profileSchema.safeParse({ bio: "", links, visibility: "members" }).success).toBe(false);
  });
});
