import { http, HttpResponse, delay } from "msw";

const STRIPE_BASE_URL = "https://api.stripe.com";

// POST /v1/payment_intents - success
export const stripePaymentIntentSuccess = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return HttpResponse.json({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_xxx",
      status: "requires_payment_method",
      amount: 3000,
      currency: "eur",
    });
  }
);

// POST /v1/payment_intents - card declined (status 402)
export const stripePaymentIntentCardDeclined = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return HttpResponse.json(
      {
        error: {
          type: "card_error",
          code: "card_declined",
          message: "Your card was declined.",
        },
      },
      { status: 402 }
    );
  }
);

// POST /v1/payment_intents - insufficient funds (status 402)
export const stripePaymentIntentInsufficientFunds = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return HttpResponse.json(
      {
        error: {
          type: "card_error",
          code: "insufficient_funds",
          message: "Your card has insufficient funds.",
        },
      },
      { status: 402 }
    );
  }
);

// POST /v1/payment_intents - expired card (status 402)
export const stripePaymentIntentExpiredCard = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return HttpResponse.json(
      {
        error: {
          type: "card_error",
          code: "expired_card",
          message: "Your card has expired.",
        },
      },
      { status: 402 }
    );
  }
);

// POST /v1/payment_intents - invalid CVC (status 402)
export const stripePaymentIntentInvalidCVC = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return HttpResponse.json(
      {
        error: {
          type: "card_error",
          code: "incorrect_cvc",
          message: "Your card's security code is incorrect.",
        },
      },
      { status: 402 }
    );
  }
);

// POST /v1/payment_intents - network timeout (delays 5s, no response within timeout)
export const stripePaymentIntentNetworkTimeout = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  async () => {
    await delay(5000);
    return HttpResponse.json({ id: "pi_timeout" });
  }
);

// POST /v1/payment_intents - Stripe server error (status 500)
export const stripePaymentIntentServerError = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents`,
  () => {
    return new HttpResponse(null, { status: 500 });
  }
);

// GET /v1/payment_intents/:id - return mock existing payment intent
export const stripeGetPaymentIntent = http.get(
  `${STRIPE_BASE_URL}/v1/payment_intents/:id`,
  ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      client_secret: `${params.id}_secret_xxx`,
      status: "requires_payment_method",
      amount: 3000,
      currency: "eur",
    });
  }
);

// POST /v1/payment_intents/:id/confirm - return mock succeeded status
export const stripeConfirmPaymentIntent = http.post(
  `${STRIPE_BASE_URL}/v1/payment_intents/:id/confirm`,
  ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "succeeded",
      amount: 3000,
      currency: "eur",
    });
  }
);

// Default handlers (success cases) for use in test setup
export const stripeHandlers = [
  stripePaymentIntentSuccess,
  stripeGetPaymentIntent,
  stripeConfirmPaymentIntent,
];
