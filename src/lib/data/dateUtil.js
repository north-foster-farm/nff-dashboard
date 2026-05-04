// Format a JS Date as YYYY-MM-DD in the LOCAL timezone. Postgres `date`
// columns have no timezone, so we send/receive them as strings interpreted
// in the browser's local zone. Using toISOString() would silently shift
// midnight chores into the prior UTC day for anyone east of UTC.
export function toLocalDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
