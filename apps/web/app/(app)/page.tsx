import { getCurrentMember } from "@/lib/member";

export default async function DashboardPage() {
  const { member, supabase } = await getCurrentMember();
  if (!member) return null;

  const { data: members, error } = await supabase
    .from("active_members")
    .select("id, first_name, last_name, profiles(bio)")
    .eq("club_id", member.club_id)
    .order("first_name");
  if (error) throw error;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Hallo {member.first_name}!</h1>
        <p className="text-muted-foreground">
          Willkommen bei {member.clubs.name}. Hier entstehen bald die ersten Funktionen.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mitglieder</h2>
        <ul className="divide-y rounded-lg border" data-testid="member-list">
          {members.map((m) => (
            <li key={m.id} className="p-3">
              <p className="font-medium">
                {m.first_name} {m.last_name}
              </p>
              {m.profiles?.bio && <p className="text-sm text-muted-foreground">{m.profiles.bio}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
