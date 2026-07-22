import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { RegisterForm } from "@/components/login-form";

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

  // Default handlers for a successful registration flow
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

describe("RegisterForm", () => {
  it("renders name, email, password fields, and submit button", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^create account$/i })
    ).toBeInTheDocument();
  });

  it("triggers POST /api/auth with mode='register', name, email, password on valid submit", async () => {
    let capturedBody: any = null;

    server.use(
      http.post("/api/auth", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/^email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        mode: "register",
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      });
    });
  });

  it("does not call fetch when name is empty (HTML5 validation)", async () => {
    let apiFetched = false;

    server.use(
      http.post("/api/auth", () => {
        apiFetched = true;
        return HttpResponse.json({ idToken: "fake-id-token" });
      })
    );

    const user = userEvent.setup();
    render(<RegisterForm />);

    // Leave name empty, fill the rest
    await user.type(screen.getByLabelText(/^email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    // HTML5 required validation prevents submit – API should not be called
    expect(apiFetched).toBe(false);
  });

  it("shows visible error message when API returns existing email error", async () => {
    server.use(
      http.post("/api/auth", () =>
        HttpResponse.json({ error: "Email already in use" }, { status: 400 })
      )
    );

    // The component tries to read idToken from the response and then call internLogin.
    // When internLogin fails (the /api/login call will fail since no idToken), the catch
    // block sets the error. We simulate this by returning an error response and having
    // the next fetch fail as well.
    server.use(
      http.post(`${TEST_DOMAIN}/api/login`, () =>
        new HttpResponse(null, { status: 401 })
      )
    );

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/^email$/i), "existing@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(document.querySelector(".text-red-600")).not.toBeNull();
    });
  });

  it("password field enforces minimum length of 6 via HTML5 minLength attribute", () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute("minLength", "6");
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
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/^email$/i), "notanemail");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    // HTML5 email validation prevents submit – API should not be called
    expect(apiFetched).toBe(false);
  });

  it("redirects to /dashboard on successful registration", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/^email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
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
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/^email$/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");

    // Start click without awaiting – submit begins asynchronously
    const clickPromise = user.click(
      screen.getByRole("button", { name: /^create account$/i })
    );

    // The button should become disabled once loading starts
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /creating account/i })
      ).toBeDisabled();
    });

    // Unblock the fetch
    resolveAuth();
    await clickPromise;
  });
});
