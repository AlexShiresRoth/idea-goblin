// @vitest-environment node
import { getStripeCustomerId, syncCustomerPlan } from "@/lib/api/billing";
import { getPlan } from "@/lib/api/credits";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession } from "./helpers";

const stripe = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));

vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe }));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/site", () => ({ getSiteUrl: () => "https://goblin.test" }));
vi.mock("@/lib/api/credits", () => ({ getPlan: vi.fn() }));
vi.mock("@/lib/api/billing", () => ({
  ensureStripeCustomer: vi.fn().mockResolvedValue("cus_1"),
  getStripeCustomerId: vi.fn(),
  syncCustomerPlan: vi.fn(),
}));

import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as portal } from "@/app/api/stripe/portal/route";
import { GET as success } from "@/app/api/stripe/success/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";

const session = makeSession();

function webhookRequest(signature: string | null = "sig") {
  return new Request("https://goblin.test/api/stripe/webhook", {
    method: "POST",
    body: "{}",
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("Stripe routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(AuthGuard).mockResolvedValue(session as never);
  });

  describe("webhook", () => {
    it("rejects a request without a signature", async () => {
      expect((await webhook(webhookRequest(null))).status).toBe(400);
    });

    it("rejects a bad signature", async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("No signatures found");
      });

      expect((await webhook(webhookRequest())).status).toBe(400);
      expect(syncCustomerPlan).not.toHaveBeenCalled();
    });

    it("syncs the customer's plan on a subscription change", async () => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type: "customer.subscription.deleted",
        data: { object: { customer: "cus_1" } },
      });

      expect((await webhook(webhookRequest())).status).toBe(200);
      expect(syncCustomerPlan).toHaveBeenCalledWith("cus_1");
    });

    it("ignores events that can't change the plan", async () => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type: "invoice.created",
        data: { object: { customer: "cus_1" } },
      });

      expect((await webhook(webhookRequest())).status).toBe(200);
      expect(syncCustomerPlan).not.toHaveBeenCalled();
    });

    it("asks Stripe to retry when the sync fails", async () => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: { object: { customer: { id: "cus_1" } } },
      });
      vi.mocked(syncCustomerPlan).mockRejectedValue(new Error("db down"));

      expect((await webhook(webhookRequest())).status).toBe(500);
    });
  });

  describe("checkout", () => {
    it("needs a signed-in user", async () => {
      vi.mocked(AuthGuard).mockResolvedValue(null);
      expect((await checkout()).status).toBe(401);
    });

    it("turns away someone who is already a Hoard Lord", async () => {
      vi.mocked(getPlan).mockResolvedValue("pro");

      expect((await checkout()).status).toBe(409);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("starts a subscription checkout for the user's customer", async () => {
      vi.mocked(getPlan).mockResolvedValue("free");
      stripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.test/c/1",
      });

      const response = await checkout();

      expect(await response.json()).toEqual({
        url: "https://checkout.stripe.test/c/1",
      });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_1",
          client_reference_id: session.user.id,
          success_url:
            "https://goblin.test/api/stripe/success?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "https://goblin.test/main",
        }),
      );
    });
  });

  describe("success", () => {
    function returnFromCheckout() {
      return success(
        new Request("https://goblin.test/api/stripe/success?session_id=cs_1"),
      );
    }

    it("syncs the plan, then lands on the board with a welcome", async () => {
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        client_reference_id: session.user.id,
        customer: "cus_1",
      });

      const response = await returnFromCheckout();

      expect(syncCustomerPlan).toHaveBeenCalledWith("cus_1");
      expect(response.headers.get("location")).toBe(
        "https://goblin.test/main?upgraded=1",
      );
    });

    it("won't sync someone else's checkout", async () => {
      stripe.checkout.sessions.retrieve.mockResolvedValue({
        client_reference_id: "someone-else",
        customer: "cus_2",
      });

      const response = await returnFromCheckout();

      expect(syncCustomerPlan).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe("https://goblin.test/main");
    });
  });

  describe("portal", () => {
    it("needs a billing account first", async () => {
      vi.mocked(getStripeCustomerId).mockResolvedValue(null);
      expect((await portal()).status).toBe(404);
    });

    it("opens the portal for the user's customer", async () => {
      vi.mocked(getStripeCustomerId).mockResolvedValue("cus_1");
      stripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.test/p/1",
      });

      expect(await (await portal()).json()).toEqual({
        url: "https://billing.stripe.test/p/1",
      });
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_1",
        return_url: "https://goblin.test/main",
      });
    });
  });
});
