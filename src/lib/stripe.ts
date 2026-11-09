import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

// Created on first use so builds don't need Stripe keys.
export function stripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}
