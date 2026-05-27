// Server configuration for the Flask VPS backend.
// Auth is the user's Firebase ID token passed at call time; no shared secret here.
export const SERVER_URL =
  process.env.CANDID_AI_SERVER_URL ?? 'http://91.99.227.223:80';
