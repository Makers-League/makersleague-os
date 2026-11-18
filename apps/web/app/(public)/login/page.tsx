import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { fehler } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Makers League OS</h1>
        <p className="text-muted-foreground">Melde dich mit deiner E-Mail-Adresse an.</p>
      </div>
      {fehler === "link" && (
        <p role="alert" className="text-sm text-destructive">
          Der Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen Code an.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
