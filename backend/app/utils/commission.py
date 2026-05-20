"""Kademeli komisyon hesaplaması.

Dilimler (USD/birim üzerinden):
    0 - 5.000          → %4.0
    5.001 - 15.000     → %2.5
    15.001+            → %1.5

Aritmetik: her dilim sadece o dilim içine düşen tutara uygulanır (progressive).
Örn. $20.000 satış:
    İlk 5.000      × 0.040 = 200.00
    Sonraki 10.000 × 0.025 = 250.00
    Kalan  5.000   × 0.015 =  75.00
    Toplam komisyon = 525.00
    Net ödeme       = 19,475.00
"""
from __future__ import annotations

from decimal import Decimal

TIER_1_LIMIT = Decimal("5000")
TIER_2_LIMIT = Decimal("15000")

TIER_1_RATE = Decimal("0.040")
TIER_2_RATE = Decimal("0.025")
TIER_3_RATE = Decimal("0.015")


def compute_tiered_commission(amount: Decimal) -> tuple[Decimal, Decimal]:
    """Returns (commission_amount, net_payout). Negatif tutar 0 olarak ele alınır."""
    if amount is None or amount <= 0:
        return (Decimal("0.00"), Decimal("0.00"))

    commission = Decimal("0")
    remaining = amount

    # Dilim 1
    t1 = min(remaining, TIER_1_LIMIT)
    commission += t1 * TIER_1_RATE
    remaining -= t1

    # Dilim 2
    if remaining > 0:
        t2 = min(remaining, TIER_2_LIMIT - TIER_1_LIMIT)
        commission += t2 * TIER_2_RATE
        remaining -= t2

    # Dilim 3
    if remaining > 0:
        commission += remaining * TIER_3_RATE

    commission = commission.quantize(Decimal("0.01"))
    net = (amount - commission).quantize(Decimal("0.01"))
    return (commission, net)
