/**
 * Repair requests: the list, the detail with its status history, and the form
 * for filing a new one.
 */

import { dateTime } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

const STATUS = {
  open: { label: 'รอดำเนินการ', tone: 'wait' },
  pending: { label: 'รอดำเนินการ', tone: 'wait' },
  in_progress: { label: 'กำลังดำเนินการ', tone: 'warn' },
  done: { label: 'เสร็จสิ้น', tone: 'ok' },
  cancelled: { label: 'ยกเลิก', tone: 'muted' }
};

// Mirrors the set the API accepts; anything else is rejected there.
const PRIORITIES = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'urgent', label: 'ด่วน — ใช้ห้องไม่ได้' },
  { value: 'low', label: 'ไม่เร่งด่วน' }
];

const OPEN_STATUSES = new Set(['pending', 'in_progress']);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function statusChip(status) {
  const s = STATUS[status] ?? STATUS.pending;
  return `<span class="chip chip--${s.tone}">${s.label}</span>`;
}

function repairCard(repair) {
  return `
    <button class="bill-card" type="button" data-nav="repair" data-nav-param="${escapeHtml(repair.id)}">
      <span class="bill-card__head">
        <strong class="repair-card__ref">${escapeHtml(repair.title)}</strong>
        ${statusChip(repair.status)}
      </span>
      <span class="repair-card__title">${(PRIORITIES.find((p) => p.value === repair.priority) ?? PRIORITIES[0]).label}</span>
      <span class="bill-card__meta">แจ้งเมื่อ ${dateTime(repair.created_at)}</span>
    </button>`;
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

export function renderRepairs(root, { repairs }, navigate) {
  const open = repairs.filter((r) => OPEN_STATUSES.has(r.status));
  const closed = repairs.filter((r) => !OPEN_STATUSES.has(r.status));

  const list = (items, empty) =>
    items.length > 0 ? items.map(repairCard).join('') : `<p class="empty">${empty}</p>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('แจ้งซ่อม', 'home')}

      <div class="tabs" role="tablist">
        <button class="tabs__tab is-active" type="button" role="tab" data-tab="open">รายการแจ้งซ่อม</button>
        <button class="tabs__tab" type="button" role="tab" data-tab="closed">ประวัติ</button>
      </div>

      <main class="sub-body">
        <section data-panel="open">${list(open, 'ยังไม่มีรายการแจ้งซ่อม')}</section>
        <section data-panel="closed" hidden>${list(closed, 'ยังไม่มีประวัติ')}</section>
        <button class="btn btn--primary" type="button" data-nav="repair-new">แจ้งซ่อมใหม่</button>
      </main>

      ${navBar('repairs')}
    </div>`;

  root.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('is-active', t === tab));
      root.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
    });
  });

  bindNav(root, navigate);
}

export function renderRepairDetail(root, repair, navigate) {
  const priority = PRIORITIES.find((p) => p.value === repair.priority)?.label ?? 'ปกติ';

  const event = (e) => `
    <li class="timeline__item">
      <span class="timeline__dot"></span>
      <div>
        <strong>${(STATUS[e.status] ?? STATUS.pending).label}</strong>
        ${e.note ? `<p>${escapeHtml(e.note)}</p>` : ''}
        <small>${dateTime(e.created_at)}</small>
      </div>
    </li>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('รายละเอียดการแจ้งซ่อม', 'repairs')}

      <main class="sub-body">
        <section class="card">
          <div class="card__head">
            <strong>${escapeHtml(repair.title)}</strong>
            ${statusChip(repair.status)}
          </div>
          <p class="card__label">ความเร่งด่วน: ${escapeHtml(priority)}</p>
          ${repair.detail ? `<p class="repair-detail__body">${escapeHtml(repair.detail)}</p>` : ''}
          <p class="card__meta">แจ้งเมื่อ ${dateTime(repair.created_at)}</p>
        </section>

        <section class="card">
          <p class="card__label">สถานะ</p>
          <ul class="timeline">
            <li class="timeline__item">
              <span class="timeline__dot"></span>
              <div>
                <strong>รับเรื่องแล้ว</strong>
                <small>${dateTime(repair.created_at)}</small>
              </div>
            </li>
            ${(repair.events ?? []).map(event).join('')}
          </ul>
        </section>
      </main>

      ${navBar('repairs')}
    </div>`;

  bindNav(root, navigate);
}

/**
 * @param {(payload: object) => Promise<void>} onSubmit resolves once the
 *   request has been filed and the caller has navigated away.
 */
export function renderRepairForm(root, navigate, onSubmit) {
  root.innerHTML = `
    <div class="screen screen--sub">
      ${header('แจ้งซ่อมใหม่', 'repairs')}

      <main class="sub-body">
        <form class="form" id="repair-form" novalidate>
          <label class="field">
            <span class="field__label">ความเร่งด่วน</span>
            <select class="field__control" name="priority" required>
              ${PRIORITIES.map((p) => `<option value="${p.value}">${p.label}</option>`).join('')}
            </select>
          </label>

          <label class="field">
            <span class="field__label">หัวข้อ</span>
            <input class="field__control" name="title" maxlength="120" required
              placeholder="เช่น แอร์ไม่เย็น">
          </label>

          <label class="field">
            <span class="field__label">รายละเอียด <small>(ไม่บังคับ)</small></span>
            <textarea class="field__control" name="detail" rows="4" maxlength="2000"
              placeholder="อาการที่พบ ช่วงเวลาที่สะดวกให้เข้าซ่อม"></textarea>
          </label>

          <p class="form__error" id="repair-error" hidden></p>

          <button class="btn btn--primary" type="submit" id="repair-submit">ส่งเรื่องแจ้งซ่อม</button>
        </form>
      </main>

      ${navBar('repairs')}
    </div>`;

  const form = root.querySelector('#repair-form');
  const submit = root.querySelector('#repair-submit');
  const error = root.querySelector('#repair-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const title = String(data.get('title') ?? '').trim();
    if (!title) {
      error.textContent = 'กรุณากรอกหัวข้อ';
      error.hidden = false;
      return;
    }

    // Disabled for the whole round trip: a second tap would file a duplicate
    // request, and there is no idempotency key on this endpoint.
    submit.disabled = true;
    submit.textContent = 'กำลังส่ง...';
    error.hidden = true;

    try {
      await onSubmit({
        title,
        detail: String(data.get('detail') ?? '').trim(),
        priority: String(data.get('priority') ?? 'normal')
      });
    } catch {
      error.textContent = 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'ส่งเรื่องแจ้งซ่อม';
    }
  });

  bindNav(root, navigate);
}
