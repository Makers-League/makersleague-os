/** A member as the sync sees it, after mapping from easyVerein. */
export type SourceMember = {
  easyvereinId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: MemberStatus;
  membershipType: string | null;
  /** ISO date (YYYY-MM-DD) */
  joinedOn: string | null;
  /** ISO date (YYYY-MM-DD), the exit date in easyVerein */
  leftOn: string | null;
};

export type MemberStatus = "application" | "active" | "resigned";

/** Where the sync gets its members from: fixtures today, the easyVerein API later. */
export type MemberSource = {
  name: "fixtures" | "api";
  listMembers: () => Promise<SourceResult>;
};

export type SourceResult = {
  members: SourceMember[];
  /** Records that could not be used, e.g. without a valid email. */
  skipped: SkippedMember[];
};

export type SkippedMember = { easyvereinId: string; reason: string };
