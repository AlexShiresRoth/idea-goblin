import { ensureStripeCustomer } from "@/lib/api/billing";
import { getPlan } from "@/lib/api/credits";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { getSiteUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

// Starts a Hoard Lord subscription on Stripe's hosted checkout page.
export async function POST() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.id;
    if ((await getPlan(profileId)) === "pro") {
      return NextResponse.json(
        { error: "Already a Hoard Lord" },
        { status: 409 },
      );
    }

    const customer = await ensureStripeCustomer(session);
    const site = getSiteUrl();
    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: profileId,
      line_items: [
        { price: process.env.STRIPE_HOARD_LORD_PRICE_ID!, quantity: 1 },
      ],
      subscription_data: { metadata: { profileId } },
      allow_promotion_codes: true,
      // Syncs the plan before the board loads, in case the webhook is late.
      success_url: `${site}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/main`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 },
    );
  }
}
