import { http, HttpResponse } from "msw";

const SERVER_RUNNER_URL = "http://91.99.227.223:80/start_emails_generation";

// POST /start_emails_generation - success (status 200)
export const startEmailsGenerationSuccess = http.post(SERVER_RUNNER_URL, () => {
  return HttpResponse.json(
    { status: "queued", message: "Processing started" },
    { status: 200 }
  );
});

// POST /start_emails_generation - user not found (status 404)
export const startEmailsGenerationUserNotFound = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 404 });
});

// POST /start_emails_generation - server unavailable (status 503)
export const startEmailsGenerationServerUnavailable = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 503 });
});

// POST /start_emails_generation - missing user_id (status 400)
export const startEmailsGenerationMissingUserId = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 400 });
});

// Default handlers for use in test setup
export const pythonServerHandlers = [startEmailsGenerationSuccess];
