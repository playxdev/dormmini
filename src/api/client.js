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
  if (config.mock) return Promise.resolve(MOCK_ME);
  return request('/api/v1/me');
}
