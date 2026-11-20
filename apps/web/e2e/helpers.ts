import { createAdminClient } from "@ml/db";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { z } from "zod";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

const searchResult = z.object({ messages: z.array(z.object({ ID: z.string() })).nullable() });
const message = z.object({ Text: z.string(), HTML: z.string() });

// Tests run in parallel and share one mailbox, so everything is scoped to one address.
const searchUrl = (email: string) =>
  `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;

const messagesFor = async (email: string) => {
  const res = await fetch(searchUrl(email));
  return searchResult.parse(await res.json()).messages ?? [];
};

const clearMailFor = async (email: string) => {
  await fetch(searchUrl(email), { method: "DELETE" });
};

/** Waits for the login email in the local mail catcher. */
export const readLoginEmail = async (email: string) => {
  let id: string | undefined;
  await expect
    .poll(async () => (id = (await messagesFor(email))[0]?.ID), { timeout: 15_000 })
    .toBeTruthy();
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  return message.parse(await res.json());
};

export const readLoginCode = async (email: string): Promise<string> => {
  const code = /\b(\d{6})\b/.exec((await readLoginEmail(email)).Text)?.[1];
  if (!code) {
    throw new Error(`No code in email to ${email}`);
  }
  return code;
};

/**
 * Supabase sends the email before it answers the request, so by the time the form shows its
 * answer a mail would already be in Mailpit. The short wait is only a margin.
 */
export const expectNoMail = async (page: Page, email: string) => {
  await page.waitForTimeout(300);
  expect(await messagesFor(email)).toHaveLength(0);
};

export const requestCode = async (page: Page, email: string) => {
  await clearMailFor(email);
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Code anfordern" }).click();
  await expect(page.getByText(`Falls ${email} zu einem aktiven Mitglied gehört`)).toBeVisible();
};

export const login = async (page: Page, email: string) => {
  await requestCode(page, email);
  await page.getByLabel("Code").fill(await readLoginCode(email));
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL("/");
};

/**
 * Signs in without an email: the secret key creates a one-time link, which the app's
 * /auth/confirm route exchanges for a session. Tests that are not about the login itself use
 * this; it is fast and does not hit Supabase's per-address email limits.
 */
export const signedIn = async (page: Page, email: string) => {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    throw error;
  }
  const { hashed_token, verification_type } = data.properties;
  await page.goto(`/auth/confirm?token_hash=${hashed_token}&type=${verification_type}`);
  await expect(page).toHaveURL("/");
};

/** Secret-key client for arranging test data, like the sync would. */
export const admin = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SECRET_KEY ?? "",
  );
