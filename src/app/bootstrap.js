/**
 * Application bootstrap (DESIGN-LINE-MINI.md section 6).
 *
 *   config -> LIFF init -> login state -> LINE identity
 *   -> backend auth -> tenant/property/room -> home
 */

import { config, assertConfig } from './config.js';
import { initLine, isLoggedIn, login, getIdToken, getLineProfile, closeWindow } from '../auth/line.js';
import { authenticateWithLine, fetchMe, AppError, ErrorCode } from '../api/client.js';
import { setToken, setProfile, clearSession } from '../auth/session.js';
import { renderLogin } from '../pages/login.js';
import { renderHome } from '../pages/home.js';

const MESSAGES = {
  [ErrorCode.LIFF_INIT_FAILED]: {
    title: 'ไม่สามารถเริ่มต้นแอปพลิเคชันได้',
    detail: 'กรุณาปิดหน้านี้แล้วเปิดใหม่จาก LINE อีกครั้ง'
  },
  [ErrorCode.MISSING_ID_TOKEN]: {
    title: 'ไม่สามารถยืนยันตัวตนได้',
    detail: 'การตั้งค่าสิทธิ์ของแอปพลิเคชันไม่ครบถ้วน กรุณาติดต่อผู้ดูแลระบบ'
  },
  [ErrorCode.TENANT_NOT_FOUND]: {
    title: 'ยังไม่ได้ผูกบัญชีกับหอพัก',
    detail: 'กรุณาติดต่อผู้ดูแลหอพักเพื่อผูกบัญชี LINE ของคุณกับห้องพัก'
  },
  [ErrorCode.BACKEND_UNAVAILABLE]: {
    title: 'ไม่สามารถเชื่อมต่อระบบได้',
    detail: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'
  },
  [ErrorCode.UNAUTHORIZED]: {
    title: 'เซสชันหมดอายุ',
    detail: 'กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง'
  },
  [ErrorCode.CONFIG_INVALID]: {
    title: 'ตั้งค่าแอปพลิเคชันไม่ถูกต้อง',
    detail: 'กรุณาติดต่อผู้ดูแลระบบ'
  }
};

const FALLBACK = {
  title: 'เกิดข้อผิดพลาด',
  detail: 'กรุณาลองใหม่อีกครั้ง'
};

function renderLoading(root) {
  root.innerHTML = `
    <div class="screen screen--center">
      <div class="spinner" role="status" aria-label="กำลังโหลด"></div>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {AppError|Error} error
 * @param {{retry?: boolean, relogin?: boolean}} options
 */
function renderError(root, error, options = {}) {
  const code = error instanceof AppError ? error.code : null;
  const message = MESSAGES[code] ?? FALLBACK;

  root.innerHTML = `
    <div class="screen screen--center screen--error">
      <svg class="error__mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 1 21h22L12 2Zm0 6 1 7h-2l1-7Zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/>
      </svg>
      <h2 class="error__title">${message.title}</h2>
      <p class="error__detail">${message.detail}</p>
      <div class="error__actions">
        ${options.relogin ? '<button class="btn btn--primary" type="button" id="error-relogin">เข้าสู่ระบบใหม่</button>' : ''}
        ${options.retry ? '<button class="btn btn--primary" type="button" id="error-retry">ลองใหม่อีกครั้ง</button>' : ''}
        <button class="btn btn--ghost" type="button" id="error-close">ปิดหน้านี้</button>
      </div>
    </div>`;

  root.querySelector('#error-retry')?.addEventListener('click', () => start(root));
  root.querySelector('#error-relogin')?.addEventListener('click', () => {
    clearSession();
    login();
  });
  root.querySelector('#error-close')?.addEventListener('click', closeWindow);

  if (config.appEnv !== 'production') {
    // Diagnostics stay in the console. Never rendered to the user.
    // The cause carries the underlying LIFF or network failure, which is the
    // part worth reading - AppError itself only names the category.
    console.error('[dorm.place]', code ?? 'UNKNOWN', error);
    if (error?.cause) console.error('[dorm.place] cause:', error.cause);
  }
}

export async function start(root) {
  renderLoading(root);

  const missing = assertConfig();
  if (missing.length > 0) {
    renderError(root, new AppError(ErrorCode.CONFIG_INVALID, `missing: ${missing.join(', ')}`));
    return;
  }

  try {
    await initLine();
  } catch (error) {
    renderError(root, error, { retry: true });
    return;
  }

  if (!isLoggedIn()) {
    renderLogin(root);
    return;
  }

  try {
    const idToken = getIdToken();
    if (!idToken) {
      // Logged in, but LIFF returned no ID token. This is almost always a
      // channel misconfiguration: the LIFF app is missing the `openid` scope.
      // Re-rendering the login screen here would loop forever, because login
      // succeeds and still yields no token - so surface it as an error.
      clearSession();
      renderError(root, new AppError(ErrorCode.MISSING_ID_TOKEN), { relogin: true });
      return;
    }

    const [profile, auth] = await Promise.all([
      getLineProfile(),
      authenticateWithLine(idToken)
    ]);

    setToken(auth.token ?? auth.access_token);
    setProfile(profile);

    const me = await fetchMe();
    renderHome(root, { profile, me });
  } catch (error) {
    const code = error instanceof AppError ? error.code : null;
    renderError(root, error, {
      retry: code === ErrorCode.BACKEND_UNAVAILABLE,
      relogin: code === ErrorCode.UNAUTHORIZED
    });
  }
}
