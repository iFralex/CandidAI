import type { MetadataRoute } from "next";

const BASE_URL = "https://candidai.tech";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/analytics",
          "/analytics/",
          "/verify/",
          "/desktop-login",
          "/forgot-password",
          "/__/auth/",
          "/logs",
          "/log",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
