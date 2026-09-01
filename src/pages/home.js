/**
 * Authenticated home screen.
 *
 * Shows identity, the outstanding balance and the feature grid. Tiles whose
 * screens are not built yet render disabled rather than hidden, so the layout
 * keeps the shape of the finished design.
 */

import { baht, shortDate } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

const TILES = [
  { tone: 'blue', title: 'บิลค่าเช่า', subtitle: 'ดูประวัติใบเสร็จ', view: 'bills', icon: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>' },
  { tone: 'orange', title: 'แจ้งซ่อม', subtitle: 'ติดตามสถานะ', icon: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>' },
  { tone: 'green', title: 'จดมิเตอร์', subtitle: 'น้ำ/ไฟ', icon: '<path d="M4 4h16v16H4V4Zm3 3v4h4V7H7Zm6 0v4h4V7h-4Zm-6 6v4h4v-4H7Zm6 0v4h4v-4h-4Z"/>' },
  { tone: 'red', title: 'ประกาศ', subtitle: 'ข่าวสารจากหอ', icon: '<path d="M3 10v4h3l6 4V6L6 10H3Zm14.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/>' },
  { tone: 'purple', title: 'เอกสาร', subtitle: 'สัญญา/ใบเสร็จ', icon: '<path d="M6 2h8l4 4v16H6V2Zm2.5 8h7v2h-7v-2Zm0 4h7v2h-7v-2Z"/>' },
  { tone: 'green', title: 'ติดต่อเรา', subtitle: 'ผู้ดูแลหอ', icon: '<path d="M6.6 3h3l1.5 4-2 1.5a12 12 0 0 0 6.4 6.4l1.5-2 4 1.5v3c0 1-.8 1.6-1.8 1.5C11.4 18.3 5.7 12.6 5.1 4.8 5 3.8 5.6 3 6.6 3Z"/>' }
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

function tile(item) {
  const enabled = Boolean(item.view);
  return `
    <button class="tile" type="button"
      ${enabled ? `data-nav="${item.view}"` : 'disabled aria-disabled="true"'}>
      <span class="tile__icon tile__icon--${item.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      </span>
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
 * @param {{profile: object, me: object, billing: object}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderHome(root, { profile, me, billing }, navigate) {
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
        <div class="tile-grid">${TILES.map(tile).join('')}</div>
      </main>

      ${navBar('home')}
    </div>`;

  bindNav(root, navigate);
}
