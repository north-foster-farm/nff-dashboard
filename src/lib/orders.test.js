// Orders model helpers (Batch 29). Mostly small enum→label maps plus
// address/total/display plumbing, so these tests pin exact values —
// the sales chart and the Batch 30 Shippo pass-through both depend on
// the ids staying stable.
import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  FULFILLMENT_METHODS, fulfillmentLabel, saleChannelForOrder,
  PAYMENT_METHODS, paymentMethodLabel,
  EMPTY_ADDRESS, formatAddress, cleanAddress, stateAllowed,
  SHIPMENT_STATUSES, shipmentStatusLabel, parcelsSummary,
  orderTotalCents, orderCustomerName,
} from "./orders.js";

describe("order statuses", () => {
  it("pins the lifecycle ids and labels", () => {
    expect(ORDER_STATUSES).toEqual([
      { id: "open", label: "Open" },
      { id: "ready", label: "Ready" },
      { id: "fulfilled", label: "Fulfilled" },
      { id: "cancelled", label: "Cancelled" },
    ]);
  });
});

describe("fulfillment", () => {
  it("pins the method ids and labels", () => {
    expect(FULFILLMENT_METHODS).toEqual([
      { id: "pickup", label: "Farm pick-up" },
      { id: "delivery", label: "Delivery" },
      { id: "shipping", label: "Shipping" },
    ]);
  });

  it("fulfillmentLabel maps every id and echoes unknowns back", () => {
    expect(fulfillmentLabel("pickup")).toBe("Farm pick-up");
    expect(fulfillmentLabel("delivery")).toBe("Delivery");
    expect(fulfillmentLabel("shipping")).toBe("Shipping");
    expect(fulfillmentLabel("teleport")).toBe("teleport");
  });

  it("saleChannelForOrder maps each method to its sales channel", () => {
    expect(saleChannelForOrder("pickup")).toBe("farm_pickup");
    expect(saleChannelForOrder("delivery")).toBe("delivery");
    expect(saleChannelForOrder("shipping")).toBe("shipping");
  });

  it("saleChannelForOrder buckets anything unrecognized as 'other'", () => {
    expect(saleChannelForOrder("teleport")).toBe("other");
    expect(saleChannelForOrder("")).toBe("other");
    expect(saleChannelForOrder(null)).toBe("other");
    expect(saleChannelForOrder(undefined)).toBe("other");
  });
});

describe("payment", () => {
  it("pins the payment-method ids and labels", () => {
    expect(PAYMENT_METHODS).toEqual([
      { id: "cash", label: "Cash" },
      { id: "check", label: "Check" },
      { id: "venmo", label: "Venmo" },
      { id: "card", label: "Card" },
      { id: "other", label: "Other" },
    ]);
  });

  it("paymentMethodLabel maps every id and echoes unknowns back", () => {
    expect(paymentMethodLabel("cash")).toBe("Cash");
    expect(paymentMethodLabel("check")).toBe("Check");
    expect(paymentMethodLabel("venmo")).toBe("Venmo");
    expect(paymentMethodLabel("card")).toBe("Card");
    expect(paymentMethodLabel("other")).toBe("Other");
    expect(paymentMethodLabel("barter")).toBe("barter");
  });
});

describe("addresses", () => {
  // The Shippo-mirroring ship-to shape.
  function addr(over = {}) {
    return {
      name: "Ada Lovelace", street1: "12 Farm Rd", street2: "",
      city: "Foster", state: "RI", zip: "02825", phone: "555-0100",
      ...over,
    };
  }

  it("EMPTY_ADDRESS carries the seven Shippo fields, all blank", () => {
    expect(EMPTY_ADDRESS).toEqual({
      name: "", street1: "", street2: "", city: "", state: "",
      zip: "", phone: "",
    });
  });

  it("formatAddress renders display lines, gluing zip to the city " +
     "line without a comma", () => {
    expect(formatAddress(addr())).toEqual([
      "Ada Lovelace", "12 Farm Rd", "Foster, RI 02825",
    ]);
  });

  it("formatAddress keeps the comma when there's no zip and drops " +
     "blank lines (street2, phone never shown)", () => {
    expect(formatAddress(addr({ zip: "" }))).toEqual([
      "Ada Lovelace", "12 Farm Rd", "Foster, RI",
    ]);
    expect(formatAddress(addr({ street2: "Barn B" }))).toEqual([
      "Ada Lovelace", "12 Farm Rd", "Barn B", "Foster, RI 02825",
    ]);
  });

  it("formatAddress is null for no address or an all-blank one", () => {
    expect(formatAddress(null)).toBeNull();
    expect(formatAddress({ ...EMPTY_ADDRESS })).toBeNull();
  });

  it("cleanAddress trims every field and fills missing keys", () => {
    expect(cleanAddress({ name: " Ada ", city: "Foster" })).toEqual({
      name: "Ada", street1: "", street2: "", city: "Foster",
      state: "", zip: "", phone: "",
    });
  });

  it("cleanAddress drops keys outside the address shape", () => {
    const out = cleanAddress({ name: "Ada", email: "a@x.com" });
    expect(out).not.toHaveProperty("email");
  });

  it("cleanAddress is null when nothing was entered at all", () => {
    expect(cleanAddress(null)).toBeNull();
    expect(cleanAddress({})).toBeNull();
    expect(cleanAddress({ name: "   ", zip: "" })).toBeNull();
  });
});

