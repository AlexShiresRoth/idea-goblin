import Stripe from "stripe";
import "server-only";

let client: Stripe | undefined;

// Created on first use so builds and tests don't need the key.
export function getStripe() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}
