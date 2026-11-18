import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

test("a member edits their own profile", async ({ page }) => {
  await signedIn(page, "clara@example.com");
  await page.getByRole("link", { name: "Mein Profil" }).click();
  await page.getByLabel("Über mich").fill("Baue gerade einen Plotter.");
  await page.getByLabel("Links (einer pro Zeile)").fill("https://example.com/clara");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Über mich")).toHaveValue("Baue gerade einen Plotter.");
  await page.goto("/");
  await expect(page.getByTestId("member-list")).toContainText("Baue gerade einen Plotter.");
});

test("invalid links are rejected", async ({ page }) => {
  await signedIn(page, "clara@example.com");
  await page.goto("/profil");
  await page.getByLabel("Links (einer pro Zeile)").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByTestId("form-error")).toContainText("http");
});

test("board-only profiles are hidden from members but shown to the board", async ({ browser }) => {
  const member = await browser.newPage();
  await signedIn(member, "clara@example.com");
  await expect(member.getByTestId("member-list")).toContainText("David Drucker");
  await expect(member.getByTestId("member-list")).not.toContainText(
    "Nur für den Vorstand sichtbar.",
  );

  const board = await browser.newPage();
  await signedIn(board, "bert@example.com");
  await expect(board.getByTestId("member-list")).toContainText("Nur für den Vorstand sichtbar.");
});
