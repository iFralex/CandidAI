import { NextRequest, NextResponse } from "next/server";
import { authMiddleware, redirectToLogin } from "next-firebase-auth-edge";
import { clientConfig, serverConfig } from "./config";

const PUBLIC_PATHS = ['/register', '/login', "/"];

function applyCSP(response) {
  response.headers.set(
    "Content-Security-Policy",
    `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ecommerce.nexi.it https://xpay.nexi.it;
      connect-src 'self' https://ecommerce.nexi.it https://xpay.nexi.it;
      img-src 'self' data: https://ecommerce.nexi.it https://xpay.nexi.it;
      style-src 'self' 'unsafe-inline';

      frame-src 'self' https://3dserver.nexi.it https://ecommerce.nexi.it https://xpay.nexi.it;
      frame-ancestors 'self' https://3dserver.nexi.it https://ecommerce.nexi.it https://xpay.nexi.it;
    `.replace(/\n/g, " ").trim()
  );
}

export async function middleware(request) {

  const url = request.nextUrl.clone();

  const referralCode = url.searchParams.get('ref');
  if (referralCode) {
    const res = NextResponse.next();
    res.cookies.set('referral', referralCode, {
      expires: new Date(Date.now() + 30 * 24*60*60*1000),
    });
    applyCSP(res);
    return res;
  }

  const response = await authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    cookieSerializeOptions: serverConfig.cookieSerializeOptions,
    serviceAccount: serverConfig.serviceAccount,
    handleValidToken: async ({ token, decodedToken }, headers) => {
      const res = NextResponse.next({ request: { headers } });
      applyCSP(res);
      return res;
    },
    handleInvalidToken: async () => {
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
    handleError: async () => {
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
  });

  applyCSP(response);
  return response;
}

export const config = {
  matcher: [
    "/dashboard",
    "/((?!_next|api|__\\/auth|.*\\.).*)",
    "/api/login",
    "/api/logout",
  ],
};
