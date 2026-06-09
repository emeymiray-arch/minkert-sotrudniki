/** Расчёт цены процедуры: скидка только с основной услуги, ЗП = 18% от основы + доп. услуга. */
export function calcProcedurePricing(
  basePrice: number,
  discountPercent: number,
  extraCost: number,
) {
  const base = Math.max(0, Math.round(basePrice));
  const pct = Math.min(100, Math.max(0, Math.round(discountPercent)));
  const extra = Math.max(0, Math.round(extraCost));
  const discountAmount = Math.round((base * pct) / 100);
  const finalMain = base - discountAmount;
  const finalPrice = finalMain + extra;
  const masterSalary = Math.round(base * 0.18) + extra;
  const grossRevenue = base + extra;

  return {
    basePrice: base,
    discountPercent: pct,
    discountAmount,
    extraCost: extra,
    finalPrice,
    masterSalary,
    grossRevenue,
    cost: finalPrice,
  };
}
