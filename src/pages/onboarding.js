/**
 * Binding a LINE account to a room.
 *
 * Three screens: the unlinked state a tenant lands on, the review of what they
 * are about to accept, and the result. The terms shown here are exactly what
 * the confirmation is taken to cover, so they are rendered from the server's
 * answer and never from anything the client holds.
 */

import { baht, shortDate } from '../lib/format.js';
import { canScanCode } from '../auth/line.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

// Codes are typed in the same alphabet they are issued in: no 0/O, 1/I/L,
// 2/Z, 5/S or 8/B, because an owner reads them aloud.
const CODE_PATTERN = /^[34679ACDEFGHJKMNPQRTUVWXY]{8}$/;

/**
 * The screen a tenant sees when their LINE account is not linked to any room.
 *
 * @param {HTMLElement} root
 * @param {{onScan: () => void, onCode: (code: string) => void}} actions
 */
export function renderUnlinked(root, actions) {
  const scannable = canScanCode();

  root.innerHTML = `
    <main class="screen screen--center screen--onboard">
      <span class="onboard__mark">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 10.2V21h6v-5.5h6V21h6V10.2L12 3Z"/></svg>
      </span>

      <h1 class="onboard__title">ยังไม่ได้ผูกบัญชีกับหอพัก</h1>
      <p class="onboard__detail">
        สแกน QR ที่ได้รับจากผู้ดูแลหอพัก<br>เพื่อเชื่อมบัญชี LINE ของคุณกับห้องพัก
      </p>

      ${scannable ? `
        <button class="btn btn--primary" type="button" id="onboard-scan">
          <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/></svg>
          สแกน QR
        </button>` : ''}

      <form class="onboard__code" id="onboard-form">
        <label class="field">
          <span class="field__label">${scannable ? 'หรือกรอกรหัสที่ได้รับ' : 'กรอกรหัสที่ได้รับจากผู้ดูแลหอพัก'}</span>
          <input class="field__control field__control--code" name="code" maxlength="8"
            autocapitalize="characters" autocomplete="off" spellcheck="false"
            placeholder="K7M9P4QX" inputmode="text">
        </label>
        <p class="form__error" id="onboard-error" hidden></p>
        <button class="btn ${scannable ? 'btn--ghost' : 'btn--primary'}" type="submit">ตรวจสอบรหัส</button>
      </form>

      <p class="onboard__help">ยังไม่มีรหัส? ติดต่อผู้ดูแลหอพักของคุณ</p>
    </main>`;

  const error = root.querySelector('#onboard-error');
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
  };

  root.querySelector('#onboard-scan')?.addEventListener('click', actions.onScan);

  root.querySelector('#onboard-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = root.querySelector('[name="code"]');
    const code = input.value.trim().toUpperCase();

    if (!CODE_PATTERN.test(code)) {
      fail('รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      input.focus();
      return;
    }
    error.hidden = true;
    actions.onCode(code);
  });
}

/**
 * Review of the terms before confirming.
 *
 * @param {HTMLElement} root
 * @param {object} invite server's answer for this code
 * @param {{onConfirm: () => Promise<void>, onBack: () => void}} actions
 */
