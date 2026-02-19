export const MAX_RESELLER_QTY = 10;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isValidResellerQty(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= MAX_RESELLER_QTY;
}

export function calculateResellerOrderTotal(unitPrice: number, qty: number): number {
  return roundMoney(unitPrice * qty);
}

export function isInsufficientBalance(currentBalance: number, amount: number): boolean {
  return roundMoney(currentBalance) < roundMoney(amount);
}

export function buildIdempotencyKey(agentId: string, clientOrderId: string): string {
  return `${agentId}:${clientOrderId.trim()}`;
}
