import { createAdminClient } from "@ml/db";

import { apiSource } from "./api";
import { fixturesSource } from "./fixtures";
import { runSync } from "./sync";
import type { MemberSource } from "./types";

type Env = Record<string, string | undefined>;

const required = (env: Env, name: string) => {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

/** EASYVEREIN_SOURCE=fixtures or api. No default, so a deploy never syncs fixtures by accident. */
export const sourceFromEnv = (env: Env = process.env): MemberSource => {
  const kind = required(env, "EASYVEREIN_SOURCE");
  if (kind === "fixtures") return fixturesSource(env.EASYVEREIN_FIXTURES_PATH || undefined);
  if (kind === "api") return apiSource({ token: required(env, "EASYVEREIN_TOKEN") });
  throw new Error(`Unknown EASYVEREIN_SOURCE: ${kind}`);
};

/** Used by `pnpm sync` and the Netlify background function. */
export const syncClubFromEnv = async (env: Env = process.env) => {
  const client = createAdminClient(
    required(env, "NEXT_PUBLIC_SUPABASE_URL"),
    required(env, "SUPABASE_SECRET_KEY"),
  );
  const slug = env.SYNC_CLUB_SLUG ?? "makers-league";
  const { data: club, error } = await client.from("clubs").select("id").eq("slug", slug).single();
  if (error || !club) throw new Error(`Club ${slug} not found: ${error?.message}`);
  return runSync({ client, clubId: club.id, source: sourceFromEnv(env) });
};
