/**
 * Email: the only way back into an account.
 *
 * A tenant is known to this system by one thing, the LINE subject their login
 * carries. Lose the LINE account and that subject is gone for good — a new one
 * is a different person as far as the database is concerned, and no amount of
 * knowing the room number changes it. A verified address is the second proof
 * that makes a rebind possible, and there is no third.
 *
 * Two screens live here: giving an address (offered after the room is bound,
 * never before it) and asking for a recovery link (offered on the unlinked
 * screen, where a locked-out tenant lands).
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

// Deliberately loose. The address is proven by the link that arrives in it,
// so a stricter pattern here only rejects real addresses — the server holds
// the real check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Asks for an address, or shows the state of the one already given.
 *
 * @param {HTMLElement} root
 * @param {{email?: string, email_verified?: boolean, skippable?: boolean}} state
 * @param {{onSave: (email: string) => Promise<void>, onDone: () => void}} actions
 */
export function renderEmailCapture(root, state, actions) {
  const current = state.email ?? '';
  const verified = Boolean(state.email_verified);
  const skippable = state.skippable !== false;

  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header sub-header--plain">
        <h1>อีเมลสำหรับกู้คืนบัญชี</h1>
      </header>

      <main class="sub-body">
        <section class="card">
          <p class="onboard__detail">
            ถ้าคุณเปลี่ยนเบอร์ ทำบัญชี LINE หาย หรือสมัคร LINE ใหม่
            อีเมลนี้คือทางเดียวที่จะพาคุณกลับเข้าห้องเดิมได้
          </p>
          ${verified ? `
            <p class="chip chip--ok">ยืนยันแล้ว · ${escapeHtml(current)}</p>` : current ? `
            <p class="chip chip--warn">ยังไม่ได้ยืนยัน · ${escapeHtml(current)}</p>
            <p class="onboard__help">เปิดลิงก์ในกล่องจดหมายเพื่อยืนยัน หรือกรอกใหม่แล้วส่งอีกครั้ง</p>` : ''}

          <form id="email-form">
            <label class="field">
              <span class="field__label">อีเมล</span>
              <input class="field__control" name="email" type="email" inputmode="email"
                autocomplete="email" autocapitalize="off" spellcheck="false"
                placeholder="you@example.com" value="${escapeHtml(current)}">
            </label>
            <p class="form__error" id="email-error" hidden></p>
            <button class="btn btn--primary" type="submit" id="email-submit">
              ${current ? 'ส่งลิงก์ยืนยันอีกครั้ง' : 'บันทึกและส่งลิงก์ยืนยัน'}
            </button>
          </form>
        </section>

        <button class="btn btn--ghost" type="button" id="email-done">
          ${skippable ? 'ข้ามไปก่อน' : 'เสร็จสิ้น'}
        </button>
      </main>
    </div>`;

  const form = root.querySelector('#email-form');
  const input = form.querySelector('[name="email"]');
  const submit = root.querySelector('#email-submit');
  const error = root.querySelector('#email-error');

  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
    submit.disabled = false;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    const value = input.value.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      fail('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    submit.disabled = true;
    try {
      await actions.onSave(value);
      // The address is saved; what is left is in the tenant's inbox, and
      // nothing this screen can do moves it along.
      root.querySelector('#email-form').outerHTML = `
        <p class="chip chip--ok">ส่งลิงก์ยืนยันไปที่ ${escapeHtml(value)} แล้ว</p>
        <p class="onboard__help">เปิดลิงก์ในกล่องจดหมายเพื่อยืนยัน ลิงก์ใช้ได้ 24 ชั่วโมง</p>`;
      root.querySelector('#email-done').textContent = 'เสร็จสิ้น';
    } catch (cause) {
      fail(messageFor(cause));
    }
  });

  root.querySelector('#email-done').addEventListener('click', actions.onDone);
}

/**
 * The way back in for a tenant whose LINE account is gone.
 *
 * Answers the same way whatever address is typed. A screen that said "no
 * account with that address" would answer, to anyone who asked, whether a
 * given person rents here.
 *
 * @param {HTMLElement} root
 * @param {{onRequest: (email: string) => Promise<void>, onBack: () => void}} actions
 */
export function renderRecoveryRequest(root, actions) {
  root.innerHTML = `
    <div class="screen screen--sub">
      <header class="sub-header">
        <button class="sub-header__back" type="button" id="recovery-back" aria-label="ย้อนกลับ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8 1.5-1.5L10 12l6.5-6.5L15 4Z"/></svg>
        </button>
        <h1>กู้คืนบัญชี</h1>
      </header>

      <main class="sub-body">
        <section class="card">
          <p class="onboard__detail">
            กรอกอีเมลที่เคยยืนยันไว้ ระบบจะส่งลิงก์กู้คืนไปให้
            เปิดลิงก์บนเครื่องนี้เพื่อย้ายห้องเดิมมาที่บัญชี LINE ปัจจุบัน
          </p>

          <form id="recovery-form">
            <label class="field">
              <span class="field__label">อีเมล</span>
              <input class="field__control" name="email" type="email" inputmode="email"
                autocomplete="email" autocapitalize="off" spellcheck="false"
                placeholder="you@example.com">
            </label>
            <p class="form__error" id="recovery-error" hidden></p>
            <button class="btn btn--primary" type="submit" id="recovery-submit">ส่งลิงก์กู้คืน</button>
          </form>
        </section>

        <p class="onboard__help">
          ไม่ได้ผูกอีเมลไว้? ติดต่อผู้ดูแลหอพัก เพื่อยืนยันตัวตนและออกรหัสกู้คืนให้
        </p>
      </main>
    </div>`;

  const form = root.querySelector('#recovery-form');
  const submit = root.querySelector('#recovery-submit');
  const error = root.querySelector('#recovery-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;

    const value = form.querySelector('[name="email"]').value.trim().toLowerCase();
    try {
      await actions.onRequest(value);
      root.querySelector('#recovery-form').outerHTML = `
        <p class="chip chip--ok">ถ้ามีบัญชีที่ผูกกับอีเมลนี้ ระบบส่งลิงก์ไปแล้ว</p>
        <p class="onboard__help">ลิงก์ใช้ได้ 15 นาที และใช้ได้ครั้งเดียว</p>`;
    } catch (cause) {
      error.textContent = messageFor(cause);
      error.hidden = false;
      submit.disabled = false;
    }
  });

  root.querySelector('#recovery-back').addEventListener('click', actions.onBack);
}

/**
 * Turns a client error code into something a tenant can act on.
 *
 * Kept here rather than in the error screen because none of these should blank
 * the form: the address is still typed, and every one of them is fixed by
 * changing it or trying again.
 */
function messageFor(error) {
  switch (error?.code) {
    case 'INVITE_ALREADY_CLAIMED':
      // 409 from POST /me/email: this address is already on another account.
      return 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว';
    case 'BACKEND_UNAVAILABLE':
      return 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    default:
      return 'ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }
}
