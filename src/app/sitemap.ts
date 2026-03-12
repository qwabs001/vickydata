import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://bundlearena.com").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${SITE_URL}/offers`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: `${SITE_URL}/buy-now`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${SITE_URL}/signin`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    }
  ];
}
