import type { NextConfig } from "next";

// Aggiunti i domini Nexi (*.nexi.it) e le direttive necessarie
const csp = `
  default-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
  img-src 'self' https: data:;
  frame-ancestors
  'self'
  https://ecommerce.nexi.it
  https://int-ecommerce.nexi.it
  https://acs.nexi.it
  https://3dserver.nexi.it;
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://ecommerce.nexi.it
    https://int-ecommerce.nexi.it
    https://apis.google.com
    https://www.gstatic.com
    https://www.googletagmanager.com
    https://www.google-analytics.com;
  connect-src 'self'
    https://ecommerce.nexi.it
    https://int-ecommerce.nexi.it
    https://identitytoolkit.googleapis.com
    https://securetoken.googleapis.com
    https://firestore.googleapis.com
    https://www.googleapis.com
    https://firebaseinstallations.googleapis.com
    https://firebase-settings.crashlytics.com
    https://analytics.google.com
    https://www.google-analytics.com;
  frame-src 'self'
    https://ecommerce.nexi.it
    https://int-ecommerce.nexi.it
    https://acs.nexi.it
    https://apis.google.com;
`;


const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp.replace(/\n/g, ' ')
          },
          // Permissions-Policy è ok, ma assicurati che payment includa self
          {
            key: 'Permissions-Policy',
            value: 'payment=(self)'
          },
        ],
      },
    ];
  },

  // Config immagini remote
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'cdn.brandfetch.io' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'images.ctfassets.net' },
      { protocol: 'https', hostname: 'pngdownload.io' },
    ],
  },

  // Riscritture URL
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://candidai-1bda0.firebaseapp.com/__/auth/:path*',
      },
    ];
  },

  // ESLint e TypeScript
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
