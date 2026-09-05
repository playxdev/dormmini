/**
 * HTTPS client for the dorm.place backend.
 *
 * Raw API errors, stack traces and tokens are never surfaced to the UI
 * (DESIGN-LINE-MINI.md section 16). Callers receive an AppError carrying a
 * stable `code` that the pages translate into Thai copy.
 */

import { config } from '../app/config.js';
import { getToken } from '../auth/session.js';

export class AppError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export const ErrorCode = {
  BACKEND_UNAVAILABLE: 'BACKEND_UNAVAILABLE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  INVITE_ALREADY_CLAIMED: 'INVITE_ALREADY_CLAIMED',
  MISSING_ID_TOKEN: 'MISSING_ID_TOKEN',
  LIFF_INIT_FAILED: 'LIFF_INIT_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID'
};

const TIMEOUT_MS = 15000;

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (!token) throw new AppError(ErrorCode.UNAUTHORIZED);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (cause) {
    // Network failure, DNS failure, CORS rejection or timeout.
    throw new AppError(ErrorCode.BACKEND_UNAVAILABLE, cause);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError(ErrorCode.UNAUTHORIZED);
  }
  if (response.status === 404) {
    throw new AppError(ErrorCode.TENANT_NOT_FOUND);
  }
  if (response.status === 409) {
    throw new AppError(ErrorCode.INVITE_ALREADY_CLAIMED);
  }
  if (!response.ok) {
    throw new AppError(ErrorCode.BACKEND_UNAVAILABLE, `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch (cause) {
    throw new AppError(ErrorCode.BACKEND_UNAVAILABLE, cause);
  }
}

const MOCK_AUTH = { token: 'mock-session-token' };

const MOCK_INVOICES = {
  outstanding_satang: 525000,
  invoices: [
    {
      id: 'inv_2025_09', period: '2025-09', due_date: '2025-09-05',
      status: 'open', total_satang: 525000, paid_satang: 0, due_satang: 525000,
      property_name: 'Oscar Apartment', room_code: 'A-203'
    },
    {
      id: 'inv_2025_08', period: '2025-08', due_date: '2025-08-05',
      status: 'open', total_satang: 517000, paid_satang: 517000, due_satang: 0,
      property_name: 'Oscar Apartment', room_code: 'A-203'
    }
  ]
};

const MOCK_REPAIRS = {
  repairs: [
    { id: 'r1', title: 'แอร์ไม่เย็น', detail: '', priority: 'normal',
      status: 'in_progress', created_at: '2026-09-01 10:30:00' },
    { id: 'r2', title: 'ก๊อกน้ำรั่ว', detail: '', priority: 'urgent',
      status: 'done', created_at: '2026-08-28 14:20:00' }
  ]
};

const MOCK_INVITE = {
  code: 'K7M9P4QX',
  building_name: 'Oscar Apartment',
  room_number: '609',
  tenant_name: 'หอมนภา ทดสอบ',
  rent_satang: 450000,
  deposit_satang: 900000,
  start_date: '2026-10-01',
  already_claimed: false,
  claimed_by_self: false
};

const MOCK_ANNOUNCEMENTS = {
  unread_count: 1,
  announcements: [
    {
      id: 'a1', title: 'น้ำประปาหยุดไหล 6 ก.ย. 09:00–15:00',
      body: 'เรียนผู้เช่าทุกท่าน\nการประปาจะปิดซ่อมท่อเมนหน้าอาคาร วันที่ 6 ก.ย. เวลา 09:00–15:00 น. กรุณาสำรองน้ำใช้ไว้ล่วงหน้า',
      pinned: true, read: false, published_at: '2026-09-04 08:00:00',
      property_id: 'P001', property_name: 'Oscar Apartment'
    },
    {
      id: 'a2', title: 'เปลี่ยนเวลาเก็บขยะเป็น 18:00',
      body: 'ตั้งแต่เดือนหน้าเป็นต้นไป รถขยะจะเข้าเวลา 18:00 ของทุกวันจันทร์ พุธ ศุกร์',
      pinned: false, read: true, published_at: '2026-08-20 12:30:00',
      property_id: 'P001', property_name: 'Oscar Apartment'
    }
  ]
};

const MOCK_METERS = {
  meters: [
    { period: '2026-09', kind: 'water', previous: 128, current: 135, used: 7, recorded_at: '2026-09-30 09:05:00', room_number: 'A-203' },
    { period: '2026-09', kind: 'electric', previous: 4512, current: 4720, used: 208, recorded_at: '2026-09-30 09:06:00', room_number: 'A-203' },
    { period: '2026-08', kind: 'water', previous: 120, current: 128, used: 8, recorded_at: '2026-08-31 09:10:00', room_number: 'A-203' },
    { period: '2026-08', kind: 'electric', previous: 4300, current: 4512, used: 212, recorded_at: '2026-08-31 09:11:00', room_number: 'A-203' }
  ]
};

const MOCK_ME = {
  user_id: 'U001',
  tenant_id: 'T001',
  property_id: 'P001',
  property_name: 'Oscar Apartment',
  room_id: 'A-203'
};

/**
 * Exchange a LINE ID token for a dorm.place session token.
 * The backend verifies the ID token against LINE and resolves the user.
 */
export function authenticateWithLine(idToken) {
  if (config.mock) return Promise.resolve(MOCK_AUTH);
  return request('/api/v1/auth/line', {
    method: 'POST',
    auth: false,
    body: { id_token: idToken }
  });
}

/**
 * Authenticated user with resolved tenant/property/room context.
 * The server derives these from the session - the client never sends them.
 */
export function fetchMe() {
  if (config.mock) {
    // ?unlinked=1 in mock mode drives the onboarding screens, which are
    // otherwise unreachable without a real unclaimed account.
    if (new URLSearchParams(window.location.search).has('unlinked')) {
      return Promise.reject(new AppError(ErrorCode.TENANT_NOT_FOUND));
    }
    return Promise.resolve(MOCK_ME);
  }
  return request('/api/v1/me');
}

/**
 * Invoices for the signed-in tenant's tenancy.
 *
 * Amounts arrive as integer satang; `src/lib/format.js` turns them into the
 * baht string the tenant sees.
 */
export function fetchInvoices() {
  if (config.mock) return Promise.resolve(MOCK_INVOICES);
  return request('/api/v1/me/invoices');
}

export function fetchInvoice(id) {
  if (config.mock) {
    const invoice = MOCK_INVOICES.invoices.find((i) => i.id === id);
    return Promise.resolve({
      ...invoice,
      items: [
        { kind: 'rent', description: 'ค่าเช่า', amount_satang: 450000 },
        { kind: 'water', description: 'ค่าน้ำ', amount_satang: 30000 },
        { kind: 'electricity', description: 'ค่าไฟ', amount_satang: 45000 }
      ],
      payments: []
    });
  }
  return request(`/api/v1/me/invoices/${encodeURIComponent(id)}`);
}

/** Repair requests for the signed-in tenant's tenancy. */
export function fetchRepairs() {
  if (config.mock) return Promise.resolve(MOCK_REPAIRS);
  return request('/api/v1/me/repairs');
}

export function fetchRepair(id) {
  if (config.mock) {
    return Promise.resolve({ ...MOCK_REPAIRS.repairs.find((r) => r.id === id), events: [] });
  }
  return request(`/api/v1/me/repairs/${encodeURIComponent(id)}`);
}

export function createRepair(payload) {
  if (config.mock) return Promise.resolve({ id: 'mock', status: 'open', ...payload });
  return request('/api/v1/me/repairs', { method: 'POST', body: payload });
}

/**
 * The terms behind an invite code, for the tenant to review before confirming.
 *
 * Requires a session: knowing who is looking is what separates "you already
 * linked this room" from "someone else did".
 */
export function fetchInvite(code) {
  if (config.mock) return Promise.resolve(MOCK_INVITE);
  return request(`/api/v1/invites/${encodeURIComponent(code)}`);
}

/**
 * Confirms an invite and binds the caller to the room.
 *
 * Carries no terms of its own — what was agreed is copied from the contract
 * server-side, so a confirmation cannot be replayed with different numbers than
 * the ones that were shown.
 */
export function claimInvite(code) {
  if (config.mock) return Promise.resolve({ status: 'claimed' });
  return request(`/api/v1/invites/${encodeURIComponent(code)}/claim`, { method: 'POST' });
}

/** PromptPay payloads for one invoice: the full amount, and an open one. */
export function fetchPaymentInfo(invoiceID) {
  if (config.mock) {
    return Promise.resolve({
      invoice_id: invoiceID,
      due_satang: 525000,
      promptpay_name: 'OSCAR APARTMENT',
      payload_full: '00020101021229370016A000000677010111011300668123456785802TH530376454075250.0063045311',
      payload_open: '00020101021129370016A000000677010111011300668123456785802TH530376463045D82',
      accepts_partial: true
    });
  }
  return request(`/api/v1/me/invoices/${encodeURIComponent(invoiceID)}/payment`);
}

/**
 * Tells the server what the tenant says they transferred.
 *
 * A claim, not a fact: the money went to the owner's bank and nothing here can
 * observe it. The owner verifies before it counts against the invoice.
 */
export function reportPayment(invoiceID, payload) {
  if (config.mock) return Promise.resolve({ status: 'pending_verification' });
  return request(`/api/v1/me/invoices/${encodeURIComponent(invoiceID)}/payments`, {
    method: 'POST',
    body: payload
  });
}

/**
 * The notice board of every building the tenant rents in.
 *
 * `unread_count` comes from the server rather than being counted here, so the
 * badge on the home screen agrees with the list even when the list is not
 * loaded.
 */
export function fetchAnnouncements() {
  if (config.mock) return Promise.resolve(MOCK_ANNOUNCEMENTS);
  return request('/api/v1/me/announcements');
}

export function fetchAnnouncement(id) {
  if (config.mock) {
    return Promise.resolve(MOCK_ANNOUNCEMENTS.announcements.find((a) => a.id === id));
  }
  return request(`/api/v1/me/announcements/${encodeURIComponent(id)}`);
}

/**
 * Marks a notice as opened.
 *
 * Fire and forget: the tenant has already read it, and a failed mark must
 * never keep the text off the screen. Repeating it is a no-op server-side.
 */
export function markAnnouncementRead(id) {
  if (config.mock) return Promise.resolve({ status: 'read' });
  return request(`/api/v1/me/announcements/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

/** Water and electricity readings taken during this tenancy. */
export function fetchMeters() {
  if (config.mock) return Promise.resolve(MOCK_METERS);
  return request('/api/v1/me/meters');
}
