/**
 * Invoice list and detail.
 *
 * Amounts arrive as integer satang and dates in the Gregorian calendar; both
 * are formatted for the tenant in src/lib/format.js.
 */

import { baht, period, shortDate, nextPeriod } from '../lib/format.js';
import { navBar, bindNav } from './nav.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

const isOutstanding = (invoice) => invoice.due_satang > 0;

function invoiceCard(invoice) {
  const outstanding = isOutstanding(invoice);
  return `
    <button class="bill-card" type="button" data-nav="bill" data-nav-param="${escapeHtml(invoice.id)}">
      <span class="bill-card__head">
        <strong>${period(invoice.period)}</strong>
        <span class="chip chip--${outstanding ? 'danger' : 'ok'}">
          ${outstanding ? 'ค้างชำระ' : 'ชำระแล้ว'}
        </span>
      </span>
      <span class="bill-card__amount ${outstanding ? 'is-due' : ''}">
        ${baht(outstanding ? invoice.due_satang : invoice.total_satang)} บาท
      </span>
      <span class="bill-card__meta">กำหนดชำระ ${shortDate(invoice.due_date)}</span>
    </button>`;
}

/**
 * @param {HTMLElement} root
 * @param {{invoices: object[]}} data
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderBills(root, { invoices }, navigate) {
  const outstanding = invoices.filter(isOutstanding);
  const history = invoices.filter((i) => !isOutstanding(i));

  const list = (items, empty) =>
    items.length > 0
      ? items.map(invoiceCard).join('')
      : `<p class="empty">${empty}</p>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header">
        <button class="sub-header__back" type="button" data-nav="home" aria-label="ย้อนกลับ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
        </button>
        <h1>บิลค่าเช่า</h1>
      </header>

      <div class="tabs" role="tablist">
        <button class="tabs__tab is-active" type="button" role="tab" data-tab="outstanding">ค้างชำระ</button>
        <button class="tabs__tab" type="button" role="tab" data-tab="history">ประวัติ</button>
      </div>

      <main class="sub-body">
        <section data-panel="outstanding">${list(outstanding, 'ไม่มีบิลค้างชำระ')}</section>
        <section data-panel="history" hidden>${list(history, 'ยังไม่มีประวัติการชำระ')}</section>
      </main>

      ${navBar('bills')}
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

/**
 * @param {HTMLElement} root
 * @param {object} invoice invoice detail, with items and payments
 * @param {(view: string, param?: string) => void} navigate
 */
export function renderBillDetail(root, invoice, navigate) {
  const outstanding = isOutstanding(invoice);

  const itemRow = (item) => `
    <li class="line-item">
      <span>${escapeHtml(item.description)}</span>
      <span>${baht(item.amount_satang)} บาท</span>
    </li>`;

  const paymentRow = (payment) => `
    <li class="line-item line-item--paid">
      <span>ชำระแล้ว ${shortDate(payment.paid_at)}</span>
      <span>-${baht(payment.amount_satang)} บาท</span>
    </li>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header">
        <button class="sub-header__back" type="button" data-nav="bills" aria-label="ย้อนกลับ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
        </button>
        <h1>บิลค่าเช่า</h1>
      </header>

      <main class="sub-body">
        <section class="card">
          <div class="card__head">
            <strong>${period(invoice.period)}</strong>
            <span class="chip chip--${outstanding ? 'danger' : 'ok'}">
              ${outstanding ? 'ค้างชำระ' : 'ชำระแล้ว'}
            </span>
          </div>

          <p class="card__label">${outstanding ? 'ยอดรวมที่ต้องชำระ' : 'ยอดรวม'}</p>
          <p class="card__amount ${outstanding ? 'is-due' : ''}">
            ${baht(outstanding ? invoice.due_satang : invoice.total_satang)} บาท
          </p>
          <p class="card__meta">กำหนดชำระ ${shortDate(invoice.due_date)}</p>

          <ul class="line-items">
            ${invoice.items.map(itemRow).join('')}
            ${invoice.payments.map(paymentRow).join('')}
          </ul>

          <button class="btn btn--primary" type="button" disabled aria-disabled="true">ชำระเงิน</button>
          <p class="card__note">การชำระเงินออนไลน์กำลังจะเปิดให้บริการ</p>
        </section>

        <section class="card card--muted">
          <p class="card__label">บิลถัดไป</p>
          <div class="card__row">
            <strong>${nextPeriod(invoice.period)}</strong>
            <span>รอออกบิล</span>
          </div>
        </section>
      </main>

      ${navBar('bills')}
    </div>`;

  bindNav(root, navigate);
}
