import { defaultLandingConfig } from "@/shared/constants/landingConfig";
import type { LandingConfig } from "@/shared/types";

export const mergeLandingConfig = (
  input?: Partial<LandingConfig> | null
): LandingConfig => {
  const parsed = input ?? {};
  const items = parsed.popularBundles?.items?.length
    ? parsed.popularBundles.items.map((item, index) => ({
        ...defaultLandingConfig.popularBundles.items[index],
        ...item,
        features:
          item.features?.length
            ? item.features
            : defaultLandingConfig.popularBundles.items[index]?.features ?? []
      }))
    : defaultLandingConfig.popularBundles.items;

  return {
    ...defaultLandingConfig,
    ...parsed,
    popularBundles: {
      ...defaultLandingConfig.popularBundles,
      ...parsed.popularBundles,
      items
    }
  };
};
