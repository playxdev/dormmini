/**
 * Environment configuration.
 *
 * Only public values belong here. Channel secrets, messaging tokens and
 * signing keys live on the backend (DESIGN-LINE-MINI.md section 12).
 */

const env = import.meta.env;

export const config = Object.freeze({
  appEnv: env.VITE_APP_ENV ?? 'development',
  appUrl: env.VITE_APP_URL ?? window.location.origin,
  apiBaseUrl: (env.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
  liffId: env.VITE_LINE_LIFF_ID ?? '',
  mock: env.VITE_MOCK === '1',
  // Replaced at build time from package.json; 'dev' when a tool loads this
  // module outside a Vite build.
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
});

export function assertConfig() {
  // Mock mode runs the UI in a plain browser with no LIFF ID and no backend.
  if (config.mock) return [];

  const missing = [];
  if (!config.liffId || config.liffId.startsWith('<')) missing.push('VITE_LINE_LIFF_ID');
  if (!config.apiBaseUrl) missing.push('VITE_API_BASE_URL');
  return missing;
}
