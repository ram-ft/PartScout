/** Packs needed to cover `qty` units from one listing, and what that costs. */
export function plan(offer, qty) {
  const need = Math.max(1, Math.floor(qty) || 1)
  const packs = Math.ceil(need / offer.packSize)
  const units = packs * offer.packSize
  return { packs, units, spare: units - need, cost: packs * offer.price }
}

/** Shipping for one shop's subtotal. Zero when switched off or above the free threshold. */
export function shipping(rule, subtotal, enabled = true) {
  if (!enabled || !rule) return 0
  return subtotal >= rule.freeAbove ? 0 : rule.flat
}
