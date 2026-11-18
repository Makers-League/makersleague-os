"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { codeSchema, emailSchema } from "@/lib/validation";

export type LoginState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string };

/**
 * Step 1: send a login code. The Before User Created hook rejects anyone who is
 * not an active member; we show the same message either way, so the form does
 * not reveal who is a member.
 */
export async function requestCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return { step: "email", error: parsed.error.issues[0]?.message, email: rawEmail };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // The email template builds its link from the site URL, so no redirect is passed.
    options: { shouldCreateUser: true },
  });

  if (error?.status === 429) {
    return {
      step: "email",
      email: parsed.data.email,
      error: "Zu viele Versuche. Bitte warte kurz.",
    };
  }
  // Expected and not shown: 403 from the allow-list hook (not a member) and
  // user_banned (a former member whose login the sync has closed).
  if (error && error.status !== 403 && error.code !== "user_banned") {
    console.error("signInWithOtp failed", error.status, error.code);
  }

  return { step: "code", email: parsed.data.email };
}

/** Step 2: check the 6-digit code and start the session. */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = codeSchema.safeParse({ email, code: formData.get("code") });
  if (!parsed.success) {
    return { step: "code", email, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) {
    return { step: "code", email, error: "Der Code ist falsch oder abgelaufen." };
  }

  redirect("/");
}
