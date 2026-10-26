import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

const appPassword = "JourneyCheck1";
const inboxPassword = "InboxCheck1a";
const startDate = "2026-12-06";
const endDate = "2026-12-13";

async function createInbox(): Promise<{ email: string; token: string }> {
  const domainRes = await fetch("https://api.mail.tm/domains");
  if (!domainRes.ok) throw new Error(`Temporary inbox domains returned ${domainRes.status}`);
  const domains = (await domainRes.json()) as {
    "hydra:member"?: { domain?: string }[];
  };
  const domain = domains["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("No temporary inbox domain is available");

  const email = `triptiles-e2e-${Date.now()}@${domain}`;
  const created = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: email, password: inboxPassword }),
  });
  if (!created.ok) {
    throw new Error(`Temporary inbox create returned ${created.status}`);
  }

  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: email, password: inboxPassword }),
  });
  if (!tokenRes.ok) throw new Error(`Temporary inbox token returned ${tokenRes.status}`);
  const tokenBody = (await tokenRes.json()) as { token?: string };
  if (!tokenBody.token) throw new Error("Temporary inbox did not return a token");
  return { email, token: tokenBody.token };
}

async function waitForConfirmation(
  token: string,
): Promise<{ kind: "code"; value: string } | { kind: "link"; value: string }> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const list = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (list.ok) {
      const body = (await list.json()) as { "hydra:member"?: { id: string }[] };
      for (const message of body["hydra:member"] ?? []) {
        const full = await fetch(`https://api.mail.tm/messages/${message.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!full.ok) continue;
        const mail = (await full.json()) as {
          subject?: string;
          text?: string;
          intro?: string;
          html?: string | string[];
        };
        const html = Array.isArray(mail.html) ? mail.html.join("\n") : (mail.html ?? "");
        const text = `${mail.subject ?? ""}\n${mail.text ?? ""}\n${mail.intro ?? ""}\n${html}`.replaceAll(
          "&amp;",
          "&",
        );
        const link = text.match(
          /https:\/\/[^\s"'<>\]]+\/auth\/v1\/verify\?[^\s"'<>\]]+/,
        );
        if (link?.[0]) return { kind: "link", value: link[0] };
        const code = text.match(/\b(\d{8})\b/);
        if (code?.[1]) return { kind: "code", value: code[1] };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(
    "BLOCKED: signup reached email confirmation, but neither a confirmation link nor an 8-digit code arrived in the inbox.",
  );
}

async function deleteAuthUser(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !email.startsWith("triptiles-e2e-")) return;
  const listed = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!listed.ok) return;
  const body = (await listed.json()) as { users?: { id: string; email?: string }[] };
  const match = body.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!match) return;
  await fetch(`${url}/auth/v1/admin/users/${match.id}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

async function signupOutcome(page: Page): Promise<"verify" | "app"> {
  const errorBox = page.locator("p.border-red-200");
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (page.url().includes("/signup/verify")) return "verify";
    if (/\/(onboarding|planner|trip)\b/.test(page.url())) return "app";
    if (await errorBox.isVisible().catch(() => false)) {
      const message = (await errorBox.innerText()).trim();
      if (/rate limit/i.test(message)) {
        throw new Error(
          `BLOCKED: signup email was not sent. Supabase returned: ${message}`,
        );
      }
      throw new Error(`Signup was rejected: ${message}`);
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Signup did not leave the form. URL: ${page.url()}`);
}

async function expectSavedTrip(page: Page) {
  await expect(page.getByText("Orlando 2026").first()).toBeVisible();
  await expect(page.getByText(/6.13 Dec 2026/).first()).toBeVisible();
  await expect(page.getByText("2 adults").first()).toBeVisible();
  await expect(page.getByText(/2 must-do parks/)).toBeVisible();

  const organised = new URL(page.url());
  organised.searchParams.set("tab", "planning");
  await page.goto(organised.toString(), { waitUntil: "commit" });
  const preferences = page.getByRole("button", { name: /Planning preferences/ });
  await expect(preferences).toBeVisible();
  if ((await preferences.getAttribute("aria-expanded")) !== "true") {
    await preferences.click();
  }
  const savedParks = page.locator("#organise-preferences-panel");
  await expect(savedParks.getByText("Must-do parks")).toBeVisible();
  await expect(savedParks.getByText("Magic Kingdom")).toBeVisible();
  await expect(savedParks.getByText("Epic Universe")).toBeVisible();
}

test("register, confirm, create an Orlando trip, and retrieve it after signing in again", async ({
  page,
}) => {
  test.skip(
    process.env.TRIPTILES_E2E_ALLOW_SIGNUP_EMAIL !== "1",
    "Live signup email is separate from the returning-customer journey. Set TRIPTILES_E2E_ALLOW_SIGNUP_EMAIL=1 only when Supabase can send another confirmation.",
  );
  const inbox = await createInbox();
  writeFileSync("/tmp/triptiles-e2e-email.txt", inbox.email);

  try {
    await page.goto("/signup", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Create your TripTiles account" })).toBeVisible();
    await page.locator("#signup-email").fill(inbox.email);
    await page.locator("#signup-password").fill(appPassword);
    await expect(page.locator("#signup-password")).toHaveValue(appPassword);
    await page.locator("#signup-confirm").fill(appPassword);
    await expect(page.locator("#signup-confirm")).toHaveValue(appPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    const next = await signupOutcome(page);

    if (next === "verify") {
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      const confirmation = await waitForConfirmation(inbox.token);
      if (confirmation.kind === "code") {
        await page.locator("#email-otp-input").fill(confirmation.value);
        await page.getByRole("button", { name: "Verify" }).click();
      } else {
        await page.goto(confirmation.value, { waitUntil: "commit" });
      }
      await page.waitForURL(/\/(onboarding|planner|trip)\b/, { timeout: 60_000 });
    }

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
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "Next →" }).click();

    await page.getByRole("button", { name: /Magic Kingdom/ }).click();
    await page.getByRole("button", { name: /Epic Universe/ }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "Next →" }).click();

    await page.getByRole("button", { name: /plan it myself/ }).click();
    await page.getByRole("button", { name: "Finish ✨" }).click();
    await page.waitForURL(/\/trip\/[0-9a-f-]{36}/i, { timeout: 60_000 });
    const tripUrl = page.url();

    await expectSavedTrip(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login|\/$/);

    await page.goto("/login", { waitUntil: "commit" });
    await page.getByLabel("Email address").fill(inbox.email);
    await page.getByLabel(/^Password$/).fill(appPassword);
    await page.getByRole("button", { name: "Sign in with password" }).click();
    await page.waitForURL(/\/trip\/[0-9a-f-]{36}/i, { timeout: 60_000 });
    await expect(page).toHaveURL(tripUrl);
    await expectSavedTrip(page);
  } finally {
    await deleteAuthUser(inbox.email);
  }
});
