import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user's Supabase client and member row. The row is only visible while the
 * member is active (see private.my_role), so `member` is null for people who
 * left, open applications and members removed in easyVerein.
 */
export const getCurrentMember = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: member, error } = await supabase
    .from("active_members")
    .select("id, club_id, first_name, last_name, email, role, clubs(name)")
    .eq("user_id", userId)
    // One login can belong to several rows (e.g. a shared family address).
    // TODO(multi-club): let the member pick the club instead of the oldest row.
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return { supabase, email: data.claims.email, member };
});
