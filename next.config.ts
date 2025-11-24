import type { NextConfig } from "next";

// Aggiunti i domini Nexi (*.nexi.it) e le direttive necessarie
const csp = `
  default-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
  img-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:;
  frame-ancestors https:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ecommerce.nexi.it https://int-ecommerce.nexi.it;
  connect-src 'self' https://ecommerce.nexi.it https://int-ecommerce.nexi.it;
  frame-src 'self' https://ecommerce.nexi.it https://int-ecommerce.nexi.it https://acs.nexi.it;
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
            value: 'payment=(self "https://acs.revolut.com")' // Aggiungi altri domini se necessario
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
