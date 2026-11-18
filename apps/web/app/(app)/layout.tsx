import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/member";

import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, email } = await getCurrentMember();

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="flex items-center justify-between gap-4 border-b py-4">
        <Link href="/" className="font-semibold">
          Makers League OS
        </Link>
        <nav className="flex items-center gap-2">
          {member && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/profil">Mein Profil</Link>
            </Button>
          )}
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Abmelden
            </Button>
          </form>
        </nav>
      </header>
      <main className="py-8">
        {member ? (
          children
        ) : (
          <section className="space-y-2" data-testid="no-access">
            <h1 className="text-xl font-semibold">Kein Zugang</h1>
            <p className="text-muted-foreground">
              Für {email ?? "diese Adresse"} gibt es keine aktive Mitgliedschaft. Wenn das nicht
              stimmt, melde dich beim Vorstand.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
