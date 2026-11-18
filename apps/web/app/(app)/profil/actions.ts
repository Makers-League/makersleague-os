"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export type ProfileState = { ok?: boolean; error?: string };

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { member } = await getCurrentMember();
  if (!member) return { error: "Kein Zugang." };

  const parsed = profileSchema.safeParse({
    bio: formData.get("bio") ?? "",
    links: formData.get("links") ?? "",
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Row level security makes sure a member can only write their own profile.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ member_id: member.id, ...parsed.data }, { onConflict: "member_id" });
  if (error) {
    console.error("saveProfile failed", error.code);
    return { error: "Speichern hat nicht geklappt." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
