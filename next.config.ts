import type { NextConfig } from "next";

const csp = `
  default-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
  img-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:;
  frame-ancestors https:;
`;

const nextConfig: NextConfig = {
  // Header globali
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp.replace(/\n/g, ' ')
          },
          {
            key: 'Permissions-Policy',
            value: 'payment=(self "https://acs.revolut.com")'
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
