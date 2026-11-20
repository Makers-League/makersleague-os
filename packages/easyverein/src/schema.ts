import { z } from "zod";

import type { MemberStatus, SkippedMember, SourceMember } from "./types";

/**
 * The fields we read from easyVerein v2.0 `GET /member`. Fixtures use the
 * same shape, so the mapping is tested with every fixture run.
 * Keep this list short: only what the OS needs (data minimisation).
 */
export const easyVereinMemberSchema = z.object({
  id: z.number(),
  joinDate: z.string().nullable(),
  resignationDate: z.string().nullable(),
  _isApplication: z.boolean(),
  emailOrUserName: z.string(),
  contactDetails: z.object({
    firstName: z.string(),
    familyName: z.string(),
  }),
});

export type EasyVereinMember = z.infer<typeof easyVereinMemberSchema>;

export const easyVereinMemberQuery =
  "{id,joinDate,resignationDate,_isApplication,emailOrUserName,contactDetails{firstName,familyName}}";

const emailSchema = z.email();

/** easyVerein sends timestamps such as 2024-01-31T00:00:00+01:00; we keep the calendar date. */
export const toIsoDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match?.[1]) {
    throw new Error(`Unexpected date from easyVerein: ${value}`);
  }
  return match[1];
};

export const deriveStatus = (member: EasyVereinMember, today: string): MemberStatus => {
  if (member._isApplication) {
    return "application";
  }
  const leftOn = toIsoDate(member.resignationDate);
  if (leftOn && leftOn <= today) {
    return "resigned";
  }
  return "active";
};

export type MapResult = { ok: true; member: SourceMember } | ({ ok: false } & SkippedMember);

export const mapEasyVereinMember = (raw: EasyVereinMember, today: string): MapResult => {
  const email = raw.emailOrUserName.trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    return { ok: false, easyvereinId: String(raw.id), reason: "no valid email" };
  }

  return {
    ok: true,
    member: {
      easyvereinId: String(raw.id),
      email,
      firstName: raw.contactDetails.firstName.trim(),
      lastName: raw.contactDetails.familyName.trim(),
      status: deriveStatus(raw, today),
      // Not mapped yet: confirm which easyVerein field holds it before real data.
      membershipType: null,
      joinedOn: toIsoDate(raw.joinDate),
      leftOn: toIsoDate(raw.resignationDate),
    },
  };
};

/** Map a list, collecting members that cannot be used instead of failing the run. */
export const mapEasyVereinMembers = (raws: Array<EasyVereinMember>, today: string) => {
  const members: Array<SourceMember> = [];
  const skipped: Array<SkippedMember> = [];
  for (const raw of raws) {
    const result = mapEasyVereinMember(raw, today);
    if (result.ok) {
      members.push(result.member);
    } else {
      skipped.push({ easyvereinId: result.easyvereinId, reason: result.reason });
    }
  }
  return { members, skipped };
};

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
