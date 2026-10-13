import { expect, test } from "@playwright/test";

const email = "chrisjrobertson@outlook.com";
const password = process.env.TEST_CHRIS_PASSWORD;

test("existing customer can sign in and reopen a saved trip", async ({ page }) => {
  test.skip(!password, "TEST_CHRIS_PASSWORD is not set");
  test.setTimeout(180_000);

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/Password/).fill(password!);
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.waitForURL(/\/trip\/[0-9a-f-]{36}/i);
  const tripUrl = page.url();

  await page.reload();
  await expect(page).toHaveURL(tripUrl);
  await expect(page.getByRole("heading", { name: "Sign in to TripTiles" })).toHaveCount(0);

  await page.goto("/login");
  await page.goto(tripUrl);
  await expect(page).toHaveURL(tripUrl);
});
