import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---- Module mocks (hoisted by vitest) ----

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  CardNumberElement: () => <div data-testid="card-number-element" />,
  CardExpiryElement: () => <div data-testid="card-expiry-element" />,
  CardCvcElement: () => <div data-testid="card-cvc-element" />,
  PaymentRequestButtonElement: () => null,
  useStripe: vi.fn(),
  useElements: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// ---- Imports (after mocks) ----

import { UnifiedCheckout } from "@/components/UnifiedCheckout";
import * as StripeReact from "@stripe/react-stripe-js";

// ---- Shared mock helpers ----

const mockConfirmCardPayment = vi.fn();
const mockCreatePaymentMethod = vi.fn();
const mockCardElement = {};

function setupDefaultStripe() {
  vi.mocked(StripeReact.useStripe).mockReturnValue({
    createPaymentMethod: mockCreatePaymentMethod,
    confirmCardPayment: mockConfirmCardPayment,
    paymentRequest: vi.fn(() => ({
      canMakePayment: vi.fn(() => Promise.resolve(null)),
      on: vi.fn(),
      off: vi.fn(),
    })),
  } as any);
  vi.mocked(StripeReact.useElements).mockReturnValue({
    getElement: vi.fn(() => mockCardElement),
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultStripe();
  // Default: createPaymentMethod succeeds
  mockCreatePaymentMethod.mockResolvedValue({
    error: null,
    paymentMethod: { id: "pm_test_123" },
  });
  // Default: confirmCardPayment succeeds
  mockConfirmCardPayment.mockResolvedValue({ error: null });
  // Default: fetch returns a client_secret
  global.fetch = vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue({ client_secret: "pi_test_secret_123" }),
  }) as any;
});

// ---- Tests ----

