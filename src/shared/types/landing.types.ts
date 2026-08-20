export interface PopularBundleItem {
  id: string;
  title: string;
  description: string;
  priceRange: string;
  features: string[];
  ctaLabel: string;
  isFeatured?: boolean;
}

export interface LandingConfig {
  popularBundles: {
    enabled: boolean;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    buyNowUrl: string;
    items: PopularBundleItem[];
  };
}
