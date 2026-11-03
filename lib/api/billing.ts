import type { Plan } from "@/lib/constants";
import type { Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import "server-only";
import type Stripe from "stripe";
import { db } from "../db";
import { profileTable } from "../db/schema";
import { getStripe } from "../stripe";
import { ensureProfile } from "./profiles";

// past_due keeps the plan while Stripe retries the card.
const PAID_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

// The user's Stripe customer, created and saved on their first checkout.
export async function ensureStripeCustomer(session: Session) {
  const profile = await ensureProfile(session);
  if (profile.stripeCustomerId) return profile.stripeCustomerId;

  const customer = await getStripe().customers.create(
    {
      email: profile.email,
      name: profile.name,
      metadata: { profileId: profile.id },
    },
    // A double click reuses the same customer instead of making two.
    { idempotencyKey: `customer-${profile.id}` },
  );
  await db
    .update(profileTable)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(profileTable.id, profile.id));
  return customer.id;
}

export async function getStripeCustomerId(profileId: string) {
  const [profile] = await db
    .select({ customerId: profileTable.stripeCustomerId })
    .from(profileTable)
    .where(eq(profileTable.id, profileId));
  return profile?.customerId ?? null;
}

// Reads the customer's subscriptions from Stripe rather than trusting one
// event, so out-of-order or duplicate webhooks still land on the right plan.
export async function syncCustomerPlan(customerId: string): Promise<Plan> {
  const subscriptions = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  const plan: Plan = subscriptions.data.some((subscription) =>
    PAID_STATUSES.has(subscription.status),
  )
    ? "pro"
    : "free";

  await db
    .update(profileTable)
    .set({ plan, updatedAt: new Date() })
    .where(eq(profileTable.stripeCustomerId, customerId));
  return plan;
}
