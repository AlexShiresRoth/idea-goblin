import { getStripeCustomerId } from "@/lib/api/billing";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { getSiteUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

// Stripe's customer portal, for changing the card or cancelling.
export async function POST() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = await getStripeCustomerId(session.user.id);
    if (!customer) {
      return NextResponse.json(
        { error: "No billing account yet" },
        { status: 404 },
      );
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${getSiteUrl()}/main`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to open billing" },
      { status: 500 },
    );
  }
}
