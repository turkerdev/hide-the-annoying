/**
 * Background Service Worker for Hide The Annoying
 * Manifest V3 compliant, modular ES Module
 */

import {
  getSettings,
  saveSettings,
  getStats,
  incrementStats,
  resetStats,
  getUserCache,
  setCachedDecision,
  clearUserCache,
  removeCachedUser
} from './lib/storage.js';

import { providerManager } from './lib/providers.js';

// Initialize extension defaults on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HideTheAnnoying] Extension installed/updated:', details.reason);
  await getSettings();
  await getStats();
  await getUserCache();
});

// Central message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const response = await handleMessage(message, sender);
      sendResponse({ success: true, data: response });
    } catch (err) {
      console.error('[HideTheAnnoying] Error handling message:', message.action, err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { action, payload } = message;

  switch (action) {
    case 'CHECK_USERS': {
      return await handleCheckUsers(payload || [], sender);
    }

    case 'GET_SETTINGS': {
      return await getSettings();
    }

    case 'SAVE_SETTINGS': {
      return await saveSettings(payload);
    }

    case 'GET_STATS': {
      return await getStats();
    }

    case 'RESET_STATS': {
      return await resetStats();
    }

    case 'GET_CACHED_USERS': {
      return await getUserCache();
    }

    case 'CLEAR_CACHE': {
      await clearUserCache();
      return { cleared: true };
    }

    case 'REMOVE_CACHED_USER': {
      await removeCachedUser(payload.handle);
      return { removed: payload.handle };
    }

    case 'ADD_ALLOWLIST': {
      const settings = await getSettings();
      const handle = (payload.handle || '').toLowerCase().replace(/^@/, '');
      const list = new Set(settings.allowlist || []);
      list.add(handle);
      const updated = await saveSettings({ allowlist: Array.from(list) });
      return updated.allowlist;
    }

    case 'REMOVE_ALLOWLIST': {
      const settings = await getSettings();
      const handle = (payload.handle || '').toLowerCase().replace(/^@/, '');
      const list = (settings.allowlist || []).filter(h => h.toLowerCase() !== handle);
      const updated = await saveSettings({ allowlist: list });
      return updated.allowlist;
    }

    case 'ADD_BLOCKLIST': {
      const settings = await getSettings();
      const handle = (payload.handle || '').toLowerCase().replace(/^@/, '');
      const list = new Set(settings.blocklist || []);
      list.add(handle);
      const updated = await saveSettings({ blocklist: Array.from(list) });
      return updated.blocklist;
    }

    case 'REMOVE_BLOCKLIST': {
      const settings = await getSettings();
      const handle = (payload.handle || '').toLowerCase().replace(/^@/, '');
      const list = (settings.blocklist || []).filter(h => h.toLowerCase() !== handle);
      const updated = await saveSettings({ blocklist: list });
      return updated.blocklist;
    }

    case 'TEST_CLASSIFICATION': {
      const settings = await getSettings();
      const context = payload.context;
      return await providerManager.classify(context, settings);
    }

    case 'UPDATE_BADGE': {
      if (sender.tab?.id) {
        const count = payload.count || 0;
        const text = count > 0 ? String(count) : '';
        await chrome.action.setBadgeText({ tabId: sender.tab.id, text });
        await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#e0245e' });
      }
      return true;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Handles batch user/tweet check request from content script
 * @param {Array<Object>} items - [{ id, handle, name, text, bio }]
 */
async function handleCheckUsers(items, sender) {
  const settings = await getSettings();
  if (!settings.enabled) {
    const results = {};
    for (const item of items) {
      const key = item.id || (item.handle || '').toLowerCase().replace(/^@/, '');
      results[key] = { isAnnoying: false, reason: 'Extension disabled' };
    }
    return results;
  }

  const cache = await getUserCache();
  const allowlist = new Set((settings.allowlist || []).map(h => h.toLowerCase().replace(/^@/, '')));
  const blocklist = new Set((settings.blocklist || []).map(h => h.toLowerCase().replace(/^@/, '')));

  const results = {};
  const uncachedItems = [];
  let cacheHits = 0;

  for (const item of items) {
    const handle = (item.handle || '').toLowerCase().replace(/^@/, '');
    const key = item.id || handle;
    if (!handle && !item.text) continue;

    // Check allowlist (handle-level override)
    if (handle && allowlist.has(handle)) {
      results[key] = {
        isAnnoying: false,
        reason: 'User is in Allowlist',
        category: 'allowlisted',
        handle
      };
      continue;
    }

    // Check manual blocklist (handle-level override)
    if (handle && blocklist.has(handle)) {
      results[key] = {
        isAnnoying: true,
        reason: 'User is manually blocklisted',
        category: 'blocklisted',
        confidence: 1.0,
        handle
      };
      continue;
    }

    // Check cache by unique key
    if (cache[key]) {
      results[key] = cache[key];
      cacheHits++;
    } else {
      uncachedItems.push({ ...item, key, handle });
    }
  }

  let providerCalls = 0;
  let newlyHidden = 0;

  // Process uncached items with active provider
  for (const item of uncachedItems) {
    try {
      const decision = await providerManager.classify(item, settings);
      providerCalls++;
      if (decision.isAnnoying) newlyHidden++;

      const saved = await setCachedDecision(item.key, decision);
      results[item.key] = saved;
    } catch (err) {
      console.error(`[HideTheAnnoying] Error classifying item ${item.key}:`, err);
      results[item.key] = {
        isAnnoying: false,
        reason: 'Classification error',
        error: err.message
      };
    }
  }

  // Update statistics
  await incrementStats({
    scannedCount: items.length,
    hiddenCount: newlyHidden,
    cacheHits,
    providerCalls
  });

  return results;
}
