import { execSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAdminClient } from "@ml/db";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { defaultFixturesPath, fixturesSource } from "./fixtures";
import { runSync } from "./sync";

// Runs against the local Supabase stack (pnpm db:start). Each test starts from
// a freshly seeded database.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!publishableKey)
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set (see .env.example)");
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set (see .env.example)");

const client = createAdminClient(url, secretKey);
const clubId = "00000000-0000-4000-8000-000000000001";
const now = () => new Date("2026-11-18T12:00:00Z");

const resetDb = () =>
  execSync("pnpm exec supabase db reset", {
    cwd: join(__dirname, "../../.."),
    stdio: "ignore",
  });

const member = async (easyvereinId: string) => {
  const { data, error } = await client
    .from("members")
    .select("*")
    .eq("club_id", clubId)
    .eq("easyverein_id", easyvereinId)
    .single();
  if (error) throw error;
  return data;
};

describe("runSync against local Supabase", () => {
  beforeEach(resetDb, 60_000);

  it("syncs the fixtures into the seeded club and logs the run", async () => {
    const result = await runSync({ client, clubId, source: fixturesSource(undefined, now), now });

    expect(result.status).toBe("succeeded");
    expect(result.skipped).toEqual([{ easyvereinId: "1012", reason: "no valid email" }]);
    expect(result.stats).toMatchObject({ received: 10, skipped: 1, inserted: 1, markedDeleted: 0 });

    const kim = await member("1011");
    expect(kim).toMatchObject({ email: "kim@example.com", status: "active", role: "member" });

    // Roles set by admins survive a sync.
    expect((await member("1001")).role).toBe("admin");
    // Hans was already marked deleted and is not in easyVerein: still there, still marked.
    expect((await member("1008")).deleted_at).not.toBeNull();

    const { data: run } = await client
      .from("sync_runs")
      .select("*")
      .eq("id", result.runId)
      .single();
    expect(run).toMatchObject({ status: "succeeded", source: "fixtures" });
    expect(run?.finished_at).not.toBeNull();
  });

  it("marks a removed member as deleted and signs them out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ml-fixtures-"));
    const path = join(dir, "members.json");
    const all = z
      .array(z.looseObject({ id: z.number() }))
      .parse(JSON.parse(await readFile(defaultFixturesPath, "utf8")));
    await writeFile(path, JSON.stringify(all.filter((m) => m.id !== 1005)));

    // Emma has a login with an open session.
    const password = "test-password-123";
    const created = await client.auth.admin.createUser({
      email: "emma@example.com",
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    expect((await member("1005")).user_id).toBe(created.data.user?.id);
    const emmaClient = createClient(url, publishableKey, { auth: { persistSession: false } });
    const signIn = await emmaClient.auth.signInWithPassword({
      email: "emma@example.com",
      password,
    });
    expect(signIn.error).toBeNull();

    const result = await runSync({ client, clubId, source: fixturesSource(path, now), now });

    expect(result.status).toBe("succeeded");
    expect(result.stats.markedDeleted).toBe(1);
    const emma = await member("1005");
    expect(emma.deleted_at).not.toBeNull();
    expect(emma.first_name).toBe("Emma");
    expect(result.stats.sessionsRevoked).toBe(1);
    const refresh = await emmaClient.auth.refreshSession();
    expect(refresh.error).not.toBeNull();
    // The login is banned too, so she cannot simply sign in again.
    const again = await emmaClient.auth.signInWithPassword({ email: "emma@example.com", password });
    expect(again.error?.code).toBe("user_banned");
  });

  it("changes nothing when the safety stop triggers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ml-fixtures-"));
    const path = join(dir, "members.json");
    await writeFile(path, "[]");

    const result = await runSync({ client, clubId, source: fixturesSource(path, now), now });

    expect(result.status).toBe("stopped");
    const { count } = await client
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .is("deleted_at", null);
    expect(count).toBe(9);
    const { data: run } = await client
      .from("sync_runs")
      .select("status, error")
      .eq("id", result.runId)
      .single();
    expect(run?.status).toBe("stopped");
    expect(run?.error).toMatch(/Safety stop/);
  });
});
