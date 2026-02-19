import type { LandingConfig } from "@/shared/types";

export const defaultLandingConfig: LandingConfig = {
  popularBundles: {
    enabled: true,
    title: "Need more Engagements?",
    subtitle: "Try our social media Marketing Services (SMM).",
    ctaText: "View All Plans",
    ctaUrl: "https://360promo.uk",
    buyNowUrl: "https://360promo.uk/#/dashboard",
    items: [
      {
        id: "tiktok-services",
        title: "TikTok Services",
        description: "Real Humans GEO - Nigeria, Ghana, South Africa. Get free views.",
        priceRange: "₵0.27 - ₵200",
        features: ["Views", "Likes", "Followers"],
        ctaLabel: "Buy Now",
        isFeatured: true
      },
      {
        id: "instagram-service",
        title: "Instagram Service",
        description: "Real Accounts",
        priceRange: "₵0.39 - ₵200",
        features: ["Views", "Likes", "Followers"],
        ctaLabel: "Buy Now"
      },
      {
        id: "youtube-service",
        title: "Youtube Service",
        description: "Organic Engagement",
        priceRange: "₵1.91 - ₵392.98",
        features: ["Views", "Likes", "Followers"],
        ctaLabel: "Buy Now"
      },
      {
        id: "facebook-services",
        title: "Facebook Services",
        description: "Safe Engagement",
        priceRange: "₵0.42 - ₵200",
        features: ["Views", "Likes", "Followers"],
        ctaLabel: "Buy Now"
      }
    ]
  }
};
