import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://candidai-1bda0.firebaseapp.com/__/auth/:path*',
      },
    ];
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
