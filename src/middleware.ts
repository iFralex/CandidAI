
import { NextRequest, NextResponse } from "next/server";
import { authMiddleware, redirectToHome, redirectToLogin } from "next-firebase-auth-edge";
import { clientConfig, serverConfig } from "./config";
import { Path } from "next-firebase-auth-edge/next/middleware";

const PUBLIC_PATHS: Path = ['/register', '/login', "/", /^\/docs(\/.*)?$/];

export async function middleware(request: NextRequest) {
  // Add cookie for referral tracking
  const url = request.nextUrl.clone();
  const referralCode = url.searchParams.get('ref');

  if (referralCode) {
    const response = NextResponse.next();
    response.cookies.set('referral', referralCode, {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    return response;
  }

  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    cookieSerializeOptions: serverConfig.cookieSerializeOptions,
    serviceAccount: serverConfig.serviceAccount,
    handleValidToken: async ({ token, decodedToken }, headers) => {
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname.split("/")[1])) {
        console.log(PUBLIC_PATHS.includes(request.nextUrl.pathname.split("/")[1]))
        console.log(request.nextUrl.pathname.split("/")[1])
        // NON redirezionare se è la callback del login
        return NextResponse.next();
      }

      return NextResponse.next({
        request: {
          headers
        }
      });
    },
    handleInvalidToken: async (reason) => {
      console.info('Missing or malformed credentials', { reason });

      return redirectToLogin(request, {
        path: '/login',
        publicPaths: PUBLIC_PATHS
      });
    },
    handleError: async (error) => {
      console.error('Unhandled authentication error', { error });

      return redirectToLogin(request, {
        path: '/login',
        publicPaths: PUBLIC_PATHS
      });
    }
  });
}

export const config = {
  matcher: [
    "/dashboard",
    "/((?!_next|api|__\\/auth|.*\\.).*)",
    "/api/login",
    "/api/logout",
  ],
};