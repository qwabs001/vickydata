import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://vickydata.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/orders",
          "/profile",
          "/rewards",
          "/wallet",
          "/api"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
