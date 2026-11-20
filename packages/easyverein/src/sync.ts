import type { AdminClient, Json } from "@ml/db";

import { EXISTING_MEMBER_COLUMNS, planSync } from "./plan";
import type { ExistingMember } from "./plan";
import type { MemberSource, SkippedMember } from "./types";

export type SyncStats = {
  received: number;
  skipped: number;
  inserted: number;
  updated: number;
  restored: number;
  unchanged: number;
  markedDeleted: number;
  sessionsRevoked: number;
};

export type SyncResult = {
  runId: number;
  status: "succeeded" | "stopped";
  stats: SyncStats;
  skipped: Array<SkippedMember>;
  error?: string;
};

type RunSyncOptions = {
  client: AdminClient;
  clubId: string;
  source: MemberSource;
  now?: () => Date;
};

const PAGE_SIZE = 1000; // PostgREST max_rows

/** All member rows of the club, page by page (PostgREST caps each response). */
const loadMembers = async (client: AdminClient, clubId: string) => {
  const rows: Array<ExistingMember> = [];
  // Pages load one after another: each one starts where the last one ended.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await client
      .from("members")
      .select(EXISTING_MEMBER_COLUMNS)
      .eq("club_id", clubId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
      .throwOnError();
    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
};

/**
 * One-way sync easyVerein -> members for one club. Never deletes rows:
 * members missing in easyVerein get deleted_at and lose access. Every run
 * writes a sync_runs row.
 */
export const runSync = async ({
  client,
  clubId,
  source,
  now = () => new Date(),
}: RunSyncOptions): Promise<SyncResult> => {
  const { data: run } = await client
    .from("sync_runs")
    .insert({ club_id: clubId, source: source.name })
    .select("id")
    .single()
    .throwOnError();
  const runId = run.id;

  const finish = async (status: "succeeded" | "stopped" | "failed", stats: Json, error?: string) =>
    client
      .from("sync_runs")
      .update({ status, stats, error: error ?? null, finished_at: now().toISOString() })
      .eq("id", runId)
      .throwOnError();

  try {
    // The easyVerein fetch and the member load are independent.
    const [{ members: incoming, skipped }, existing] = await Promise.all([
      source.listMembers(),
      loadMembers(client, clubId),
    ]);

    const plan = planSync(
      existing,
      incoming,
      skipped.map((m) => m.easyvereinId),
    );
    const stats: SyncStats = {
      received: incoming.length,
      skipped: skipped.length,
      inserted: plan.inserts.length,
      updated: plan.updates.length,
      restored: plan.updates.filter((u) => u.restored).length,
      unchanged: plan.unchangedIds.length,
      markedDeleted: plan.markDeletedIds.length,
      sessionsRevoked: 0,
    };

    if (plan.stop) {
      // TODO(alerts): email the club admins via Lettermint once it is set up.
      await finish("stopped", stats, plan.stop.reason);
      return { runId, status: "stopped", stats, skipped, error: plan.stop.reason };
    }

    const syncedAt = now().toISOString();
    const upserts = [...plan.inserts, ...plan.updates.map((u) => u.values)].map((values) => ({
      ...values,
      club_id: clubId,
      deleted_at: null,
      synced_at: syncedAt,
    }));

    // Disjoint rows, so the writes can run together. A run that fails half-way
    // is safe to repeat: the next run plans from the new state, and logins are
    // synced from state, not from this run's diff.
    const writes = await Promise.allSettled([
      upserts.length > 0 &&
        client
          .from("members")
          .upsert(upserts, { onConflict: "club_id,easyverein_id" })
          .throwOnError(),
      plan.unchangedIds.length > 0 &&
        client
          .from("members")
          .update({ synced_at: syncedAt })
          .in("id", plan.unchangedIds)
          .throwOnError(),
      plan.markDeletedIds.length > 0 &&
        client
          .from("members")
          .update({ deleted_at: syncedAt })
          .in("id", plan.markDeletedIds)
          .is("deleted_at", null)
          .throwOnError(),
    ]);
    const failed = writes.find((w) => w.status === "rejected");
    if (failed) {
      throw failed.reason;
    }

    const { data: revoked } = await client
      .rpc("sync_member_logins", { club: clubId })
      .throwOnError();
    stats.sessionsRevoked = revoked;

    await finish("succeeded", { ...stats, skippedMembers: skipped });
    return { runId, status: "succeeded", stats, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finish("failed", {}, message).catch(() => undefined);
    throw error;
  }
};
