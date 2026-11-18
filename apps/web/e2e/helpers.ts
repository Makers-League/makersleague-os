import { createAdminClient } from "@ml/db";
import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSummary = { ID: string; To: { Address: string }[] };

const messagesFor = async (email: string): Promise<MailpitSummary[]> => {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await res.json()) as { messages: MailpitSummary[] | null };
  return body.messages ?? [];
};

export const clearMailbox = async () => {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
};

/** Waits for the login email in the local mail catcher. */
export const readLoginEmail = async (email: string) => {
  let id: string | undefined;
  await expect
    .poll(async () => (id = (await messagesFor(email))[0]?.ID), { timeout: 15_000 })
    .toBeTruthy();
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  return (await res.json()) as { Text: string; HTML: string };
};

export const readLoginCode = async (email: string): Promise<string> => {
  const code = /\b(\d{6})\b/.exec((await readLoginEmail(email)).Text)?.[1];
  if (!code) throw new Error(`No code in email to ${email}`);
  return code;
};

/** Gives Supabase time to (not) send anything, then checks the mailbox stayed empty. */
export const expectNoMail = async (page: Page, email: string) => {
  await page.waitForTimeout(2_000);
  expect((await messagesFor(email)).length).toBe(0);
};

export const requestCode = async (page: Page, email: string) => {
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

type Cookies = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;
const sessions = new Map<string, Cookies>();

/**
 * Logs in once per email and reuses the session cookies afterwards. Supabase
 * limits how often one address can request a code, so tests that are not about
 * the login itself should use this.
 */
export const signedIn = async (page: Page, email: string) => {
  const cookies = sessions.get(email);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto("/");
    return;
  }
  await login(page, email);
  sessions.set(email, await page.context().cookies());
};

/** Secret-key client for arranging test data, like the sync would. */
export const admin = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SECRET_KEY ?? "",
  );
