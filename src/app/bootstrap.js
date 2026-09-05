/**
 * Application bootstrap (DESIGN-LINE-MINI.md section 6).
 *
 *   config -> LIFF init -> login state -> LINE identity
 *   -> backend auth -> tenant/property/room -> home
 */

import { config, assertConfig } from './config.js';
import { initLine, isLoggedIn, login, getIdToken, getLineProfile, closeWindow, scanCode } from '../auth/line.js';
import {
  authenticateWithLine, fetchMe, fetchInvoices, fetchInvoice,
  fetchRepairs, fetchRepair, createRepair,
  fetchInvite, claimInvite,
  fetchPaymentInfo, reportPayment,
  fetchAnnouncements, fetchAnnouncement, markAnnouncementRead,
  fetchMeters,
  AppError, ErrorCode
} from '../api/client.js';
import { setToken, setProfile, clearSession } from '../auth/session.js';
import { renderLogin } from '../pages/login.js';
import { renderHome } from '../pages/home.js';
import { renderBills, renderBillDetail } from '../pages/bills.js';
import { renderRepairs, renderRepairDetail, renderRepairForm } from '../pages/repairs.js';
import { renderUnlinked, renderInviteReview } from '../pages/onboarding.js';
import { renderPayment } from '../pages/payment.js';
import { renderAnnouncements, renderAnnouncement } from '../pages/announcements.js';
import { renderMeters } from '../pages/meters.js';
import { renderMenu } from '../pages/menu.js';

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

    let me;
    try {
      me = await fetchMe();
    } catch (error) {
      // Authenticated but not linked to a room. That is not a failure — it is
      // the state every new tenant starts in, and the app's job is to offer the
      // way out of it rather than an error.
      if (error instanceof AppError && error.code === ErrorCode.TENANT_NOT_FOUND) {
        startOnboarding(root);
        return;
      }
      throw error;
    }

    // Billing and the unread count are fetched alongside the identity because
    // the home screen leads with both. A failure in either must not blank the
    // screen: knowing your room is still worth showing when the balance or the
    // notice board is unavailable.
    const [billing, notices] = await Promise.all([
      fetchInvoices().catch((error) => {
        console.warn('[dorm.place] billing unavailable', error);
        return null;
      }),
      fetchAnnouncements().catch((error) => {
        console.warn('[dorm.place] announcements unavailable', error);
        return null;
      })
    ]);

    startRouter(root, { profile, me, billing, unread: notices?.unread_count ?? 0 });
  } catch (error) {
    const code = error instanceof AppError ? error.code : null;
    renderError(root, error, {
      retry: code === ErrorCode.BACKEND_UNAVAILABLE,
      relogin: code === ErrorCode.UNAUTHORIZED
    });
  }
}

/**
 * Screen routing.
 *
 * The MINI App is a handful of screens reached by tapping, and LIFF owns the
 * URL, so a history-based router would fight it. A view name plus a parameter
 * is enough.
 */
