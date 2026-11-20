import type { Metadata } from "next";
import { z } from "zod";

import { getCurrentMember } from "@/lib/member";
import { profileSchema } from "@/lib/validation";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function ProfilePage() {
  const { member, supabase } = await getCurrentMember();
  if (!member) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("bio, links, visibility")
    .eq("member_id", member.id)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const links = z.array(z.string()).catch([]).parse(profile?.links);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mein Profil</h1>
        <p className="text-muted-foreground">
          {member.first_name} {member.last_name} · {member.email}. Name und E-Mail kommen aus
          easyVerein.
        </p>
      </div>
      <ProfileForm
        bio={profile?.bio ?? ""}
        links={links}
        visibility={profileSchema.shape.visibility.catch("members").parse(profile?.visibility)}
      />
    </div>
  );
}
