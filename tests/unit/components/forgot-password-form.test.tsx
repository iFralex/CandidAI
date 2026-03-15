import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { ForgotPasswordForm } from "@/components/login-form";

const { mockPush, mockRouter } = vi.hoisted(() => {
  const mockPush = vi.fn();
  return { mockPush, mockRouter: { push: mockPush } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("firebase/auth", () => ({
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signInWithRedirect: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({
    addScope: vi.fn(),
  })),
  getAuth: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  useDeviceLanguage: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  auth: { name: "mock-auth" },
  db: { name: "mock-db" },
  default: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const TEST_DOMAIN = "http://localhost:3000";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DOMAIN", TEST_DOMAIN);
  mockPush.mockClear();

  // Default handler: successful forgot-password
  server.use(
    http.post(`${TEST_DOMAIN}/api/auth/forgot-password`, () =>
      HttpResponse.json({ link: "https://example.com/reset" }, { status: 200 })
    )
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ForgotPasswordForm", () => {
  it("renders email field and 'Send reset link' button", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("triggers POST /api/auth/forgot-password with valid email on submit", async () => {
    let capturedBody: any = null;

    server.use(
      http.post(`${TEST_DOMAIN}/api/auth/forgot-password`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ link: "https://example.com/reset" }, { status: 200 });
      })
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({ email: "user@example.com" });
    });
  });

  it("shows 'Email sent' success message after successful submit", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/password reset email sent/i)).toBeInTheDocument();
    });
  });

  it("shows 'Email not found' error message when API returns 404", async () => {
    server.use(
      http.post(`${TEST_DOMAIN}/api/auth/forgot-password`, () =>
        HttpResponse.json({ error: "Email not found" }, { status: 404 })
      )
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/email not found/i)).toBeInTheDocument();
    });
  });

  it("does not call API when email is empty (HTML5 required validation)", async () => {
    let apiFetched = false;

    server.use(
      http.post(`${TEST_DOMAIN}/api/auth/forgot-password`, () => {
        apiFetched = true;
        return HttpResponse.json({ link: "https://example.com/reset" });
      })
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    // Leave email empty, click submit
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    // HTML5 required validation prevents submit – API should not be called
    expect(apiFetched).toBe(false);
  });

  it("disables button and shows 'Sending...' during form submission (loading state)", async () => {
    let resolveRequest!: () => void;
    const deferred = new Promise<void>((r) => {
      resolveRequest = r;
    });

    server.use(
      http.post(`${TEST_DOMAIN}/api/auth/forgot-password`, async () => {
        await deferred;
        return HttpResponse.json({ link: "https://example.com/reset" });
      })
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");

    // Start click without awaiting – submit begins asynchronously
    const clickPromise = user.click(
      screen.getByRole("button", { name: /send reset link/i })
    );

    // The button should become disabled and show "Sending..." once loading starts
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });

    // Unblock the fetch
    resolveRequest();
    await clickPromise;
  });
});
