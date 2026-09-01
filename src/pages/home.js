/**
 * Authenticated home screen.
 *
 * Milestone 1 renders identity, property and room only. The feature tiles and
 * bottom navigation are the Phase 2 shell and are intentionally inert - they
 * exist so Phase 2 screens drop into a finished layout without a rewrite.
 */

const TILES = [
  { tone: 'blue', title: 'บิลค่าเช่า', subtitle: 'ดูประวัติใบเสร็จ', icon: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>' },
  { tone: 'orange', title: 'แจ้งซ่อม', subtitle: 'ติดตามสถานะ', icon: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>' },
  { tone: 'green', title: 'จดมิเตอร์', subtitle: 'น้ำ/ไฟ', icon: '<path d="M4 4h16v16H4V4Zm3 3v4h4V7H7Zm6 0v4h4V7h-4Zm-6 6v4h4v-4H7Zm6 0v4h4v-4h-4Z"/>' },
  { tone: 'red', title: 'ประกาศ', subtitle: 'ข่าวสารจากหอ', icon: '<path d="M3 10v4h3l6 4V6L6 10H3Zm14.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/>' },
  { tone: 'purple', title: 'เอกสาร', subtitle: 'สัญญา/ใบเสร็จ', icon: '<path d="M6 2h8l4 4v16H6V2Zm2.5 8h7v2h-7v-2Zm0 4h7v2h-7v-2Z"/>' },
  { tone: 'green', title: 'ติดต่อเรา', subtitle: 'ผู้ดูแลหอ', icon: '<path d="M6.6 3h3l1.5 4-2 1.5a12 12 0 0 0 6.4 6.4l1.5-2 4 1.5v3c0 1-.8 1.6-1.8 1.5C11.4 18.3 5.7 12.6 5.1 4.8 5 3.8 5.6 3 6.6 3Z"/>' }
];

const NAV = [
  { title: 'หน้าหลัก', active: true, icon: '<path d="M12 3 3 10.2V21h6v-5.5h6V21h6V10.2L12 3Z"/>' },
  { title: 'บิล', icon: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>' },
  { title: 'แจ้งซ่อม', icon: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>' },
  { title: 'เมนู', icon: '<path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/>' }
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
  return `
    <button class="tile" type="button" disabled aria-disabled="true">
      <span class="tile__icon tile__icon--${item.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      </span>
      <strong class="tile__title">${item.title}</strong>
      <small class="tile__subtitle">${item.subtitle}</small>
    </button>`;
}

function navItem(item) {
  return `
    <button class="nav__item${item.active ? ' is-active' : ''}" type="button" ${item.active ? '' : 'disabled'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      <span>${item.title}</span>
    </button>`;
}

/**
 * @param {HTMLElement} root
 * @param {{profile: {displayName: string, pictureUrl?: string},
 *          me: {property_name?: string, room_id?: string}}} data
 */
export function renderHome(root, { profile, me }) {
  const propertyName = me.property_name ?? me.property?.name ?? '';
  const roomId = me.room_id ?? me.room?.id ?? '';

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
        <p class="phase-note">ฟีเจอร์ทั้งหมดกำลังจะมาเร็ว ๆ นี้</p>
        <div class="tile-grid">${TILES.map(tile).join('')}</div>
      </main>

      <nav class="nav" aria-label="เมนูหลัก">
        ${navItem(NAV[0])}
        ${navItem(NAV[1])}
        <button class="nav__fab" type="button" disabled aria-disabled="true">
          <span class="nav__fab-circle">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z"/></svg>
          </span>
          <span>สแกน/จ่าย</span>
        </button>
        ${navItem(NAV[2])}
        ${navItem(NAV[3])}
      </nav>
    </div>`;
}
