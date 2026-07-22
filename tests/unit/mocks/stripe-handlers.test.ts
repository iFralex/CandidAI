import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../vitest.setup";
import {
  stripePaymentIntentSuccess,
  stripePaymentIntentCardDeclined,
  stripePaymentIntentInsufficientFunds,
  stripePaymentIntentExpiredCard,
  stripePaymentIntentInvalidCVC,
  stripePaymentIntentServerError,
  stripeGetPaymentIntent,
  stripeConfirmPaymentIntent,
} from "../../mocks/handlers/stripe";

const STRIPE_BASE_URL = "https://api.stripe.com";

async function postPaymentIntents(body: Record<string, unknown> = {}) {
  return fetch(`${STRIPE_BASE_URL}/v1/payment_intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Stripe MSW handlers", () => {
  describe("POST /v1/payment_intents - success", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentSuccess);
    });

    it("returns status 200", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(200);
    });

    it("returns id: pi_test_123", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.id).toBe("pi_test_123");
    });

    it("returns client_secret: pi_test_123_secret_xxx", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.client_secret).toBe("pi_test_123_secret_xxx");
    });

    it("returns status: requires_payment_method", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.status).toBe("requires_payment_method");
    });

    it("returns amount: 3000 and currency: eur", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.amount).toBe(3000);
      expect(data.currency).toBe("eur");
    });
  });

  describe("POST /v1/payment_intents - card declined", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentCardDeclined);
    });

    it("returns status 402", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(402);
    });

    it("returns error type card_error", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.type).toBe("card_error");
    });

    it("returns error code card_declined", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.code).toBe("card_declined");
    });

    it("returns error message 'Your card was declined.'", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.message).toBe("Your card was declined.");
    });
  });

  describe("POST /v1/payment_intents - insufficient funds", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentInsufficientFunds);
    });

    it("returns status 402", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(402);
    });

    it("returns error code insufficient_funds", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.code).toBe("insufficient_funds");
    });

    it("returns error type card_error", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.type).toBe("card_error");
    });
  });

  describe("POST /v1/payment_intents - expired card", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentExpiredCard);
    });

    it("returns status 402", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(402);
    });

    it("returns error code expired_card", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.code).toBe("expired_card");
    });

    it("returns error type card_error", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.type).toBe("card_error");
    });
  });

  describe("POST /v1/payment_intents - invalid CVC", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentInvalidCVC);
    });

    it("returns status 402", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(402);
    });

    it("returns error code incorrect_cvc", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.code).toBe("incorrect_cvc");
    });

    it("returns error type card_error", async () => {
      const res = await postPaymentIntents();
      const data = await res.json();
      expect(data.error.type).toBe("card_error");
    });
  });

  describe("POST /v1/payment_intents - Stripe server error", () => {
    beforeEach(() => {
      server.use(stripePaymentIntentServerError);
    });

    it("returns status 500", async () => {
      const res = await postPaymentIntents();
      expect(res.status).toBe(500);
    });
  });

  describe("GET /v1/payment_intents/:id", () => {
    beforeEach(() => {
      server.use(stripeGetPaymentIntent);
    });

    it("returns the payment intent with the correct id", async () => {
      const res = await fetch(`${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123`);
      const data = await res.json();
      expect(data.id).toBe("pi_test_123");
    });

    it("returns status 200", async () => {
      const res = await fetch(`${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123`);
      expect(res.status).toBe(200);
    });

    it("returns client_secret derived from id", async () => {
      const res = await fetch(`${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123`);
      const data = await res.json();
      expect(data.client_secret).toBe("pi_test_123_secret_xxx");
    });

    it("returns status: requires_payment_method", async () => {
      const res = await fetch(`${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123`);
      const data = await res.json();
      expect(data.status).toBe("requires_payment_method");
    });

    it("returns amount: 3000 and currency: eur", async () => {
      const res = await fetch(`${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123`);
      const data = await res.json();
      expect(data.amount).toBe(3000);
      expect(data.currency).toBe("eur");
    });
  });

  describe("POST /v1/payment_intents/:id/confirm", () => {
    beforeEach(() => {
      server.use(stripeConfirmPaymentIntent);
    });

    it("returns status 200", async () => {
      const res = await fetch(
        `${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123/confirm`,
        { method: "POST" }
      );
      expect(res.status).toBe(200);
    });

    it("returns the payment intent id", async () => {
      const res = await fetch(
        `${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      expect(data.id).toBe("pi_test_123");
    });

    it("returns status: succeeded", async () => {
      const res = await fetch(
        `${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      expect(data.status).toBe("succeeded");
    });

    it("returns amount: 3000 and currency: eur", async () => {
      const res = await fetch(
        `${STRIPE_BASE_URL}/v1/payment_intents/pi_test_123/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      expect(data.amount).toBe(3000);
      expect(data.currency).toBe("eur");
    });
  });
});
