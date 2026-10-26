import { expect, test, type Page } from "@playwright/test";

const email = process.env.TRIPTILES_E2E_EMAIL?.trim() ?? "";
const password = process.env.TRIPTILES_E2E_PASSWORD ?? "";
const startDate = "2026-12-06";
const endDate = "2026-12-13";
const revisedName = "Orlando 2026 revised";

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Sign in to TripTiles" })).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.waitForURL(/\/(onboarding|trip\/[0-9a-f-]{36})/i, { timeout: 60_000 });
  const error = page.locator("#login-error");
  if (await error.isVisible().catch(() => false)) {
    throw new Error(`Login failed: ${(await error.innerText()).trim()}`);
  }
}

async function createOrlandoTrip(page: Page) {
  if (!page.url().includes("/onboarding")) {
    await page.goto("/onboarding", { waitUntil: "commit" });
  }
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await page.getByRole("button", { name: /Orlando/ }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Next →" }).click();

  await page.getByLabel("Start date").fill(startDate);
  await page.getByLabel("End date").fill(endDate);
  await page.getByRole("button", { name: "Next →" }).click();

  await page.getByLabel("Adults").fill("2");
  await page.getByRole("button", { name: "Next →" }).click();

  await expect(page.getByRole("heading", { name: "What kind of holiday is this?" })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await expect(page.getByRole("heading", { name: "What do you want from the trip?" })).toBeVisible();
  await page.getByRole("button", { name: /Magic Kingdom/ }).click();
  await page.getByRole("button", { name: /Epic Universe/ }).click();
  await page.getByRole("button", { name: "Next →" }).click();

  await expect(page.getByRole("heading", { name: "How are you handling the queues?" })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await expect(page.getByRole("heading", { name: "Park days vs rest days?" })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await page.getByRole("button", { name: /plan it myself/ }).click();
  await page.getByRole("button", { name: "Finish ✨" }).click();
  await page.waitForURL(/\/trip\/[0-9a-f-]{36}/i, { timeout: 60_000 });
}

async function openOrganise(page: Page) {
  const organiseLink = page.getByRole("link", { name: "Organise", exact: true });
  if (await organiseLink.isVisible().catch(() => false)) {
    await organiseLink.click();
    await page.waitForURL(/tab=planning/);
  } else {
    await expect(page).toHaveURL(/tab=planning/);
  }
  const preferences = page.getByRole("button", { name: /Planning preferences/ });
  await expect(preferences).toBeVisible();
  if ((await preferences.getAttribute("aria-expanded")) !== "true") {
    await preferences.click();
  }
}

async function openPlanner(page: Page, tripId: string) {
  const plannerLink = page.getByRole("link", { name: "Planner", exact: true });
  if (await plannerLink.isVisible().catch(() => false)) {
    await plannerLink.click();
  }
  await page.waitForURL((url) => url.pathname.includes(`/trip/${tripId}`) && url.searchParams.get("tab") !== "planning");
}

async function expectTripFacts(page: Page, adventureName: string) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(adventureName);
  await expect(page.getByText(/6.13 Dec 2026/).first()).toBeVisible();
  await expect(page.getByText("2 adults").first()).toBeVisible();
  await openOrganise(page);
  const savedParks = page.locator("#organise-preferences-panel");
  await expect(savedParks.getByText("Must-do parks")).toBeVisible();
  await expect(savedParks.getByText("Magic Kingdom")).toBeVisible();
  await expect(savedParks.getByText("Epic Universe")).toBeVisible();
}

test("returning customer logs in, saves an Orlando trip, and sees the edit after signing in again", async ({
  page,
}, testInfo) => {
  test.skip(!email || !password, "TRIPTILES_E2E_EMAIL and TRIPTILES_E2E_PASSWORD are not set");
  test.setTimeout(300_000);

  await signIn(page);
  await createOrlandoTrip(page);

  const tripUrl = page.url();
  const tripId = tripUrl.match(/\/trip\/([0-9a-f-]{36})/i)?.[1];
  if (!tripId) throw new Error(`Trip URL did not include an id: ${tripUrl}`);
  testInfo.annotations.push({ type: "trip-id", description: tripId });

  await expect(page.getByText("Orlando 2026").first()).toBeVisible();
  await expect(page.getByText(/2 must-do parks/).first()).toBeVisible();
  await expectTripFacts(page, "Orlando 2026");

  await openPlanner(page, tripId);
  await expect(page.getByText("Orlando 2026").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/$/);
  await page.goto(`/trip/${tripId}`, { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/planner", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/login\?next=%2Fplanner/);

  await signIn(page);
  await page.waitForURL(new RegExp(`/trip/${tripId}`), { timeout: 60_000 });
  await expectTripFacts(page, "Orlando 2026");

  await openPlanner(page, tripId);
  const adventure = page.locator("h1 [role='textbox']").nth(1);
  await adventure.click();
  await adventure.fill(revisedName);
  await adventure.press("Enter");
  await expect(page.getByText(/Saved /).first()).toBeVisible();

  await page.reload({ waitUntil: "commit" });
  await expect(page).toHaveURL(new RegExp(`/trip/${tripId}`));
  await expectTripFacts(page, revisedName);
});
