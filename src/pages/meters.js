/**
 * Water and electricity readings, newest month first.
 *
 * The tenant's question is "why is the bill this size?", so each month shows
 * the two numbers the owner read off the meter and the difference between
 * them. The rate and the money live on the invoice; repeating them here would
 * be a second place to keep them right.
 */

import { period as thaiPeriod, dateTime } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

const KINDS = {
  water: {
    label: 'น้ำ',
    unit: 'หน่วย',
    tone: 'blue',
    icon: '<path d="M12 2s6 7.2 6 11a6 6 0 0 1-12 0c0-3.8 6-11 6-11Z"/>'
  },
  electric: {
    label: 'ไฟฟ้า',
    unit: 'หน่วย',
    tone: 'orange',
    icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>'
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function header(title, backView) {
  return `
    <header class="sub-header">
      <button class="sub-header__back" type="button" data-nav="${backView}" aria-label="ย้อนกลับ">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
      </button>
      <h1>${title}</h1>
    </header>`;
}

function readingRow(meter) {
  const kind = KINDS[meter.kind] ?? KINDS.water;
  return `
    <div class="meter-row">
      <span class="meter-row__icon meter-row__icon--${kind.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${kind.icon}</svg>
      </span>
      <span class="meter-row__text">
        <strong>${kind.label}</strong>
        <small>${meter.previous} → ${meter.current}</small>
      </span>
      <span class="meter-row__used">
        <strong>${meter.used}</strong>
        <small>${kind.unit}</small>
      </span>
    </div>`;
}

/** One card per month, both meters inside it — that is how a bill is read. */
function monthCard(monthPeriod, meters) {
  const readAt = meters.map((m) => m.recorded_at).sort().at(-1);
  return `
    <section class="card meter-card">
      <h2 class="meter-card__title">${thaiPeriod(monthPeriod)}</h2>
      ${meters.map(readingRow).join('')}
      ${readAt ? `<p class="meter-card__meta">จดเมื่อ ${dateTime(readAt)}</p>` : ''}
    </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{meters: object[]}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderMeters(root, { meters }, navigate) {
  const byPeriod = new Map();
  for (const meter of meters) {
    if (!byPeriod.has(meter.period)) byPeriod.set(meter.period, []);
    byPeriod.get(meter.period).push(meter);
  }

  const room = meters[0]?.room_number;
  const body = byPeriod.size > 0
    ? [...byPeriod.entries()].map(([p, rows]) => monthCard(p, rows)).join('')
    : `<p class="empty">ยังไม่มีการจดมิเตอร์<br><small>ตัวเลขจะขึ้นหลังผู้ดูแลหอเดินจดในรอบถัดไป</small></p>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('จดมิเตอร์', 'home')}
      <main class="sub-body">
        ${room ? `<p class="sub-note">ห้อง ${escapeHtml(room)}</p>` : ''}
        ${body}
      </main>
      ${navBar()}
    </div>`;

  bindNav(root, navigate);
}
