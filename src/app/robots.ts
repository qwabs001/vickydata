import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://keldatagh.com";

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
