// Month fullness grid (S9 tail — the widest of the three zooms). The month
// is a calendar grid (Sunday-first weeks) where each cell carries the day's
// total ITEM COUNT — the same cheap chore fan-out the week silhouette uses,
// so a whole month costs ~35-42 rollups and needs no duration/scheduling
// data. The center "Month" tab renders this; tapping a cell opens that day.
import { blockFullness } from "./weekView.js";

// Local midnight for a Y/M/D.
function dayAt(year, month, day) {
  return new Date(year, month, day);
}

// The calendar grid covering the month that contains `date`: full Sunday->
// Saturday weeks, padded with the trailing/leading days of the neighbouring
// months (flagged `inMonth: false`). Each day carries its total item count.
export function monthFullness(data, date, ruleOpts) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = dayAt(year, month, 1);
  // Back up to the Sunday on/before the 1st.
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  // Last day of the month, then forward to the Saturday on/after it.
  const last = dayAt(year, month + 1, 0);
  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + (6 - last.getDay()));

  const cells = [];
  let max = 1;
  for (
    let d = new Date(gridStart);
    d <= gridEnd;
    d.setDate(d.getDate() + 1)
  ) {
    const dd = new Date(d);
    const total = blockFullness(data, dd, ruleOpts)
      .reduce((s, b) => s + b.count, 0);
    if (total > max) max = total;
    cells.push({ date: dd, total, inMonth: dd.getMonth() === month });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, max, monthDate: first };
}
