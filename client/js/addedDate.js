// "Added today" and "added in the last N days" are counted in Saudi time (Asia/Riyadh),
// whatever the visitor's own clock or time zone is.

const SAUDI_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric',
});
const DAY_MS = 24 * 60 * 60 * 1000;

// The calendar day in Saudi Arabia as a whole number of days, so two days can be subtracted
function saudiDayNumber(date) {
  const parts = Object.fromEntries(SAUDI_DATE.formatToParts(date).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS;
}

// 0 = added today, 1 = yesterday, 2 = the day before... null when the date is missing or invalid
export function daysSinceAdded(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const added = new Date(createdAt);
  if (Number.isNaN(added.getTime())) return null;
  return saudiDayNumber(now) - saudiDayNumber(added);
}

export function isAddedToday(createdAt, now = new Date()) {
  return daysSinceAdded(createdAt, now) === 0;
}
