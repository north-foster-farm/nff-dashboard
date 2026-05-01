export function computeStageCost(stage, feed) {
  if (!feed || !stage.consumption) return null;
  if (stage.consumption.type !== "metered") return null;
  if (stage.endDay == null) return null;
  const days = stage.endDay - stage.startDay;
  if (days <= 0) return null;
  if (stage.consumption.unit !== feed.costPerUnit.unit) return { unitMismatch: true };
  const totalAmount = stage.consumption.amount * days;
  const cost = totalAmount * feed.costPerUnit.amount;
  return { totalAmount, totalUnit: stage.consumption.unit, cost, days };
}
