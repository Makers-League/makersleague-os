"use client";

import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Visibility } from "@/lib/validation";

import { saveProfile } from "./actions";
import type { ProfileState } from "./actions";

const VISIBILITY_OPTIONS = [
  ["members", "Alle Mitglieder"],
  ["board", "Nur der Vorstand"],
] as const satisfies Array<[Visibility, string]>;

type Props = {
  bio: string;
  links: Array<string>;
  visibility: Visibility;
};

export function ProfileForm({ bio, links, visibility }: Props) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bio">Über mich</Label>
        <Textarea id="bio" name="bio" defaultValue={bio} maxLength={2000} rows={5} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="links">Links (einer pro Zeile)</Label>
        <Textarea id="links" name="links" defaultValue={links.join("\n")} rows={3} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Wer sieht mein Profil?</legend>
        {VISIBILITY_OPTIONS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value={value}
              defaultChecked={visibility === value}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <FormError message={state.error} />
      {state.ok && <output className="block text-sm">Gespeichert.</output>}
      <Button type="submit" disabled={pending}>
        Speichern
      </Button>
    </form>
  );
}
