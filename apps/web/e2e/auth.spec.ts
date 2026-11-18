import { expect, test } from "@playwright/test";

import { admin, clearMailbox, expectNoMail, login, readLoginEmail, requestCode } from "./helpers";

test.beforeEach(clearMailbox);

test("visitors without a session are sent to the login page", async ({ page }) => {
  await page.goto("/profil");
  await expect(page).toHaveURL("/login");
});

test("an active member logs in with the emailed code", async ({ page }) => {
  await login(page, "clara@example.com");
  await expect(page.getByRole("heading", { name: "Hallo Clara!" })).toBeVisible();
  await expect(page.getByTestId("member-list")).toContainText("Ada Admin");
});

test("the link in the email logs in too", async ({ page }) => {
  await requestCode(page, "jonas@example.com");
  const message = await readLoginEmail("jonas@example.com");
  const href = /href="([^"]+auth\/confirm[^"]+)"/.exec(message.HTML)?.[1]?.replaceAll("&amp;", "&");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: "Hallo Jonas!" })).toBeVisible();
});

test("a wrong code is rejected", async ({ page }) => {
  await requestCode(page, "bert@example.com");
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("form-error")).toHaveText("Der Code ist falsch oder abgelaufen.");
});

test("a non-member gets the same answer but no email and no account", async ({ page }) => {
  await requestCode(page, "stranger@example.com");
  await expectNoMail(page, "stranger@example.com");
  const { data } = await admin().auth.admin.listUsers();
  expect(data.users.map((u) => u.email)).not.toContain("stranger@example.com");
});

test("a member who left cannot get a login", async ({ page }) => {
  await requestCode(page, "felix@example.com");
  await expectNoMail(page, "felix@example.com");
});

test("access closes as soon as the exit date has passed", async ({ page }) => {
  await login(page, "emma@example.com");
  await expect(page.getByRole("heading", { name: "Hallo Emma!" })).toBeVisible();

  const { error } = await admin()
    .from("members")
    .update({ status: "resigned", left_on: "2026-01-01" })
    .eq("email", "emma@example.com");
  expect(error).toBeNull();

  await page.reload();
  await expect(page.getByTestId("no-access")).toBeVisible();
  await expect(page.getByTestId("member-list")).toHaveCount(0);
});

test("signing out ends the session", async ({ page }) => {
  await login(page, "ida@example.com");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("an expired or used link explains what happened", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalid&type=email");
  await expect(page).toHaveURL("/login?fehler=link");
  await expect(page.getByText("Der Link ist abgelaufen")).toBeVisible();
});