describe("stateAllowed", () => {
  it("an empty or missing allowlist means not configured — allow", () => {
    expect(stateAllowed("RI", [])).toBe(true);
    expect(stateAllowed("RI", null)).toBe(true);
  });

  it("a blank ship-to state passes (nothing to check yet)", () => {
    expect(stateAllowed("", ["RI"])).toBe(true);
    expect(stateAllowed("   ", ["RI"])).toBe(true);
    expect(stateAllowed(null, ["RI"])).toBe(true);
  });

  it("matches case-insensitively and ignores whitespace on both " +
     "sides", () => {
    expect(stateAllowed("RI", ["RI", "MA"])).toBe(true);
    expect(stateAllowed(" ri ", ["RI"])).toBe(true);
    expect(stateAllowed("RI", [" ri "])).toBe(true);
  });

  it("flags a state not on the list", () => {
    expect(stateAllowed("FL", ["RI", "MA", "CT"])).toBe(false);
  });
});

describe("shipments", () => {
  it("pins the shipment-status ids and labels", () => {
    expect(SHIPMENT_STATUSES).toEqual([
      { id: "draft", label: "Draft" },
      { id: "label_purchased", label: "Label purchased" },
      { id: "shipped", label: "Shipped" },
      { id: "delivered", label: "Delivered" },
      { id: "cancelled", label: "Cancelled" },
    ]);
  });

  it("shipmentStatusLabel maps every id and echoes unknowns back", () => {
    expect(shipmentStatusLabel("draft")).toBe("Draft");
    expect(shipmentStatusLabel("label_purchased"))
      .toBe("Label purchased");
    expect(shipmentStatusLabel("shipped")).toBe("Shipped");
    expect(shipmentStatusLabel("delivered")).toBe("Delivered");
    expect(shipmentStatusLabel("cancelled")).toBe("Cancelled");
    expect(shipmentStatusLabel("lost")).toBe("lost");
  });

  it("parcelsSummary sums boxes, weight, and dry ice", () => {
    expect(parcelsSummary([{ weightLb: 24, dryIceLb: 5 }]))
      .toBe("1 box · 24 lb · 5 lb dry ice");
    expect(parcelsSummary([{ weightLb: 12 }, { weightLb: 12 }]))
      .toBe("2 boxes · 24 lb");
  });

  it("parcelsSummary omits zero weight/dry-ice parts and has a " +
     "no-parcels placeholder", () => {
    expect(parcelsSummary([{}])).toBe("1 box");
    expect(parcelsSummary([])).toBe("no parcels yet");
    expect(parcelsSummary(null)).toBe("no parcels yet");
  });
});

describe("orderTotalCents", () => {
  it("sums line totals plus the shipping charge", () => {
    const lines = [{ totalCents: 500 }, { totalCents: 250 }];
    expect(orderTotalCents(lines, 1500)).toBe(2250);
    expect(orderTotalCents(lines, null)).toBe(750);
  });

  it("treats missing lines and missing line totals as zero", () => {
    expect(orderTotalCents(null, null)).toBe(0);
    expect(orderTotalCents([{}, { totalCents: 100 }], 0)).toBe(100);
    expect(orderTotalCents(null, 900)).toBe(900);
  });
});

describe("orderCustomerName", () => {
  const byId = new Map([
    ["c1", { displayName: "Ada", name: "Ada L.", email: "a@x.com" }],
    ["c2", { name: "Bob" }],
    ["c3", { email: "carol@x.com" }],
  ]);

  it("prefers the linked customer's displayName, then name, then " +
     "email", () => {
    expect(orderCustomerName({ customerId: "c1" }, byId)).toBe("Ada");
    expect(orderCustomerName({ customerId: "c2" }, byId)).toBe("Bob");
    expect(orderCustomerName({ customerId: "c3" }, byId))
      .toBe("carol@x.com");
  });

  it("falls back to the walk-in name when the link doesn't resolve", () => {
    const order = { customerId: "gone", customerName: "Walk-in" };
    expect(orderCustomerName(order, byId)).toBe("Walk-in");
    expect(orderCustomerName(order, undefined)).toBe("Walk-in");
  });

  it("uses the walk-in name with no link, else the placeholder", () => {
    expect(orderCustomerName({ customerName: "Dee" }, byId)).toBe("Dee");
    expect(orderCustomerName({}, byId)).toBe("(no customer)");
  });
});
