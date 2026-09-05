/**
 * Authenticated home screen.
 *
 * Identity, the outstanding balance, and the four things a tenant comes here
 * to do. Every tile leads somewhere: a tile that cannot be tapped teaches the
 * tenant to stop looking at the grid.
 */

import { baht, shortDate } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

const TILES = [
  { tone: 'blue', title: 'บิลค่าเช่า', subtitle: 'ยอดค้างและประวัติ', view: 'bills', icon: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>' },
  { tone: 'orange', title: 'แจ้งซ่อม', subtitle: 'ติดตามสถานะ', view: 'repairs', icon: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>' },
  { tone: 'green', title: 'จดมิเตอร์', subtitle: 'น้ำ/ไฟ ย้อนหลัง', view: 'meters', icon: '<path d="M4 4h16v16H4V4Zm3 3v4h4V7H7Zm6 0v4h4V7h-4Zm-6 6v4h4v-4H7Zm6 0v4h4v-4h-4Z"/>' },
  { tone: 'red', title: 'ประกาศ', subtitle: 'ข่าวสารจากหอ', view: 'announcements', icon: '<path d="M3 10v4h3l6 4V6L6 10H3Zm14.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/>' }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function avatar(profile) {
  if (profile.pictureUrl) {
    return `<img class="identity__avatar" src="${escapeHtml(profile.pictureUrl)}" alt="" width="72" height="72">`;
  }
  return `<span class="identity__avatar identity__avatar--empty">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2.2-7 5v1h14v-1c0-2.8-3-5-7-5Z"/></svg>
    </span>`;
}

function tile(item, unread) {
  // The count sits on the tile rather than on the tab bar: announcements are
  // reached from here, and a badge on a bar item that leads elsewhere would
  // point at the wrong thing.
  const badge = item.view === 'announcements' && unread > 0
    ? `<span class="tile__badge" aria-label="ประกาศใหม่ ${unread} รายการ">${unread}</span>`
    : '';

  return `
    <button class="tile" type="button" data-nav="${item.view}">
      <span class="tile__icon tile__icon--${item.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      </span>
      ${badge}
      <strong class="tile__title">${item.title}</strong>
      <small class="tile__subtitle">${item.subtitle}</small>
    </button>`;
}

/**
 * The balance card only appears when something is owed. An empty card reading
 * "0.00" would give a settled tenant a bill-shaped thing to worry about.
 */
function balanceCard(outstandingSatang, nextDueDate) {
  if (!outstandingSatang || outstandingSatang <= 0) {
    return `
      <section class="balance balance--clear">
        <p class="balance__label">ไม่มียอดค้างชำระ</p>
        <p class="balance__note">ขอบคุณที่ชำระตรงเวลา</p>
      </section>`;
  }

  return `
    <section class="balance">
      <div class="balance__text">
        <p class="balance__label">ยอดค้างชำระ</p>
        <p class="balance__amount">${baht(outstandingSatang)} <span>บาท</span></p>
        ${nextDueDate ? `<p class="balance__meta">กำหนดชำระ ${shortDate(nextDueDate)}</p>` : ''}
      </div>
      <button class="btn btn--primary balance__action" type="button" data-nav="bills">ดูบิล</button>
    </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{profile: object, me: object, billing: object, unread?: number}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderHome(root, { profile, me, billing, unread = 0 }, navigate) {
  const propertyName = me.property_name ?? '';
  const roomId = me.room_id ?? '';

  // The earliest unpaid invoice is the one whose due date the tenant needs.
  const nextDue = (billing?.invoices ?? [])
    .filter((i) => i.due_satang > 0)
    .map((i) => i.due_date)
    .sort()[0];

  root.innerHTML = `
    <div class="screen screen--home">
      <header class="home-header">
        <p class="home-header__title">dorm.place</p>
        <div class="identity">
          ${avatar(profile)}
          <div class="identity__text">
            <small>สวัสดีครับ/ค่ะ</small>
            <strong>${escapeHtml(profile.displayName)}</strong>
            <span>${roomId ? `ห้อง ${escapeHtml(roomId)}` : ''}</span>
            <span>${escapeHtml(propertyName)}</span>
          </div>
        </div>
      </header>

      <main class="home-body">
        ${balanceCard(billing?.outstanding_satang, nextDue)}
        <div class="tile-grid">${TILES.map((t) => tile(t, unread)).join('')}</div>
      </main>

      ${navBar('home')}
    </div>`;

  bindNav(root, navigate);
}
