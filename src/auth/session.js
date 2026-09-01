/**
 * Session storage for the dorm.place backend token.
 *
 * sessionStorage is used rather than localStorage: a MINI App session ends
 * when the LIFF window closes, and the token should not outlive it.
 */

const TOKEN_KEY = 'dormplace.token';

let cachedProfile = null;

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable - nothing to clear */
  }
  cachedProfile = null;
}

export function setProfile(profile) {
  cachedProfile = profile;
}

export function getProfile() {
  return cachedProfile;
}
