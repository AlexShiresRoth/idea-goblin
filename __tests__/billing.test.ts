import { ensureProfile } from "@/lib/api/profiles";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

const stripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  subscriptions: { list: vi.fn() },
}));

vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/api/profiles", () => ({ ensureProfile: vi.fn() }));

import { ensureStripeCustomer, syncCustomerPlan } from "@/lib/api/billing";

const profile = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  stripeCustomerId: null as string | null,
};

function subscriptions(...statuses: string[]) {
  stripe.subscriptions.list.mockResolvedValue({
    data: statuses.map((status) => ({ status })),
  });
}

describe("billing", () => {
  let update: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    update = mockQuery([]);
    vi.mocked(db.update).mockReturnValue(update as never);
  });

  describe("syncCustomerPlan", () => {
    it.each([["active"], ["trialing"], ["past_due"]])(
      "makes a %s subscriber a Hoard Lord",
      async (status) => {
        subscriptions("canceled", status);

        expect(await syncCustomerPlan("cus_1")).toBe("pro");
        expect(update.set).toHaveBeenCalledWith(
          expect.objectContaining({ plan: "pro" }),
        );
      },
    );

    it("drops a customer with no live subscription to free", async () => {
      subscriptions("canceled", "incomplete_expired");

      expect(await syncCustomerPlan("cus_1")).toBe("free");
      expect(update.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: "free" }),
      );
    });

    it("asks Stripe for every subscription the customer has", async () => {
      subscriptions();

      await syncCustomerPlan("cus_1");

      expect(stripe.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_1", status: "all" }),
      );
    });
  });

  describe("ensureStripeCustomer", () => {
    it("reuses a saved customer", async () => {
      vi.mocked(ensureProfile).mockResolvedValue({
        ...profile,
        stripeCustomerId: "cus_saved",
      } as never);

      expect(await ensureStripeCustomer(makeSession() as never)).toBe(
        "cus_saved",
      );
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates a customer once and saves it on the profile", async () => {
      vi.mocked(ensureProfile).mockResolvedValue(profile as never);
      stripe.customers.create.mockResolvedValue({ id: "cus_new" });

      expect(await ensureStripeCustomer(makeSession() as never)).toBe(
        "cus_new",
      );
      expect(stripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { profileId: "user-1" } }),
        { idempotencyKey: "customer-user-1" },
      );
      expect(update.set).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: "cus_new" }),
      );
    });
  });
});
