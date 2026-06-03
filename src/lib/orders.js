// Pure helpers for the orders model (Batch 29).
//
// The order model (settled at the 2026-06-02 workshop):
//   - An order is a promise: nothing touches product_sales or
//     inventory until it's fulfilled (29.2). Cancelling an open order
//     costs nothing.
//   - Lifecycle: open → ready → fulfilled, plus cancelled. Edits are
//     allowed while open; fulfilled orders are frozen.
//   - Payment rides on the order as a paid flag + method; the live
//     payment APIs are Batch 30.
//   - Shipping orders carry a ship-to snapshot and (29.3) shipments
//     shaped after Shippo's object model.

// ── lifecycle ──────────────────────────────────────────────────────────
// Which timestamp column stamps each status is the hook's concern;
// these drive display + grouping.
export const ORDER_STATUSES = [
  { id: "open", label: "Open" },
  { id: "ready", label: "Ready" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "cancelled", label: "Cancelled" },
];

export function orderStatusLabel(status) {
  return ORDER_STATUSES.find(s => s.id === status)?.label ?? status;
}

// ── fulfillment ────────────────────────────────────────────────────────
export const FULFILLMENT_METHODS = [
  { id: "pickup", label: "Farm pick-up" },
  { id: "delivery", label: "Delivery" },
  { id: "shipping", label: "Shipping" },
];

export function fulfillmentLabel(method) {
  return FULFILLMENT_METHODS.find(m => m.id === method)?.label ?? method;
}

// The product_sales channel a fulfilled order's sales record under,
// derived from how the order goes out the door. Keeps the sales chart
// honest about where revenue came from (order rows also carry
// order_id, so order revenue stays separable from POS either way).
export function saleChannelForOrder(fulfillmentMethod) {
  switch (fulfillmentMethod) {
    case "pickup": return "farm_pickup";
    case "delivery": return "delivery";
    case "shipping": return "shipping";
    default: return "other";
  }
}

// ── payment ────────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "check", label: "Check" },
  { id: "venmo", label: "Venmo" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];

export function paymentMethodLabel(method) {
  return PAYMENT_METHODS.find(m => m.id === method)?.label ?? method;
}

// ── addresses ──────────────────────────────────────────────────────────
// The ship-to shape mirrors Shippo's address object so the Batch 30
// live integration is a field-for-field pass-through:
//   { name, street1, street2, city, state, zip, phone }

export function formatAddress(addr) {
  if (!addr) return null;
  const cityLine = [addr.city, addr.state, addr.zip]
    .filter(Boolean).join(", ").replace(/, (\d)/, " $1");
  const lines = [addr.name, addr.street1, addr.street2, cityLine]
    .map(s => (s ?? "").trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

// ── money ──────────────────────────────────────────────────────────────
// An order's total is its lines plus the shipping charge passed to the
// customer. Stored denormalized on orders.total_cents (the hook keeps
// it in sync on every line write); recomputed here for drafts.

export function orderTotalCents(lines, shippingCents) {
  const lineTotal = (lines ?? [])
    .reduce((a, l) => a + (l.totalCents ?? 0), 0);
  return lineTotal + (shippingCents ?? 0);
}

// ── display ────────────────────────────────────────────────────────────
// What an order row leads with: the linked customer's name, else the
// free-text walk-in name, else a placeholder.

export function orderCustomerName(order, customersById) {
  if (order.customerId) {
    const c = customersById?.get(order.customerId);
    if (c) return c.displayName ?? c.name ?? c.email;
  }
  return order.customerName ?? "(no customer)";
}
