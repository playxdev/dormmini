/**
 * LINE-specific logic. Kept isolated so the rest of the app has no LIFF
 * dependency (DESIGN-LINE-MINI.md section 14).
 */

import liff from '@line/liff';
import { config } from '../app/config.js';
import { AppError, ErrorCode } from '../api/client.js';

const MOCK_PROFILE = {
  userId: 'U_mock_0000000000',
  displayName: 'น้องมาย',
  pictureUrl: null
};

let initialized = false;

export async function initLine() {
  if (config.mock) {
    initialized = true;
    return;
  }
  try {
    await liff.init({
      liffId: config.liffId,
      // Outside the LINE client, LIFF performs the login redirect itself
      // rather than leaving the app in a logged-out state.
      withLoginOnExternalBrowser: true
    });
    initialized = true;
  } catch (cause) {
    throw new AppError(ErrorCode.LIFF_INIT_FAILED, cause);
  }
}

export function isInClient() {
  if (config.mock) return false;
  return initialized && liff.isInClient();
}

export function isLoggedIn() {
  if (config.mock) return true;
  return initialized && liff.isLoggedIn();
}

export function login() {
  if (config.mock) return;
  // Returns to the current URL after the LINE login round trip.
  liff.login({ redirectUri: window.location.href });
}

/**
 * ID token for backend verification. Preferred over the access token:
 * it is signed by LINE and the backend can validate it offline.
 */
export function getIdToken() {
  if (config.mock) return 'mock-id-token';
  return liff.getIDToken();
}

export async function getLineProfile() {
  if (config.mock) return MOCK_PROFILE;
  try {
    return await liff.getProfile();
  } catch (cause) {
    throw new AppError(ErrorCode.LIFF_INIT_FAILED, cause);
  }
}

/**
 * Whether the 2D code reader can be used here.
 *
 * liff.scanCodeV2() needs iOS 14.3+, and inside the LINE client it works only
 * when the LIFF size is Full. Rather than predict the platform, ask LIFF —
 * it knows what this environment supports.
 */
export function canScanCode() {
  if (config.mock) return true;
  return initialized && typeof liff.scanCodeV2 === 'function' && liff.isApiAvailable('scanCodeV2');
}

/**
 * Opens the scanner and resolves with the scanned string, or null if the user
 * closed it without scanning.
 *
 * Throws only when the scanner could not open at all — most often because
 * "Scan QR" is not enabled for the LIFF app in the LINE Developers Console.
 */
export async function scanCode() {
  if (config.mock) return 'K7M9P4QX';
  const result = await liff.scanCodeV2();
  return result?.value ?? null;
}

export function closeWindow() {
  if (config.mock) return;
  if (liff.isInClient()) liff.closeWindow();
}
