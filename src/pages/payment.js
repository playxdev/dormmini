/**
 * Paying an invoice by PromptPay.
 *
 * The money goes to the owner's bank, not to this system, so nothing here can
 * observe that a transfer happened. The screen therefore does two separate
 * things: it shows a QR to pay with, and it lets the tenant report what they
 * paid. The second is a claim the owner verifies — the screen says so, or a
 * tenant would believe the bill is settled and be surprised by a reminder.
 */

import encodeQR from '@paulmillr/qr';
import { baht } from '../lib/format.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

/**
 * Renders the payload as an inline SVG.
 *
 * The library returns a complete SVG document; only its body is wanted, sized
 * by the container rather than by its own width attribute.
 */
function qrSvg(payload) {
  const svg = encodeQR(payload, 'svg');
  return svg
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">')
    .replace(/width="[^"]*"/g, '')
    .replace(/height="[^"]*"/g, '');
}

/**
 * @param {HTMLElement} root
 * @param {{invoice: object, info: object}} data
 * @param {{onBack: () => void, onReport: (payload: object) => Promise<void>}} actions
 */
export function renderPayment(root, { invoice, info }, actions) {
  if (!info.payload_open && !info.payload_full) {
    renderUnavailable(root, actions);
    return;
  }

  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header">
        <button class="sub-header__back" type="button" id="pay-back" aria-label="ย้อนกลับ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
        </button>
        <h1>ชำระเงิน</h1>
      </header>

      <main class="sub-body">
        <section class="card pay-card">
          <p class="card__label">ยอดค้างชำระ</p>
          <p class="card__amount is-due">${baht(info.due_satang)} บาท</p>

          <div class="tabs tabs--inline" role="tablist">
            <button class="tabs__tab is-active" type="button" role="tab" data-mode="full">จ่ายเต็มจำนวน</button>
            <button class="tabs__tab" type="button" role="tab" data-mode="open">แบ่งจ่าย</button>
          </div>

          <div class="qr" id="pay-qr"></div>

          <p class="qr__hint" id="pay-hint"></p>
          ${info.promptpay_name ? `<p class="qr__payee">${escapeHtml(info.promptpay_name)}</p>` : ''}
        </section>

        <section class="card">
          <p class="card__label">โอนแล้ว? แจ้งให้ผู้ดูแลตรวจสอบ</p>
          <form class="form" id="pay-form">
            <label class="field">
              <span class="field__label">ยอดที่โอน (บาท)</span>
              <input class="field__control" name="amount" inputmode="decimal"
                value="${(info.due_satang / 100).toFixed(2)}" required>
            </label>
            <label class="field">
              <span class="field__label">เลขอ้างอิง <small>(ไม่บังคับ)</small></span>
              <input class="field__control" name="ref" maxlength="64"
                placeholder="เช่น เลขท้ายสลิป" autocomplete="off">
            </label>
            <p class="form__error" id="pay-error" hidden></p>
            <button class="btn btn--primary" type="submit" id="pay-submit">แจ้งชำระเงิน</button>
          </form>
          <p class="card__note">
            ยอดค้างจะปรับหลังผู้ดูแลหอพักตรวจสอบยอดโอนแล้ว
          </p>
        </section>
      </main>
    </div>`;

  const qr = root.querySelector('#pay-qr');
  const hint = root.querySelector('#pay-hint');

  const show = (mode) => {
    const full = mode === 'full' && info.payload_full;
    qr.innerHTML = qrSvg(full ? info.payload_full : info.payload_open);
    hint.textContent = full
      ? `สแกนด้วยแอปธนาคาร ยอด ${baht(info.due_satang)} บาท จะถูกกรอกให้อัตโนมัติ`
      : 'สแกนด้วยแอปธนาคาร แล้วกรอกยอดที่ต้องการจ่ายเอง';
  };

  root.querySelectorAll('[data-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('[data-mode]').forEach((t) => t.classList.toggle('is-active', t === tab));
      show(tab.dataset.mode);
    });
  });

  show(info.payload_full ? 'full' : 'open');

  root.querySelector('#pay-back').addEventListener('click', actions.onBack);

  const form = root.querySelector('#pay-form');
  const submit = root.querySelector('#pay-submit');
  const error = root.querySelector('#pay-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Parsed to satang here so the wire never carries a float.
    const raw = String(new FormData(form).get('amount') ?? '').replace(/,/g, '').trim();
    const satang = Math.round(Number(raw) * 100);

    if (!Number.isFinite(satang) || satang <= 0) {
      error.textContent = 'กรุณากรอกยอดที่โอนให้ถูกต้อง';
      error.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.textContent = 'กำลังส่ง...';
    error.hidden = true;

    try {
      await actions.onReport({
        amount_satang: satang,
        method: 'promptpay',
        ref: String(new FormData(form).get('ref') ?? '').trim(),
        // Generated per submission, so a retry on a bad connection cannot be
        // recorded as a second transfer.
        idempotency_key: crypto.randomUUID()
      });
    } catch {
      error.textContent = 'ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'แจ้งชำระเงิน';
    }
  });
}

function renderUnavailable(root, actions) {
  root.innerHTML = `
    <main class="screen screen--center screen--onboard">
      <span class="onboard__mark onboard__mark--warn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm0 6 1 7h-2l1-7Zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>
      </span>
      <h1 class="onboard__title">ยังไม่เปิดรับชำระออนไลน์</h1>
      <p class="onboard__detail">หอพักยังไม่ได้ตั้งค่าพร้อมเพย์<br>กรุณาติดต่อผู้ดูแลหอพัก</p>
      <button class="btn btn--primary" type="button" id="pay-unavail-back">กลับ</button>
    </main>`;
  root.querySelector('#pay-unavail-back').addEventListener('click', actions.onBack);
}
