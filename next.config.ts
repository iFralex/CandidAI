import type { NextConfig } from "next";


const nextConfig: NextConfig = {

  
  // Config immagini remote
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'cdn.brandfetch.io' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'images.ctfassets.net' },
      { protocol: 'https', hostname: 'pngdownload.io' },
      { protocol: 'https', hostname: 'vumbnail.com' },
    ],
  },

  // Redirect /logs → server Apache dei log (stesso host di SERVER_RUNNER_URL, senza porta e path)
  async redirects() {
    const raw = process.env.SERVER_RUNNER_URL ?? 'http://localhost';
    const { protocol, hostname } = new URL(raw);
    const logsBase = `${protocol}//${hostname}:8080`;
    return [
      { source: '/logs',        destination: logsBase,          permanent: false, basePath: false },
      { source: '/logs/:path*', destination: `${logsBase}/:path*`, permanent: false, basePath: false },
    ];
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
