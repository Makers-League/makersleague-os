"use client";

import { useActionState, useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type LoginState, requestCode, verifyCode } from "./actions";

/** Remounting the steps resets both forms, e.g. to try another address. */
export function LoginForm() {
  const [attempt, setAttempt] = useState(0);
  return <LoginSteps key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}

function LoginSteps({ onRestart }: { onRestart: () => void }) {
  const [emailState, emailAction, emailPending] = useActionState<LoginState, FormData>(
    requestCode,
    {
      step: "email",
    },
  );
  const [codeState, codeAction, codePending] = useActionState<LoginState, FormData>(verifyCode, {
    step: "code",
    email: "",
  });
  if (emailState.step !== "code") {
    return (
      <form action={emailAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={emailState.email}
            aria-invalid={Boolean(emailState.error)}
          />
          <p className="text-sm text-muted-foreground">
            Die Adresse, mit der du bei easyVerein eingetragen bist.
          </p>
        </div>
        <FormError message={emailState.error} />
        <Button type="submit" className="w-full" disabled={emailPending}>
          Code anfordern
        </Button>
      </form>
    );
  }

  const email = emailState.email;
  return (
    <form action={codeAction} className="space-y-4">
      <output className="block text-sm">
        Falls <strong>{email}</strong> zu einem aktiven Mitglied gehört, ist ein 6-stelliger Code
        unterwegs. Du kannst auch auf den Link in der E-Mail klicken.
      </output>
      <input type="hidden" name="email" value={email} />
      <div className="space-y-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          aria-invalid={Boolean(codeState.error)}
        />
      </div>
      <FormError message={codeState.error} />
      <Button type="submit" className="w-full" disabled={codePending}>
        Anmelden
      </Button>
      <Button type="button" variant="link" className="w-full" onClick={onRestart}>
        Andere E-Mail-Adresse verwenden
      </Button>
    </form>
  );
}
