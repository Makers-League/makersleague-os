import { createClient } from "@supabase/supabase-js";

import type { Database, Tables } from "./database.types";

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type Member = Tables<"members">;
export type Profile = Tables<"profiles">;
export type Club = Tables<"clubs">;
export type SyncRun = Tables<"sync_runs">;

/**
 * Client with the secret key. It bypasses row level security, so it is only
 * for the sync and other server jobs, never for pages or server actions.
 */
export const createAdminClient = (url: string, secretKey: string) =>
  createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export type AdminClient = ReturnType<typeof createAdminClient>;
