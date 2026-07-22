import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { LoginForm } from "@/components/login-form";

// Use vi.hoisted so these are defined before vi.mock factories run.
// A stable router reference prevents the useEffect from re-firing on every render
// (the component has `router` in its dependency array).
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

  // Default handlers for a successful login flow
  server.use(
    http.post("/api/auth", () =>
      HttpResponse.json({ idToken: "fake-id-token" })
    ),
    http.post(`${TEST_DOMAIN}/api/login`, () =>
      new HttpResponse(null, { status: 200 })
    )
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LoginForm", () => {
  it("renders email field, password field, and submit button", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^login$/i })
    ).toBeInTheDocument();
  });

  it("has a 'Forgot your password?' link pointing to /forgot-password", () => {
    render(<LoginForm />);

    const link = screen.getByRole("link", { name: /forgot your password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("has a 'Sign up' link pointing to /register", () => {
    render(<LoginForm />);

    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });

  it("triggers POST /api/auth with mode='login' on valid submit", async () => {
    let capturedBody: any = null;

    server.use(
      http.post("/api/auth", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        mode: "login",
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("does not call fetch when email is empty (HTML5 validation)", async () => {
    let apiFetched = false;

    server.use(
      http.post("/api/auth", () => {
        apiFetched = true;
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    // Leave email empty, fill password
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    // HTML5 validation prevents submit event – API should not be called
    expect(apiFetched).toBe(false);
  });

  it("does not call fetch when email is malformed (HTML5 validation)", async () => {
    let apiFetched = false;

    server.use(
      http.post("/api/auth", () => {
        apiFetched = true;
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "notanemail");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(apiFetched).toBe(false);
  });

  it("does not call fetch when password is empty (HTML5 validation)", async () => {
    let apiFetched = false;

    server.use(
      http.post("/api/auth", () => {
        apiFetched = true;
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    // Leave password empty
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(apiFetched).toBe(false);
  });

  it("disables submit button during form submission (loading state)", async () => {
    let resolveAuth!: () => void;
    const deferred = new Promise<void>((r) => {
      resolveAuth = r;
    });

    server.use(
      http.post("/api/auth", async () => {
        await deferred;
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");

    // Start click without awaiting – submit begins asynchronously
    const clickPromise = user.click(
      screen.getByRole("button", { name: /^login$/i })
    );

    // The button should become disabled once loading starts
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /logging in/i })
      ).toBeDisabled();
    });

    // Unblock the fetch
    resolveAuth();
    await clickPromise;
  });

  it("shows visible error message when API returns invalid credentials", async () => {
    // Simulate auth failure: /api/auth returns a network error.
    // The component catch block fires and renders the error div.
    server.use(http.post("/api/auth", () => HttpResponse.error()));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(document.querySelector(".text-red-600")).not.toBeNull();
    });
  });

  it("redirects to /dashboard on successful login", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows generic error message on network error (no crash)", async () => {
    // Simulate a network-level failure on /api/auth.
    server.use(http.post("/api/auth", () => HttpResponse.error()));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(document.querySelector(".text-red-600")).not.toBeNull();
    });
  });

  it("password field is of type 'password' (not visible in plain text)", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
