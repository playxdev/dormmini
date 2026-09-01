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

/** Period after "2025-09" -> "ตุลาคม 2568" */
export function nextPeriod(value) {
  const [year, month] = String(value ?? '').split('-').map(Number);
  if (!year || !month) return '';
  return month === 12
    ? period(`${year + 1}-01`)
    : period(`${year}-${String(month + 1).padStart(2, '0')}`);
}