function startRouter(root, session) {
  const navigate = async (view, param) => {
    if (view === 'home') {
      renderHome(root, session, navigate);
      return;
    }

    if (view === 'menu') {
      renderMenu(root, {
        profile: session.profile,
        me: session.me,
        unread: session.unread,
        version: config.version
      }, navigate);
      return;
    }

    if (view === 'announcements') {
      renderLoading(root);
      try {
        const notices = await fetchAnnouncements();
        session.unread = notices.unread_count ?? 0;
        renderAnnouncements(root, notices, navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'announcement') {
      renderLoading(root);
      try {
        const announcement = await fetchAnnouncement(param);
        renderAnnouncement(root, announcement, navigate);

        // Marking follows the render, and its failure is swallowed: the tenant
        // has read the notice either way, and an unread badge that lingers is
        // a smaller wrong than a notice that will not open.
        if (!announcement.read) {
          markAnnouncementRead(param)
            .then(() => { session.unread = Math.max(0, (session.unread ?? 1) - 1); })
            .catch((error) => console.warn('[dorm.place] mark read failed', error));
        }
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'meters') {
      renderLoading(root);
      try {
        renderMeters(root, await fetchMeters(), navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'scan') {
      // A tenant who already has a room can still be handed a second one — a
      // move, or a second rental. The onboarding screens own that flow, so
      // this hands off to them rather than repeating the review and confirm.
      try {
        const value = await scanCode();
        if (!value) return;
        const match = String(value).match(/[A-Za-z0-9]{8}$/);
        const code = (match ? match[0] : String(value)).toUpperCase();
        renderLoading(root);
        const invite = await fetchInvite(code);
        renderInviteReview(root, invite, {
          onBack: () => navigate('home'),
          onConfirm: async () => {
            await claimInvite(code);
            await start(root);
          }
        });
      } catch (error) {
        console.error('[dorm.place] scan failed', error);
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'bills') {
      // Re-fetched on entry rather than reusing the copy taken at startup, so
      // an invoice issued while the app was open is not missed.
      try {
        const billing = await fetchInvoices();
        session.billing = billing;
        renderBills(root, billing, navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'bill') {
      try {
        renderBillDetail(root, await fetchInvoice(param), navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'pay') {
      renderLoading(root);
      try {
        const [invoice, info] = await Promise.all([
          fetchInvoice(param),
          fetchPaymentInfo(param)
        ]);
        renderPayment(root, { invoice, info }, {
          onBack: () => navigate('bill', param),
          onReport: async (payload) => {
            await reportPayment(param, payload);
            // Back to the invoice, where the pending notice now appears. The
            // balance deliberately does not move: it is not paid until the
            // owner verifies it.
            await navigate('bill', param);
          }
        });
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'repairs') {
      try {
        renderRepairs(root, await fetchRepairs(), navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'repair') {
      try {
        renderRepairDetail(root, await fetchRepair(param), navigate);
      } catch (error) {
        renderError(root, error, { retry: true });
      }
      return;
    }

    if (view === 'repair-new') {
      renderRepairForm(root, navigate, async (payload) => {
        const repair = await createRepair(payload);
        // Straight to the new request rather than back to the list, so the
        // tenant sees the reference number they will quote to staff.
        await navigate('repair', repair.id);
      });
    }
  };

  navigate('home');
}

/**
 * Reads an invite code the app was opened with.
 *
 * LIFF forwards query parameters from the permanent link through to the
 * endpoint, so `miniapp.line.me/<liffId>?invite=CODE` arrives here intact. It
 * is the entry path for tenants who cannot scan — old iOS, desktop, or simply
 * not standing in front of the owner.
 */
function inviteCodeFromUrl() {
  const code = new URLSearchParams(window.location.search).get('invite');
  return code ? code.trim().toUpperCase() : null;
}

/**
 * Screens for a tenant whose account is not linked to a room yet.
 */
function startOnboarding(root) {
  const review = async (code) => {
    renderLoading(root);
    try {
      const invite = await fetchInvite(code);
      renderInviteReview(root, invite, {
        onBack: () => startOnboarding(root),
        onConfirm: async () => {
          await claimInvite(code);
          // Restart rather than render the home screen directly: the whole
          // session context changed, and start() is the one place that builds
          // it.
          await start(root);
        }
      });
    } catch (error) {
      const code = error instanceof AppError ? error.code : null;
      if (code === ErrorCode.TENANT_NOT_FOUND) {
        // The invite is unknown, expired or revoked. All three are the same
        // thing to the tenant: this code will not work, ask the owner.
        renderUnlinkedWith(root, 'รหัสนี้ใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่จากผู้ดูแลหอพัก');
        return;
      }
      if (code === ErrorCode.INVITE_ALREADY_CLAIMED) {
        renderUnlinkedWith(root, 'ห้องนี้ถูกผูกกับบัญชีอื่นไปแล้ว กรุณาติดต่อผู้ดูแลหอพัก');
        return;
      }
      renderError(root, error, { retry: true });
    }
  };

  const actions = {
    onCode: review,
    onScan: async () => {
      try {
        const value = await scanCode();
        if (!value) return;
        // The QR may hold a bare code or the permanent link containing one.
        const match = String(value).match(/[A-Za-z0-9]{8}$/);
        await review((match ? match[0] : value).toUpperCase());
      } catch (error) {
        // Almost always "Scan QR" not being enabled for the LIFF app.
        console.error('[dorm.place] scan failed', error);
        renderUnlinkedWith(root, 'เปิดกล้องไม่สำเร็จ กรุณากรอกรหัสแทน');
      }
    }
  };

  renderUnlinked(root, actions);

  const code = inviteCodeFromUrl();
  if (code) review(code);

  function renderUnlinkedWith(target, message) {
    renderUnlinked(target, actions);
    const error = target.querySelector('#onboard-error');
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }
}
