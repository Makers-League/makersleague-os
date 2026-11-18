import type { Member } from "@ml/db";

import type { SourceMember } from "./types";

/** The member columns the sync reads, compares and writes. */
export const EXISTING_MEMBER_COLUMNS =
  "id, easyverein_id, user_id, email, first_name, last_name, status, membership_type, joined_on, left_on, deleted_at";

export type ExistingMember = Pick<
  Member,
  | "id"
  | "easyverein_id"
  | "user_id"
  | "email"
  | "first_name"
  | "last_name"
  | "status"
  | "membership_type"
  | "joined_on"
  | "left_on"
  | "deleted_at"
>;

export type MemberValues = ReturnType<typeof toValues>;

export type SyncPlan = {
  inserts: MemberValues[];
  /** Changed members, including ones that reappeared after being marked deleted. */
  updates: { id: string; values: MemberValues; restored: boolean }[];
  unchangedIds: string[];
  /** Members missing in easyVerein: they get deleted_at, nothing is removed. */
  markDeletedIds: string[];
  stop: { reason: string } | null;
};

export const MAX_DELETE_RATIO = 0.1;

export const toValues = (m: SourceMember) => ({
  easyverein_id: m.easyvereinId,
  email: m.email,
  first_name: m.firstName,
  last_name: m.lastName,
  status: m.status,
  membership_type: m.membershipType,
  joined_on: m.joinedOn,
  left_on: m.leftOn,
});

const fields = [
  "easyverein_id",
  "email",
  "first_name",
  "last_name",
  "status",
  "membership_type",
  "joined_on",
  "left_on",
] as const satisfies readonly (keyof MemberValues)[];

/**
 * Decide what one sync run changes. Pure, so every rule is unit-tested:
 * new, changed, removed in easyVerein, reappeared, and the safety stop.
 * Logins are brought in line afterwards from the resulting state
 * (public.sync_member_logins), not from this diff.
 *
 * `skippedIds` are records easyVerein returned but we could not use (e.g. no
 * valid email). They still exist there, so they are left as they are.
 */
export const planSync = (
  existing: ExistingMember[],
  incoming: SourceMember[],
  skippedIds: string[] = [],
  maxDeleteRatio = MAX_DELETE_RATIO,
): SyncPlan => {
  const seen = new Set<string>(skippedIds);
  for (const m of incoming) {
    if (seen.has(m.easyvereinId)) {
      throw new Error(`easyVerein returned member ${m.easyvereinId} twice`);
    }
    seen.add(m.easyvereinId);
  }

  const byEasyVereinId = new Map(existing.map((m) => [m.easyverein_id, m]));
  const plan: SyncPlan = {
    inserts: [],
    updates: [],
    unchangedIds: [],
    markDeletedIds: [],
    stop: null,
  };

  for (const source of incoming) {
    const values = toValues(source);
    const current = byEasyVereinId.get(source.easyvereinId);
    if (!current) {
      plan.inserts.push(values);
      continue;
    }
    const restored = current.deleted_at !== null;
    const changed = restored || fields.some((f) => current[f] !== values[f]);
    if (!changed) {
      plan.unchangedIds.push(current.id);
      continue;
    }
    plan.updates.push({ id: current.id, values, restored });
  }

  for (const current of existing) {
    if (current.deleted_at === null && !seen.has(current.easyverein_id)) {
      plan.markDeletedIds.push(current.id);
    }
  }

  const notDeleted = existing.filter((m) => m.deleted_at === null).length;
  // A single removal is always allowed, so small clubs are not stuck.
  const allowed = Math.max(1, Math.floor(notDeleted * maxDeleteRatio));
  if (plan.markDeletedIds.length > allowed || (incoming.length === 0 && notDeleted > 0)) {
    plan.stop = {
      reason:
        `Safety stop: ${plan.markDeletedIds.length} of ${notDeleted} members would be marked ` +
        `deleted (more than ${Math.round(maxDeleteRatio * 100)}%). Nothing was changed.`,
    };
  }

  return plan;
};
