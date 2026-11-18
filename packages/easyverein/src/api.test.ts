import { describe, expect, it, vi } from "vitest";

import { apiSource } from "./api";

const member = (id: number) => ({
  id,
  joinDate: "2024-01-01T00:00:00+01:00",
  resignationDate: null,
  _isApplication: false,
  emailOrUserName: `m${id}@example.com`,
  contactDetails: { firstName: "A", familyName: "B" },
});

describe("apiSource", () => {
  it("follows pagination and sends the token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ next: "https://ev.test/member?page=2", results: [member(1)] }),
      )
      .mockResolvedValueOnce(Response.json({ next: null, results: [member(2)] }));

    const { members } = await apiSource({
      token: "t",
      baseUrl: "https://ev.test",
      fetch: fetchMock,
    }).listMembers();

    expect(members.map((m) => m.easyvereinId)).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      headers: { Authorization: "Bearer t", Accept: "application/json" },
    });
  });

  it("throws on API errors without leaking the token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(
      apiSource({ token: "secret", baseUrl: "https://ev.test", fetch: fetchMock }).listMembers(),
    ).rejects.toThrow(/easyVerein 401/);
  });
});
