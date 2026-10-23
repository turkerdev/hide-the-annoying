export const FREE_TIER_ORIGIN = 'https://api.hide-the-annoying.turker.dev';
export const FREE_TIER_MAX_CHARS = 1000;
export const OWN_KEY_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export const EMPTY_FREE_TIER = {
  session: '',
  email: '',
  expiresAt: 0
};

export function freeTierOrigin(settings) {
  const raw = (settings?.freeTierOrigin || FREE_TIER_ORIGIN).trim();
  return raw.replace(/\/$/, '');
}

export function ownApiKey(settings) {
  return (settings?.apiKeys?.jev || '').trim().replace(/^Bearer\s+/i, '');
}

/**
 * Own key wins. Otherwise a live Gmail session uses the free-tier proxy.
 */
export function resolveClassifierAuth(settings, now = Date.now()) {
  const ownKey = ownApiKey(settings);
  if (ownKey) {
    return {
      mode: 'own-key',
      apiKey: ownKey,
      endpoint: (settings?.endpoints?.jev || OWN_KEY_ENDPOINT).trim() || OWN_KEY_ENDPOINT
    };
  }

  const tier = settings?.freeTier;
  if (tier?.session && Number(tier.expiresAt) > now) {
    return {
      mode: 'free-tier',
      apiKey: tier.session,
      endpoint: `${freeTierOrigin(settings)}/v1/systemone`
    };
  }
  if (tier?.session) return { mode: 'expired' };
  return { mode: 'signed-out' };
}

export async function ensureOriginPermission(origin) {
  if (!chrome.permissions) return true;
  const pattern = `${new URL(origin).origin}/*`;
  if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

export async function startGoogleSignIn(origin) {
  const redirectUri = chrome.identity.getRedirectURL();
  const start = new URL('/auth/google/start', origin);
  start.searchParams.set('redirect_uri', redirectUri);
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: start.toString(),
    interactive: true
  });
  if (!responseUrl) throw new Error('Sign-in was cancelled');

  const params = new URLSearchParams(new URL(responseUrl).hash.replace(/^#/, ''));
  const error = params.get('error');
  if (error) throw new Error(error);

  const session = params.get('session') || '';
  const email = params.get('email') || '';
  const expiresAt = Number(params.get('expires_at'));
  if (!session || !email || !expiresAt) throw new Error('Sign-in did not return a session');
  return { session, email, expiresAt };
}

export async function fetchFreeTierQuota(origin, session) {
  const response = await fetch(`${origin}/auth/me`, {
    headers: { Authorization: `Bearer ${session}` }
  });
  if (response.status === 401) return { unauthorized: true };
  if (!response.ok) return null;
  return response.json();
}
