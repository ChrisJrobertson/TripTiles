import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

const LOUD =
  "[stripe webhook] user resolution — cannot link Stripe customer to profile; acking 200 to Stripe";

/**
 * 1) profiles.stripe_customer_id = customerId
 * 2) retrieve Stripe customer email, match profiles.email (case-insensitive)
 * 3) on email match, back-fill profiles.stripe_customer_id
 */
export async function resolveUserIdByStripeCustomerId(
  admin: SupabaseClient,
  stripe: Stripe,
  customerId: string | null | undefined,
  context: { eventId: string; eventType: string },
): Promise<string | null> {
  if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
    console.warn(LOUD, {
      ...context,
      customerId: customerId ?? null,
      email: null,
    });
    return null;
  }
  const cid = customerId.trim();
  const { data: byCust, error: e1 } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", cid)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (byCust?.id) return String(byCust.id);

  let customer: Stripe.Customer | Stripe.DeletedCustomer;
  try {
    customer = await stripe.customers.retrieve(cid);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.warn(LOUD, {
      ...context,
      customerId: cid,
      email: null,
      error: err.message,
    });
    return null;
  }
  if ("deleted" in customer && customer.deleted) {
    console.warn(LOUD, {
      ...context,
      customerId: cid,
      email: null,
    });
    return null;
  }
  const c = customer as Stripe.Customer;
  const email = c.email?.trim() ?? null;
  if (!email) {
    console.warn(LOUD, {
      ...context,
      customerId: cid,
      email: null,
    });
    return null;
  }
  const forIlike = email
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  const { data: byEmail, error: e2 } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", forIlike)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!byEmail?.id) {
    console.warn(LOUD, {
      ...context,
      customerId: cid,
      email,
    });
    return null;
  }
  const userId = String(byEmail.id);
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: cid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (upErr) throw new Error(upErr.message);
  return userId;
}

/**
 * 1) subscription metadata (supabase_user_id or user_id)
 * 2) profiles by stripe customer id
 * 3) email + back-fill customer id
 */
export async function resolveUserIdForSubscription(
  admin: SupabaseClient,
  stripe: Stripe,
  sub: Stripe.Subscription,
  context: { eventId: string; eventType: string },
): Promise<string | null> {
  const fromMeta =
    sub.metadata?.supabase_user_id?.trim() || sub.metadata?.user_id?.trim() || "";
  if (fromMeta) return fromMeta;

  const cust =
    typeof sub.customer === "string"
      ? sub.customer
      : (sub.customer as Stripe.Customer | null | undefined)?.id ?? null;

  if (!cust) {
    console.warn(LOUD, {
      ...context,
      customerId: null,
      email: null,
    });
    return null;
  }
  return resolveUserIdByStripeCustomerId(
    admin,
    stripe,
    cust,
    context,
  );
}

/** Metadata / client reference first, then customer id + email back-fill. */
export async function resolveUserIdForCheckoutSession(
  admin: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  context: { eventId: string; eventType: string },
): Promise<string | null> {
  const fromSession =
    session.client_reference_id?.trim() ||
    session.metadata?.supabase_user_id?.trim() ||
    session.metadata?.user_id?.trim() ||
    "";
  if (fromSession) return fromSession;

  const cust =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  return resolveUserIdByStripeCustomerId(admin, stripe, cust, context);
}
