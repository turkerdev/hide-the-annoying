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
    politicsCriteria: "National, domestic, or international politics in any language: political figures, heads of state, politicians, ministers, candidates, or party leaders mentioned by full name, surname, initials, handles, or nicknames (e.g. Trump, Biden, Harris, Obama, Macron, Starmer, or Turkish political figures like Erdoğan / RTE, Kılıçdaroğlu / KK, Özdağ, İnce / @vekilince, Özel / ÖÖ, İmamoğlu, Yavaş); political parties and member affiliates (e.g. Democrats, Republicans, Tories, Labour, AKP, CHP, MHP, DEM, etc.); government ministries, state bureaucracy, public appointments; legislation, elections, campaigns, voting, protests, and partisan commentary, debate, or political satire.",
    soccerCriteria: "Soccer, football, matches, transfers, clubs, leagues, tournaments, or players.",
    financeCriteria: "Finance: credit cards, bank loans, debt, interest, cryptocurrency, Bitcoin, altcoins, memecoins, buying or selling crypto tokens or coins, stock market, NASDAQ, Wall Street, trading, forex, or financial hustle / get-rich-quick schemes. Explicitly do NOT classify AI/LLM tokens (such as LLM input/output tokens, API context window limits, token usage or exhaustion), AI agents, software development, coding, tech projects, Steam game sales, video game discounts, shopping deals, coupons, or everyday consumer purchases as finance."
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

  const prompts = {
    ...DEFAULT_SETTINGS.prompts,
    ...(result.settings.prompts || {})
  };

  // Auto-migrate legacy default finance prompts lacking AI/LLM token disambiguation
  const oldFinanceDefaults = [
    "Finance, cryptocurrency, Bitcoin, stock market, trading, forex, or get-rich-quick schemes.",
    "Finance: credit cards, bank loans, debt, interest, cryptocurrency, Bitcoin, buying or selling tokens/coins, stock market, NASDAQ, Wall Street, trading, forex, or financial hustle / get-rich-quick schemes. Explicitly do NOT classify Steam game sales, video game discounts, shopping deals, coupons, or everyday consumer purchases as finance."
  ];
  if (oldFinanceDefaults.includes(prompts.financeCriteria)) {
    prompts.financeCriteria = DEFAULT_SETTINGS.prompts.financeCriteria;
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
    prompts
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
 * Saves decision for a user handle or tweet item into cache
 */
export async function setCachedDecision(key, decision) {
  const normalizedKey = (key || '').toLowerCase().replace(/^@/, '');
  const cache = await getUserCache();
  const handle = (decision.handle || normalizedKey).toLowerCase().replace(/^@/, '');
  cache[normalizedKey] = {
    ...decision,
    handle,
    key: normalizedKey,
    timestamp: Date.now()
  };
  await chrome.storage.local.set({ userCache: cache });
  return cache[normalizedKey];
}

/**
 * Clears all cached decisions
 */
export async function clearUserCache() {
  await chrome.storage.local.set({ userCache: {} });
}

/**
 * Removes a specific user or tweet decision from cache
 */
export async function removeCachedUser(handle, tweetKey = null) {
  const normalized = (handle || '').toLowerCase().replace(/^@/, '');
  const normKey = (tweetKey || '').toLowerCase();
  const cache = await getUserCache();

  for (const [k, v] of Object.entries(cache)) {
    const entryHandle = (v.handle || '').toLowerCase().replace(/^@/, '');
    if (k === normalized || (normKey && k === normKey)) {
      delete cache[k];
    } else if (normalized && (entryHandle === normalized || k.startsWith(`text_${normalized}_`))) {
      delete cache[k];
    }
  }

  await chrome.storage.local.set({ userCache: cache });
  return cache;
}
