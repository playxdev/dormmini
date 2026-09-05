/**
 * Announcements: the building's notice board, and one notice in full.
 *
 * A notice is addressed to the building, not to this tenant — the same text
 * everyone on the floor gets. Unread is the default state, so the list leads
 * with what has not been opened rather than burying it under a date sort.
 */

import { dateTime } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

/** Preserves the line breaks the owner typed without trusting the text. */
function paragraphs(body) {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function preview(body) {
  const flat = String(body ?? '').replace(/\s+/g, ' ').trim();
  return escapeHtml(flat.length > 80 ? `${flat.slice(0, 80)}…` : flat);
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

function announcementCard(announcement) {
  return `
    <button class="bill-card${announcement.read ? '' : ' bill-card--unread'}" type="button"
      data-nav="announcement" data-nav-param="${escapeHtml(announcement.id)}">
      <span class="bill-card__head">
        <strong class="repair-card__ref">
          ${announcement.pinned ? '<span class="pin" aria-label="ปักหมุด">📌</span> ' : ''}${escapeHtml(announcement.title)}
        </strong>
        ${announcement.read ? '' : '<span class="chip chip--warn">ใหม่</span>'}
      </span>
      <span class="repair-card__title">${preview(announcement.body)}</span>
      <span class="bill-card__meta">${escapeHtml(announcement.property_name ?? '')} · ${dateTime(announcement.published_at)}</span>
    </button>`;
}

/**
 * @param {HTMLElement} root
 * @param {{announcements: object[], unread_count: number}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderAnnouncements(root, { announcements }, navigate) {
  const list = announcements.length > 0
    ? announcements.map(announcementCard).join('')
    : '<p class="empty">ยังไม่มีประกาศจากหอพัก</p>';

  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('ประกาศ', 'home')}
      <main class="sub-body">${list}</main>
      ${navBar()}
    </div>`;

  bindNav(root, navigate);
}

export function renderAnnouncement(root, announcement, navigate) {
  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('ประกาศ', 'announcements')}
      <main class="sub-body">
        <article class="card announcement">
          <h2 class="announcement__title">
            ${announcement.pinned ? '<span class="pin" aria-label="ปักหมุด">📌</span> ' : ''}${escapeHtml(announcement.title)}
          </h2>
          <p class="announcement__meta">
            ${escapeHtml(announcement.property_name ?? '')} · ${dateTime(announcement.published_at)}
          </p>
          <div class="announcement__body">${paragraphs(announcement.body)}</div>
        </article>
      </main>
      ${navBar()}
    </div>`;

  bindNav(root, navigate);
}
