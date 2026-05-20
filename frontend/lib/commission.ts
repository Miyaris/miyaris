/**
 * Tiered (kademeli) komisyon hesabı — backend `app/utils/commission.py` ile
 * birebir aynı dilim eşikleri ve oranları.
 *
 * Dilimler (USD):
 *   0 - 5,000        → 4.0%
 *   5,001 - 15,000   → 2.5%
 *   15,001+          → 1.5%
 */
export const TIER_1_LIMIT = 5_000;
export const TIER_2_LIMIT = 15_000;
export const TIER_1_RATE = 0.04;
export const TIER_2_RATE = 0.025;
export const TIER_3_RATE = 0.015;

export interface CommissionResult {
  amount: number;
  commission: number;
  net: number;
  /** Komisyonun fiyata oranı — UI'da "ortalama oran: %X" göstermek için */
  effectiveRate: number;
}

export function computeTieredCommission(rawAmount: number | string): CommissionResult {
  const amount = typeof rawAmount === "string" ? parseFloat(rawAmount) : rawAmount;
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return { amount: 0, commission: 0, net: 0, effectiveRate: 0 };
  }

  let commission = 0;
  let remaining = amount;

  // Dilim 1
  const t1 = Math.min(remaining, TIER_1_LIMIT);
  commission += t1 * TIER_1_RATE;
  remaining -= t1;

  // Dilim 2
  if (remaining > 0) {
    const t2 = Math.min(remaining, TIER_2_LIMIT - TIER_1_LIMIT);
    commission += t2 * TIER_2_RATE;
    remaining -= t2;
  }

  // Dilim 3
  if (remaining > 0) {
    commission += remaining * TIER_3_RATE;
  }

  // İki ondalık hassasiyetle yuvarla
  commission = Math.round(commission * 100) / 100;
  const net = Math.round((amount - commission) * 100) / 100;
  const effectiveRate = commission / amount;

  return { amount, commission, net, effectiveRate };
}
