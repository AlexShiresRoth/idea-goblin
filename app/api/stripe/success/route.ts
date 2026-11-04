import { syncCustomerPlan } from "@/lib/api/billing";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { getSiteUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

// Where checkout returns. Syncing here means the board already shows the new
// plan; if it fails, the webhook still catches up.
export async function GET(request: Request) {
  const board = `${getSiteUrl()}/main`;
  const sessionId = new URL(request.url).searchParams.get("session_id");

  try {
    const session = await AuthGuard();
    if (!session || !sessionId) return NextResponse.redirect(board);

    const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
    const customer =
      typeof checkout.customer === "string"
        ? checkout.customer
        : checkout.customer?.id;
    if (checkout.client_reference_id !== session.user.id || !customer) {
      return NextResponse.redirect(board);
    }

    await syncCustomerPlan(customer);
  } catch (error) {
    console.error(error);
  }

  return NextResponse.redirect(`${board}?upgraded=1`);
}