export function renderInviteReview(root, invite, actions) {
  // Claimed by this same account: nothing to confirm, only to return to.
  if (invite.claimed_by_self) {
    renderClaimed(root, invite, actions, 'ห้องนี้ผูกกับบัญชีของคุณอยู่แล้ว');
    return;
  }
  if (invite.already_claimed) {
    renderClaimed(root, invite, actions, 'ห้องนี้ถูกผูกกับบัญชีอื่นไปแล้ว กรุณาติดต่อผู้ดูแลหอพัก');
    return;
  }

  const row = (label, value) => `
    <li class="line-item">
      <span>${label}</span>
      <span>${value}</span>
    </li>`;

  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header">
        <button class="sub-header__back" type="button" id="review-back" aria-label="ย้อนกลับ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
        </button>
        <h1>ตรวจสอบข้อมูล</h1>
      </header>

      <main class="sub-body">
        <p class="review__lead">กรุณาตรวจสอบให้ถูกต้องก่อนยืนยัน</p>

        <section class="card">
          <p class="card__label">หอพัก</p>
          <p class="review__building">${escapeHtml(invite.building_name)}</p>
          <p class="review__room">ห้อง ${escapeHtml(invite.room_number)}</p>

          <ul class="line-items">
            ${invite.tenant_name ? row('ผู้เช่า', escapeHtml(invite.tenant_name)) : ''}
            ${row('ค่าเช่า', `${baht(invite.rent_satang)} บาท / เดือน`)}
            ${row('เงินประกัน', `${baht(invite.deposit_satang)} บาท`)}
            ${row('เริ่มสัญญา', shortDate(invite.start_date))}
          </ul>
        </section>

        <p class="form__error" id="review-error" hidden></p>

        <div class="slide" id="review-slide">
          <div class="slide__track">
            <span class="slide__label">เลื่อนเพื่อยืนยัน</span>
            <button class="slide__knob" type="button" aria-label="เลื่อนเพื่อยืนยัน">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 7.6 5.4 14.2 12l-6.6 6.6L9 20l8-8-8-8Z"/></svg>
            </button>
          </div>
        </div>

        <p class="card__note">การยืนยันจะบันทึกเงื่อนไขที่แสดงด้านบนไว้เป็นหลักฐาน</p>
      </main>
    </div>`;

  root.querySelector('#review-back').addEventListener('click', actions.onBack);
  bindSlide(root.querySelector('#review-slide'), async () => {
    const error = root.querySelector('#review-error');
    error.hidden = true;
    try {
      await actions.onConfirm();
    } catch {
      error.textContent = 'ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      error.hidden = false;
      resetSlide(root.querySelector('#review-slide'));
    }
  });
}

function renderClaimed(root, invite, actions, message) {
  root.innerHTML = `
    <main class="screen screen--center screen--onboard">
      <span class="onboard__mark onboard__mark--warn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm0 6 1 7h-2l1-7Zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>
      </span>
      <h1 class="onboard__title">${escapeHtml(invite.building_name)} ห้อง ${escapeHtml(invite.room_number)}</h1>
      <p class="onboard__detail">${message}</p>
      <button class="btn btn--primary" type="button" id="claimed-back">กลับ</button>
    </main>`;

  root.querySelector('#claimed-back').addEventListener('click', actions.onBack);
}

/**
 * Turns a track and knob into a slide-to-confirm control.
 *
 * A deliberate gesture rather than a tap: confirming binds the tenant to a
 * contract, and a mis-tap should not be able to do that. Pointer events cover
 * touch and mouse without separate paths.
 */
function bindSlide(slide, onComplete) {
  const track = slide.querySelector('.slide__track');
  const knob = slide.querySelector('.slide__knob');

  let dragging = false;
  let startX = 0;
  let offset = 0;

  const limit = () => track.clientWidth - knob.offsetWidth - 8;

  const move = (x) => {
    offset = Math.max(0, Math.min(limit(), x - startX));
    knob.style.transform = `translateX(${offset}px)`;
    slide.style.setProperty('--slide-progress', String(offset / limit()));
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    knob.classList.remove('is-dragging');

    // 90% rather than 100%: the knob cannot always reach the exact end on a
    // narrow screen, and demanding it would make the control feel broken.
    if (offset >= limit() * 0.9) {
      slide.classList.add('is-complete');
      knob.style.transform = `translateX(${limit()}px)`;
      knob.disabled = true;
      onComplete();
      return;
    }
    resetSlide(slide);
  };

  knob.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX - offset;
    knob.classList.add('is-dragging');
    knob.setPointerCapture(event.pointerId);
  });

  knob.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    move(event.clientX);
  });

  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);

  // Keyboard and assistive technology cannot drag. Enter or Space on the knob
  // completes it, so the screen is not a dead end without a pointer.
  knob.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      slide.classList.add('is-complete');
      knob.disabled = true;
      onComplete();
    }
  });
}

function resetSlide(slide) {
  const knob = slide.querySelector('.slide__knob');
  slide.classList.remove('is-complete');
  slide.style.setProperty('--slide-progress', '0');
  knob.disabled = false;
  knob.style.transform = 'translateX(0)';
}
