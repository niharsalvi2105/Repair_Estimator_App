export function calculateBillingPayments(sellingPrice: number, downPaymentPercent: 0 | 50 | 60) {
  const totalCents = Math.round(Number(sellingPrice.toFixed(2)) * 100)
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0 || !Number.isSafeInteger(totalCents))
    throw new Error('Enter a valid nonnegative selling price within the supported amount range.')
  const downPaymentCents = Math.round(totalCents * (downPaymentPercent / 100))
  return {
    downPayment: downPaymentCents / 100,
    finalPayment: (totalCents - downPaymentCents) / 100,
  }
}
