/**
 * Presentation helpers.
 *
 * The API sends money as integer satang and dates in the Gregorian calendar.
 * Both are converted to what a Thai tenant expects only here, so the wire
 * format stays unambiguous and a display change never needs a backend deploy.
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/** 525000 -> "5,250.00" */
export function baht(satang) {
  return (Number(satang ?? 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** "2025-09" -> "กันยายน 2568" */
export function period(value) {
  const [year, month] = String(value ?? '').split('-').map(Number);
  if (!year || !month) return '';
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

/** "2025-09-05" -> "5 ก.ย. 2568" */
export function shortDate(value) {
  const [year, month, day] = String(value ?? '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

/**
 * "2026-09-01T17:09:58.000Z" -> "2 ก.ย. 2569 00:09"
 *
 * The API stores and sends every timestamp in UTC, and a tenant reads them in
 * Bangkok. This used to slice the characters out of the string and print them
 * as they stood, so every time in the app was seven hours early and a payment
 * reported after 17:00 was dated to the previous day.
 *
 * Only this function converts. `shortDate` is given calendar dates — a due
 * date, a start date — which are days rather than instants and must not move
 * across a timezone.
 *
 * Both spellings arrive: ISO-8601 with a `T` and a `Z` from the current API,
 * and "YYYY-MM-DD HH:MM:SS" from rows the pre-XYZ schema wrote with SQLite's
 * `datetime('now')`. That one has no zone marker and is also UTC, so it is
 * given one rather than being read as local time.
 */
export function dateTime(value) {
  const raw = String(value ?? '').trim();
  // A timestamp, not a year and not a date. `new Date` is generous enough to
  // read "2026" as the first instant of that year, which would render a bare
  // year as a time somebody could act on.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) return '';

  const at = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw)
    ? raw
    : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return '';

  // The tenant's clock, not the server's and not the phone's: a bill is due on
  // the operator's calendar wherever the tenant happens to be reading it.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(at).reduce((out, p) => ({ ...out, [p.type]: p.value }), {});

  const date = shortDate(`${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`);
  return date ? `${date} ${parts.hour}:${parts.minute}` : '';
}

/** Period after "2025-09" -> "ตุลาคม 2568" */
export function nextPeriod(value) {
  const [year, month] = String(value ?? '').split('-').map(Number);
  if (!year || !month) return '';
  return month === 12
    ? period(`${year + 1}-01`)
    : period(`${year}-${String(month + 1).padStart(2, '0')}`);
}
