import { expect, test } from "@playwright/test";

test("marketing home and pricing render", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText("Wait times", { exact: false }).first()).toBeVisible();
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/pricing/);
  await expect(page.getByRole("heading", { name: "Pick your perfect plan" })).toBeVisible();
});

test("signup blocks an invalid email and a short password before creating an account", async ({ page }) => {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Create your TripTiles account" })).toBeVisible();
  await page.locator("#signup-email").fill("not-an-email");
  await page.locator("#signup-password").fill("longpassword1");
  await page.locator("#signup-confirm").fill("longpassword1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#signup-email")).toHaveJSProperty("validity.valid", false);
  await expect(page).toHaveURL(/\/signup/);

  await page.locator("#signup-email").fill("launch-check@example.com");
  await page.locator("#signup-password").fill("short");
  await page.locator("#signup-confirm").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#signup-password")).toHaveJSProperty("validity.valid", false);
  await expect(page).toHaveURL(/\/signup/);
});

test("signup rejects a password mismatch", async ({ page }) => {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Create your TripTiles account" })).toBeVisible();
  await page.locator("#signup-email").fill("launch-check@example.com");
  await page.locator("#signup-password").fill("longpassword1");
  await page.locator("#signup-confirm").fill("longpassword2");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords must match.")).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("login rejects an unknown password without leaving the form", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill("nobody-triptiles-e2e@example.com");
  await page.getByLabel(/Password/).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("protected planner redirects to login", async ({ page }) => {
  await page.goto("/planner", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fplanner/);
  await expect(page.getByRole("heading", { name: "Sign in to TripTiles" })).toBeVisible();
});

test("settings redirect to login", async ({ page }) => {
  await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fprofile/);
});
