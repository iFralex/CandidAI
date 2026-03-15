import { http, HttpResponse } from "msw";

const SERVER_RUNNER_URL = "http://91.99.227.223:5000/run_module";

// POST /run_module - success (status 200)
export const runModuleSuccess = http.post(SERVER_RUNNER_URL, () => {
  return HttpResponse.json(
    { status: "queued", message: "Processing started" },
    { status: 200 }
  );
});

// POST /run_module - user not found (status 404)
export const runModuleUserNotFound = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 404 });
});

// POST /run_module - server unavailable (status 503)
export const runModuleServerUnavailable = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 503 });
});

// POST /run_module - missing user_id (status 400)
export const runModuleMissingUserId = http.post(SERVER_RUNNER_URL, () => {
  return new HttpResponse(null, { status: 400 });
});

// Default handlers for use in test setup
export const pythonServerHandlers = [runModuleSuccess];
