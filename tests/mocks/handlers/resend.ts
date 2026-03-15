import { http, HttpResponse } from "msw";

const RESEND_BASE_URL = "https://api.resend.com";

// POST /emails - success
export const resendEmailSuccess = http.post(
  `${RESEND_BASE_URL}/emails`,
  () => {
    return HttpResponse.json({ id: "re_fake_123" }, { status: 200 });
  }
);

// POST /emails - rate limit (status 429)
export const resendEmailRateLimit = http.post(
  `${RESEND_BASE_URL}/emails`,
  () => {
    return new HttpResponse(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
);

// POST /emails - invalid API key (status 403)
export const resendEmailInvalidApiKey = http.post(
  `${RESEND_BASE_URL}/emails`,
  () => {
    return new HttpResponse(null, { status: 403 });
  }
);

// POST /emails - invalid email (status 422)
export const resendEmailInvalidEmail = http.post(
  `${RESEND_BASE_URL}/emails`,
  () => {
    return HttpResponse.json(
      { error: "Invalid email address" },
      { status: 422 }
    );
  }
);

// POST /emails - server error (status 500)
export const resendEmailServerError = http.post(
  `${RESEND_BASE_URL}/emails`,
  () => {
    return new HttpResponse(null, { status: 500 });
  }
);

// Default handlers (success cases) for use in test setup
export const resendHandlers = [resendEmailSuccess];
