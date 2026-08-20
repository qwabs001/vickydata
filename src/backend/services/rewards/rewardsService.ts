export interface RewardsConfig {
  rewardPercentage: number;
  isActive: boolean;
  minPurchaseAmount: number;
  maxRewardPerOrder?: number | null;
}

export const rewardsService = {
  calculateReward(orderAmount: number, config: RewardsConfig) {
    if (!config.isActive) return 0;
    if (orderAmount < config.minPurchaseAmount) return 0;

    let reward = orderAmount * (config.rewardPercentage / 100);

    if (config.maxRewardPerOrder && reward > config.maxRewardPerOrder) {
      reward = config.maxRewardPerOrder;
    }

    return Math.round(reward * 100) / 100;
  }
};
