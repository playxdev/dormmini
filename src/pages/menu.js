/**
 * Menu: who you are, which room, and every screen that is not on the tab bar.
 *
 * The tab bar holds the three things a tenant opens weekly. Everything rarer —
 * the notice board, the meter history, linking a second room — lives here
 * rather than crowding the bar or hiding behind a disabled button.
 */

import { navBar, bindNav } from './nav.js';

const ITEMS = [
  {
    view: 'announcements', title: 'ประกาศ', subtitle: 'ข่าวสารจากหอ',
    icon: '<path d="M3 10v4h3l6 4V6L6 10H3Zm14.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/>'
  },
  {
    view: 'meters', title: 'จดมิเตอร์', subtitle: 'น้ำ/ไฟ ย้อนหลัง',
    icon: '<path d="M4 4h16v16H4V4Zm3 3v4h4V7H7Zm6 0v4h4V7h-4Zm-6 6v4h4v-4H7Zm6 0v4h4v-4h-4Z"/>'
  },
  {
    view: 'bills', title: 'บิลค่าเช่า', subtitle: 'ยอดค้างและประวัติ',
    icon: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>'
  },
  {
    view: 'repairs', title: 'แจ้งซ่อม', subtitle: 'แจ้งใหม่และติดตาม',
    icon: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>'
  },
  {
    view: 'scan', title: 'ผูกห้องเพิ่ม', subtitle: 'สแกน QR จากผู้ดูแลหอ',
    icon: '<path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z"/>'
  }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function row(item, badge) {
  return `
    <button class="menu-row" type="button" data-nav="${item.view}">
      <span class="menu-row__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      </span>
      <span class="menu-row__text">
        <strong>${item.title}</strong>
        <small>${item.subtitle}</small>
      </span>
      ${badge ? `<span class="chip chip--warn">${badge}</span>` : ''}
      <span class="menu-row__chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m9 4 8 8-8 8-1.5-1.5L14 12 7.5 5.5 9 4Z"/></svg>
      </span>
    </button>`;
}

/**
 * @param {HTMLElement} root
 * @param {{profile: object, me: object, unread: number, version: string}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderMenu(root, { profile, me, unread, version }, navigate) {
  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header sub-header--plain">
        <h1>เมนู</h1>
      </header>

      <main class="sub-body">
        <section class="card menu-identity">
          <strong>${escapeHtml(profile?.displayName ?? '')}</strong>
          <p>${me.room_id ? `ห้อง ${escapeHtml(me.room_id)}` : ''}</p>
          <p class="menu-identity__property">${escapeHtml(me.property_name ?? '')}</p>
        </section>

        <nav class="menu-list" aria-label="เมนูทั้งหมด">
          ${ITEMS.map((item) => row(item, item.view === 'announcements' && unread > 0 ? unread : 0)).join('')}
        </nav>

        <p class="menu-version">dorm.place · เวอร์ชัน ${escapeHtml(version)}</p>
      </main>

      ${navBar('menu')}
    </div>`;

  bindNav(root, navigate);
}
