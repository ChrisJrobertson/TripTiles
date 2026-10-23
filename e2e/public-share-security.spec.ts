import { expect, test } from "@playwright/test";
import {
  assertAnonymousShareHidden,
  assertOwnerRetainsPrivateTrip,
  createShareProbe,
  deleteShareProbe,
  publishShareProbe,
  revokeShareProbe,
  type ShareProbe,
} from "../scripts/verify-public-share-security";

test("a published plan shows only the public contract", async ({ page }) => {
  let probe: ShareProbe | null = null;
  try {
    probe = await createShareProbe();
    await assertAnonymousShareHidden(probe, "private");
    await publishShareProbe(probe);
    await assertAnonymousShareHidden(probe, "published");

    const response = await page.goto(`/plans/${probe.slug}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "E2E Public Title" })).toBeVisible();
    await expect(page.getByText("2099-08-01")).toBeVisible();
    await expect(page.getByText("E2E Public Group")).toBeVisible();
    await expect(page.getByText("Rope drop at Magic Kingdom").first()).toBeVisible();
    await expect(page.getByText("Magic Kingdom").first()).toBeVisible();

    const html = await page.content();
    for (const token of probe.tokens) {
      expect(html.includes(token), "public page leaked a private token").toBe(false);
    }
    expect(html.includes('"child_ages":[13]'), "public page serialised child ages").toBe(false);

    const missing = await page.goto("/plans/not-a-published-e2e-slug", {
      waitUntil: "domcontentloaded",
    });
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
    const missingHtml = await page.content();
    expect(missingHtml.includes("E2E Public Title"), "unknown slug showed the public title").toBe(false);
    for (const token of probe.tokens) {
      expect(missingHtml.includes(token), "unknown slug leaked a private token").toBe(false);
    }

    await revokeShareProbe(probe);
    const revoked = await page.goto(`/plans/${probe.slug}`, { waitUntil: "domcontentloaded" });
    expect(revoked?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
    const revokedHtml = await page.content();
    expect(revokedHtml.includes("E2E Public Title"), "revoked plan stayed on the public page").toBe(false);
    for (const token of probe.tokens) {
      expect(revokedHtml.includes(token), "revoked plan leaked a private token").toBe(false);
    }
    await assertAnonymousShareHidden(probe, "revoked");
    await assertOwnerRetainsPrivateTrip(probe);
  } finally {
    if (probe) await deleteShareProbe(probe);
  }
});
