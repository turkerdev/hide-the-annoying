/**
 * Storage and configuration management for Hide The Annoying
 */

export const DEFAULT_SETTINGS = {
  enabled: true,
  activeProvider: 'jev', // 'jev' | 'local'
  filterMode: 'collapse', // 'collapse' | 'hide' | 'badge'
  sensitivity: 0.6, // Decision threshold 0.0 - 1.0
  categories: {
    soccer: true,
    finance: true,
    politics: true,
    custom: false
  },
  customKeywords: [
    'crypto', 'memecoin', 'passive income', 'dropshipping', 'parliament'
  ],
  apiKeys: {
    jev: ''
  },
  endpoints: {
    jev: 'https://api.typesafe.ai/v1/systemone'
  },
  models: {
    jev: 'jev-latest'
  },
  prompts: {
    customInstructions: "Which category does this content belong to? Determine whether it discusses politics, soccer/football, finance/crypto, or is a normal clean topic.",
    politicsCriteria: "National or international politics in any language: political figures mentioned by name, surname, initials or handles (e.g. Erdoğan, İnce, Özdağ, ÖÖ, KK, RTE, @umitozdag, Trump); political parties (e.g. AKP, CHP, MHP, DEM, etc.) and party members/affiliates (e.g. AKP'li, CHP'li); government ministers, state bureaucracy, public appointments (KPSS); political alliances, protocols, elections, and political commentary or satire.",
    soccerCriteria: "Soccer, football, matches, transfers, clubs, leagues, tournaments, or players.",
    financeCriteria: "Finance: credit cards, bank loans, debt, interest, cryptocurrency, Bitcoin, buying or selling coins, stock market, NASDAQ, BIST, trading, forex, or financial hustle / get-rich-quick schemes. Explicitly do NOT classify Steam game sales, video game discounts, shopping deals, coupons, or everyday consumer purchases as finance."
  },
  allowlist: [], // handles that should never be hidden
  blocklist: []  // handles that should always be hidden
};

export const DEFAULT_STATS = {
  scannedCount: 0,
  hiddenCount: 0,
  cacheHits: 0,
  providerCalls: 0
};

/**
 * Retrieves the current settings merged with defaults
 */
export async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  if (!result.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    return { ...DEFAULT_SETTINGS };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...result.settings,
    categories: {
      ...DEFAULT_SETTINGS.categories,
      ...(result.settings.categories || {})
    },
    apiKeys: {
      ...DEFAULT_SETTINGS.apiKeys,
      ...(result.settings.apiKeys || {})
    },
    endpoints: {
      ...DEFAULT_SETTINGS.endpoints,
      ...(result.settings.endpoints || {})
    },
    models: {
      ...DEFAULT_SETTINGS.models,
      ...(result.settings.models || {})
    },
    prompts: {
      ...DEFAULT_SETTINGS.prompts,
      ...(result.settings.prompts || {})
    }
  };
}

/**
 * Updates settings
 */
export async function saveSettings(newSettings) {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };
  await chrome.storage.local.set({ settings: merged });
  return merged;
}

/**
 * Retrieves current performance stats
 */
export async function getStats() {
  const result = await chrome.storage.local.get('stats');
  return { ...DEFAULT_STATS, ...(result.stats || {}) };
}

/**
 * Increments given stats
 */
export async function incrementStats(increments) {
  const stats = await getStats();
  for (const [key, val] of Object.entries(increments)) {
    if (typeof stats[key] === 'number') {
      stats[key] += val;
    }
  }
  await chrome.storage.local.set({ stats });
  return stats;
}

/**
 * Resets all stats
 */
export async function resetStats() {
  await chrome.storage.local.set({ stats: DEFAULT_STATS });
  return DEFAULT_STATS;
}

/**
 * Retrieves cached user classifications
 */
export async function getUserCache() {
  const result = await chrome.storage.local.get('userCache');
  return result.userCache || {};
}

/**
 * Saves decision for a user handle into cache
 */
export async function setCachedDecision(handle, decision) {
  const normalized = handle.toLowerCase().replace(/^@/, '');
  const cache = await getUserCache();
  cache[normalized] = {
    ...decision,
    handle: normalized,
    timestamp: Date.now()
  };
  await chrome.storage.local.set({ userCache: cache });
  return cache[normalized];
}

/**
 * Clears all cached decisions
 */
export async function clearUserCache() {
  await chrome.storage.local.set({ userCache: {} });
}

/**
 * Removes a specific user from cache
 */
export async function removeCachedUser(handle) {
  const normalized = handle.toLowerCase().replace(/^@/, '');
  const cache = await getUserCache();
  delete cache[normalized];
  await chrome.storage.local.set({ userCache: cache });
}
