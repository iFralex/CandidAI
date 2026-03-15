import { http, HttpResponse } from "msw";

const SIGN_IN_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

// POST signInWithPassword - success
export const signInSuccess = http.post(SIGN_IN_URL, () => {
  return HttpResponse.json({
    idToken: "fake_id_token",
    localId: "user123",
    email: "test@test.com",
    refreshToken: "fake_refresh",
  });
});

// POST signInWithPassword - wrong password (status 400)
export const signInWrongPassword = http.post(SIGN_IN_URL, () => {
  return HttpResponse.json(
    { error: { message: "INVALID_PASSWORD" } },
    { status: 400 }
  );
});

// POST signInWithPassword - user not found (status 400)
export const signInUserNotFound = http.post(SIGN_IN_URL, () => {
  return HttpResponse.json(
    { error: { message: "EMAIL_NOT_FOUND" } },
    { status: 400 }
  );
});

// POST signInWithPassword - account disabled (status 400)
export const signInAccountDisabled = http.post(SIGN_IN_URL, () => {
  return HttpResponse.json(
    { error: { message: "USER_DISABLED" } },
    { status: 400 }
  );
});

// POST signInWithPassword - too many attempts (status 400)
export const signInTooManyAttempts = http.post(SIGN_IN_URL, () => {
  return HttpResponse.json(
    { error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } },
    { status: 400 }
  );
});

// Default handlers for use in test setup
export const firebaseIdentityHandlers = [signInSuccess];
