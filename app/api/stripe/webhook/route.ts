import { syncCustomerPlan } from "@/lib/api/billing";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Events that can change whether a customer has a paid subscription.
const PLAN_EVENTS = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function customerOf(event: Stripe.Event) {
  const object = event.data.object as { customer?: string | { id: string } };
  const customer = object.customer;
  return typeof customer === "string" ? customer : customer?.id;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error(error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!PLAN_EVENTS.has(event.type)) {
    return new Response(null, { status: 200 });
  }

  const customer = customerOf(event);
  if (!customer) {
    return new Response(null, { status: 200 });
  }

  try {
    await syncCustomerPlan(customer);
    return new Response(null, { status: 200 });
  } catch (error) {
    // A 500 makes Stripe retry the event later.
    console.error(error);
    return new Response("Failed to sync plan", { status: 500 });
  }
}
