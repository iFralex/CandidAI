// Server configuration for the Flask VPS backend.
// Set CANDID_AI_SERVER_URL and CANDID_AI_SESSION_API_KEY as environment
// variables before running or building the app.
export const SERVER_URL =
  process.env.CANDID_AI_SERVER_URL ?? 'http://91.99.227.223:80';

export const SESSION_API_KEY =
  process.env.CANDID_AI_SESSION_API_KEY ?? process.env.SESSION_API_KEY ?? '';
