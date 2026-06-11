export type ProcedureDiscountInput =
  | { mode: 'percent'; discountPercent: number }
  | { mode: 'amount'; discountAmount: number }
  | { mode: 'final'; finalMainPrice: number };

export function calcProcedurePricing(
  basePrice: number,
  discount: ProcedureDiscountInput,
  extraCost = 0,
) {
  const base = Math.max(0, Math.round(basePrice));
  const extra = Math.max(0, Math.round(extraCost));
  let discountAmount = 0;
  let discountPercent = 0;

  if (discount.mode === 'percent') {
    discountPercent = Math.min(100, Math.max(0, Math.round(discount.discountPercent)));
    discountAmount = Math.round((base * discountPercent) / 100);
  } else if (discount.mode === 'amount') {
    discountAmount = Math.min(base, Math.max(0, Math.round(discount.discountAmount)));
    discountPercent = base > 0 ? Math.round((discountAmount / base) * 100) : 0;
  } else {
    const finalMain = Math.min(base, Math.max(0, Math.round(discount.finalMainPrice)));
    discountAmount = base - finalMain;
    discountPercent = base > 0 ? Math.round((discountAmount / base) * 100) : 0;
  }

  const finalMain = base - discountAmount;
  const finalPrice = finalMain + extra;
  const masterSalary = Math.round(base * 0.18) + extra;

  return { basePrice: base, discountPercent, discountAmount, finalPrice, masterSalary, finalMain };
}