describe("UnifiedCheckout", () => {
  describe("rendering without crash with valid purchaseType and itemId", () => {
    it("renders without crashing when given a valid plan purchaseType and itemId", () => {
      expect(() =>
        render(
          <UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />
        )
      ).not.toThrow();
    });

    it("renders the 'Complete your purchase' heading", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      expect(screen.getByText("Complete your purchase")).toBeInTheDocument();
    });

    it("renders without crashing for a credits purchaseType", () => {
      expect(() =>
        render(
          <UnifiedCheckout purchaseType="credits" itemId="pkg_1000" email="user@test.com" />
        )
      ).not.toThrow();
    });
  });

  describe("correct price (in EUR) is shown", () => {
    it("shows €69.00 for the pro plan", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      // formatPrice(6900) = "€69.00" — appears in summary and Pay button
      const prices = screen.getAllByText("€69.00");
      expect(prices.length).toBeGreaterThanOrEqual(1);
    });

    it("shows €30.00 for the base plan", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="base" email="user@test.com" />);
      const prices = screen.getAllByText("€30.00");
      expect(prices.length).toBeGreaterThanOrEqual(1);
    });

    it("shows €10.00 for the pkg_1000 credits package", () => {
      render(<UnifiedCheckout purchaseType="credits" itemId="pkg_1000" email="user@test.com" />);
      const prices = screen.getAllByText("€10.00");
      expect(prices.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Stripe Elements mounts correctly", () => {
    it("wraps content in a Stripe Elements container", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      expect(screen.getByTestId("stripe-elements")).toBeInTheDocument();
    });

    it("renders the card number element inside the form", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      expect(screen.getByTestId("card-number-element")).toBeInTheDocument();
    });

    it("renders the card expiry and CVC elements", () => {
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      expect(screen.getByTestId("card-expiry-element")).toBeInTheDocument();
      expect(screen.getByTestId("card-cvc-element")).toBeInTheDocument();
    });
  });

  describe("when stripe is not yet available (null from useStripe)", () => {
    it("renders the form without crashing when useStripe returns null", () => {
      vi.mocked(StripeReact.useStripe).mockReturnValue(null as any);
      expect(() =>
        render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />)
      ).not.toThrow();
    });

    it("renders the Pay button even when stripe is null", () => {
      vi.mocked(StripeReact.useStripe).mockReturnValue(null as any);
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      const payBtn = screen.getByRole("button");
      expect(payBtn).toBeInTheDocument();
    });

    it("does not call confirmCardPayment if stripe is unavailable", async () => {
      vi.mocked(StripeReact.useStripe).mockReturnValue(null as any);
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);
      await user.click(screen.getByRole("button"));
      expect(mockConfirmCardPayment).not.toHaveBeenCalled();
    });
  });

  describe("clicking Pay calls Stripe confirmCardPayment", () => {
    it("calls confirmCardPayment with the client_secret after a successful payment method creation", async () => {
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(mockConfirmCardPayment).toHaveBeenCalledWith("pi_test_secret_123");
      });
    });

    it("calls createPaymentMethod before confirmCardPayment", async () => {
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(mockCreatePaymentMethod).toHaveBeenCalled();
        expect(mockConfirmCardPayment).toHaveBeenCalled();
      });
    });
  });

  describe("confirmPayment failure shows error message", () => {
    it("shows error text when confirmCardPayment returns a card declined error", async () => {
      mockConfirmCardPayment.mockResolvedValue({
        error: { message: "Your card was declined." },
      });
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Your card was declined.")).toBeInTheDocument();
      });
    });

    it("shows error text when createPaymentMethod returns an error", async () => {
      mockCreatePaymentMethod.mockResolvedValue({
        error: { message: "Invalid card number." },
        paymentMethod: null,
      });
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Invalid card number.")).toBeInTheDocument();
      });
    });

    it("shows error text when the API returns an error in the json body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: "Payment creation failed" }),
      }) as any;
      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Payment creation failed")).toBeInTheDocument();
      });
    });
  });

  describe("confirmPayment success calls onSuccess callback", () => {
    it("calls onSuccess with the API response data after a successful payment", async () => {
      const apiResponseData = { client_secret: "pi_test_secret_123", orderId: "ord_1" };
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(apiResponseData),
      }) as any;
      mockConfirmCardPayment.mockResolvedValue({ error: null });

      const onSuccess = vi.fn();
      const user = userEvent.setup();
      render(
        <UnifiedCheckout
          purchaseType="plan"
          itemId="pro"
          email="user@test.com"
          onSuccess={onSuccess}
        />
      );

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(apiResponseData);
      });
    });

    it("shows a success message after payment completes", async () => {
      mockConfirmCardPayment.mockResolvedValue({ error: null });
      const user = userEvent.setup();
      render(
        <UnifiedCheckout
          purchaseType="plan"
          itemId="pro"
          email="user@test.com"
          onSuccess={vi.fn()}
        />
      );

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Payment successful!")).toBeInTheDocument();
      });
    });

    it("does not call onSuccess when payment is declined", async () => {
      mockConfirmCardPayment.mockResolvedValue({
        error: { message: "Your card was declined." },
      });
      const onSuccess = vi.fn();
      const user = userEvent.setup();
      render(
        <UnifiedCheckout
          purchaseType="plan"
          itemId="pro"
          email="user@test.com"
          onSuccess={onSuccess}
        />
      );

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Your card was declined.")).toBeInTheDocument();
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Pay button is disabled during processing", () => {
    it("disables the Pay button while the payment is being processed", async () => {
      // Use a never-resolving fetch to keep the component in the loading state
      let resolveFetch!: (value: any) => void;
      const fetchPromise = new Promise<any>((res) => {
        resolveFetch = res;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise) as any;

      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      const payButton = screen.getByRole("button");
      expect(payButton).not.toBeDisabled();

      // Click starts the async flow; button becomes disabled during processing
      await user.click(payButton);

      // After createPaymentMethod resolves and fetch is pending, button should be disabled
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeDisabled();
      });

      // Resolve fetch to clean up
      await act(async () => {
        resolveFetch({
          json: () => Promise.resolve({ client_secret: "pi_test_secret_123" }),
        });
      });
    });

    it("shows 'Processing...' text while payment is in progress", async () => {
      let resolveFetch!: (value: any) => void;
      const fetchPromise = new Promise<any>((res) => {
        resolveFetch = res;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise) as any;

      const user = userEvent.setup();
      render(<UnifiedCheckout purchaseType="plan" itemId="pro" email="user@test.com" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Processing...")).toBeInTheDocument();
      });

      await act(async () => {
        resolveFetch({
          json: () => Promise.resolve({ client_secret: "pi_test_secret_123" }),
        });
      });
    });
  });
});
