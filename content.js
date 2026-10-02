/**
 * Content Script for Hide The Annoying on X/Twitter
 * Efficiently detects, filters, and collapses annoying users and tweets
 */

(() => {
  // Prevent duplicate injection
  if (window.__HIDE_THE_ANNOYING_INJECTED__) return;
  window.__HIDE_THE_ANNOYING_INJECTED__ = true;

  console.log('[HideTheAnnoying] Content script active on X/Twitter');

  let currentSettings = null;
  const localDecisionCache = new Map(); // Fast in-memory cache for this tab
  const filteredElements = new Set();
  let pendingBatch = [];
  let debounceTimeout = null;

  const CATEGORY_META = {
    soccer: { icon: '⚽', label: 'Football / Soccer' },
    finance: { icon: '📈', label: 'Finance / Crypto' },
    politics: { icon: '🏛️', label: 'Politics / Ragebait' },
    custom: { icon: '🚫', label: 'Custom Keyword' },
    blocklisted: { icon: '⛔', label: 'Blocklisted' },
    clean: { icon: '✅', label: 'Clean' }
  };

  /**
   * Initializes settings and starts observation
   */
  async function init() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
      if (response && response.success) {
        currentSettings = response.data;
      }
    } catch (err) {
      console.warn('[HideTheAnnoying] Could not load initial settings:', err);
    }

    // Initial scan
    scanPage();

    // Observe DOM changes (timeline updates, virtual scroll, infinite load, and React class overrides)
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          shouldScan = true;
        } else if (m.type === 'attributes' && m.attributeName === 'class') {
          // If Twitter's React wiped the collapsed class on hover or re-render, restore it immediately
          const target = m.target;
          if (target && target.dataset && target.dataset.htaCollapsed === 'true') {
            if (!target.classList.contains('hta-tweet-collapsed')) {
              target.classList.add('hta-tweet-collapsed');
            }
          }
        }
      }
      if (shouldScan) {
        queueScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    // Check profile page if applicable
    checkProfileHeader();
  }

  /**
   * Debounces page scans to prevent layout thrashing
   */
  function queueScan() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        scanPage();
      });
    }, 150);
  }

  /**
   * Scans current visible tweets
   */
  async function scanPage() {
    if (currentSettings && !currentSettings.enabled) return;

    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    if (!tweetArticles.length) return;

    const BATCH_SIZE = 15;
    const toAnalyze = [];

    for (let i = 0; i < tweetArticles.length; i++) {
      const article = tweetArticles[i];
      const tweetInfo = extractTweetInfo(article);
      if (!tweetInfo || (!tweetInfo.handle && !tweetInfo.text)) continue;

      const currentProcessedKey = article.dataset.htaKey;
      if (currentProcessedKey === tweetInfo.tweetKey && article.dataset.htaProcessed === 'true') {
        continue;
      }

      // Check fast in-memory cache by tweetKey
      if (localDecisionCache.has(tweetInfo.tweetKey)) {
        const decision = localDecisionCache.get(tweetInfo.tweetKey);
        applyDecisionToTweet(article, tweetInfo, decision);
      } else {
        toAnalyze.push({ ...tweetInfo, element: article });
      }

      // Batch yielding to maintain 60 FPS
      if (i > 0 && i % BATCH_SIZE === 0 && globalThis.scheduler?.yield) {
        await scheduler.yield();
      }
    }

    if (toAnalyze.length > 0) {
      enqueueForClassification(toAnalyze);
    }
  }

  /**
   * Simple hash for tweet text when tweet status ID is not in DOM
   */
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extracts handle, display name, tweet text, and unique tweetKey from article DOM
   */
  function extractTweetInfo(article) {
    const userContainer = article.querySelector('div[data-testid="User-Name"]');
    if (!userContainer) return null;

    // Find handle (e.g. text containing @username)
    let handle = null;
    const links = userContainer.querySelectorAll('a[role="link"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';
      if (href.startsWith('/') && !href.includes('/status/') && text.includes('@')) {
        const match = text.match(/@([A-Za-z0-9_]{1,20})/);
        if (match) {
          handle = match[1].toLowerCase();
          break;
        }
      }
    }

    // Fallback handle search
    if (!handle) {
      const match = userContainer.textContent.match(/@([A-Za-z0-9_]{1,20})/);
      if (match) handle = match[1].toLowerCase();
    }

    if (!handle) return null;

    // Display Name
    const nameEl = userContainer.querySelector('span');
    const name = nameEl ? nameEl.textContent.trim() : '';

    // Tweet Text
    const textEl = article.querySelector('div[data-testid="tweetText"]');
    const text = textEl ? textEl.innerText.trim() : '';

    // Unique tweet identifier: status ID if available, otherwise text hash
    const timeLink = article.querySelector('time')?.closest('a');
    const tweetHref = timeLink?.getAttribute('href') || '';
    const statusMatch = tweetHref.match(/status\/(\d+)/);
    const tweetId = statusMatch ? statusMatch[1] : null;
    const tweetKey = tweetId ? `tweet_${tweetId}` : `text_${handle}_${simpleHash(text)}`;

    return { handle, name, text, tweetId, tweetKey };
  }

  /**
   * Enqueues batch of tweets for classification via service worker
   */
  function enqueueForClassification(items) {
    pendingBatch.push(...items);
    processPendingQueue();
  }

  let isProcessingQueue = false;
  async function processPendingQueue() {
    if (isProcessingQueue || pendingBatch.length === 0) return;
    isProcessingQueue = true;

    const itemsToProcess = pendingBatch.splice(0, 20);
    const uniqueMap = new Map();
    for (const item of itemsToProcess) {
      if (!uniqueMap.has(item.tweetKey)) {
        uniqueMap.set(item.tweetKey, item);
      }
    }

    const payload = Array.from(uniqueMap.values()).map(u => ({
      id: u.tweetKey,
      handle: u.handle,
      name: u.name,
      text: u.text
    }));

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'CHECK_USERS',
        payload
      });

      if (response && response.success && response.data) {
        const decisions = response.data;
        for (const [key, decision] of Object.entries(decisions)) {
          localDecisionCache.set(key, decision);
        }

        // Apply decisions to elements in this batch
        for (const item of itemsToProcess) {
          const decision = decisions[item.tweetKey] || localDecisionCache.get(item.tweetKey);
          if (decision && item.element && document.body.contains(item.element)) {
            applyDecisionToTweet(item.element, item, decision);
          }
        }
      }
    } catch (err) {
      console.warn('[HideTheAnnoying] Batch check error:', err);
    } finally {
      isProcessingQueue = false;
      if (pendingBatch.length > 0) {
        setTimeout(processPendingQueue, 200);
      }
    }
  }

  /**
   * Applies the filtering treatment (collapse, hard hide, or badge) to a tweet article
   */
  function applyDecisionToTweet(article, tweetInfo, decision) {
    article.dataset.htaProcessed = 'true';
    article.dataset.htaHandle = tweetInfo.handle;
    article.dataset.htaKey = tweetInfo.tweetKey;

    // If user is allowlisted or not annoying
    if (!decision.isAnnoying) {
      removeFiltersFromTweet(article);
      filteredElements.delete(article);
      updateBadge();
      return;
    }

    filteredElements.add(article);
    updateBadge();

    const mode = currentSettings?.filterMode || 'collapse';
    const cat = decision.category || 'custom';
    const meta = CATEGORY_META[cat] || { icon: '⚠️', label: cat };

    if (mode === 'hide') {
      article.classList.add('hta-hard-hidden');
      article.classList.remove('hta-tweet-collapsed');
      delete article.dataset.htaCollapsed;
      removeBanner(article);
    } else if (mode === 'badge') {
      article.classList.remove('hta-hard-hidden', 'hta-tweet-collapsed');
      delete article.dataset.htaCollapsed;
      removeBanner(article);
      injectInlineBadge(article, cat, meta, decision.reason);
    } else {
      // Default: Soft Collapse
      article.classList.remove('hta-hard-hidden');
      article.classList.add('hta-tweet-collapsed');
      article.dataset.htaCollapsed = 'true';
      injectCollapsedBanner(article, tweetInfo.handle, cat, meta, decision.reason);
    }
  }

  /**
   * Injects the collapsed banner replacement
   */
  function injectCollapsedBanner(article, handle, category, meta, reason) {
    let banner = article.querySelector('.hta-collapsed-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'hta-collapsed-banner';

      // Prevent hover and pointer events on banner from bubbling up to Twitter's native listeners
      ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover'].forEach(eventType => {
        banner.addEventListener(eventType, (e) => {
          e.stopPropagation();
        });
      });

      article.prepend(banner);
    }

    banner.innerHTML = `
      <div class="hta-banner-info">
        <span class="hta-icon">${meta.icon}</span>
        <div class="hta-text">
          <span>Hidden annoying tweet by <span class="hta-handle">@${escapeHtml(handle)}</span></span>
          <span class="hta-category-tag hta-tag-${category}">${escapeHtml(meta.label)}</span>
        </div>
      </div>
      <div class="hta-banner-actions">
        <button class="hta-btn hta-btn-toggle" title="Toggle tweet view">Show</button>
        <button class="hta-btn hta-btn-allow" title="Always allow this user">Always Allow</button>
      </div>
    `;

    const toggleBtn = banner.querySelector('.hta-btn-toggle');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isCollapsed = article.dataset.htaCollapsed === 'true' || article.classList.contains('hta-tweet-collapsed');
      if (isCollapsed) {
        article.classList.remove('hta-tweet-collapsed');
        delete article.dataset.htaCollapsed;
        toggleBtn.textContent = 'Hide';
      } else {
        article.classList.add('hta-tweet-collapsed');
        article.dataset.htaCollapsed = 'true';
        toggleBtn.textContent = 'Show';
      }
    });

    const allowBtn = banner.querySelector('.hta-btn-allow');
    allowBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      allowBtn.disabled = true;
      allowBtn.textContent = 'Allowed';

      try {
        await chrome.runtime.sendMessage({
          action: 'ADD_ALLOWLIST',
          payload: { handle }
        });

        // Update local memory cache and unhide across page
        localDecisionCache.set(handle.toLowerCase(), {
          isAnnoying: false,
          reason: 'Allowlisted by user',
          category: 'allowlisted'
        });

        const matchingTweets = document.querySelectorAll(`article[data-hta-handle="${handle.toLowerCase()}"]`);
        matchingTweets.forEach(el => removeFiltersFromTweet(el));
      } catch (err) {
        console.error('[HideTheAnnoying] Error adding to allowlist:', err);
      }
    });
  }

  /**
   * Injects an inline badge in badge-only mode
   */
  function injectInlineBadge(article, category, meta, reason) {
    const userContainer = article.querySelector('div[data-testid="User-Name"]');
    if (!userContainer) return;

    let badge = userContainer.querySelector('.hta-inline-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = `hta-inline-badge hta-badge-${category}`;
      badge.title = reason || `Flagged for ${meta.label}`;
      badge.innerHTML = `${meta.icon} ${meta.label}`;
      userContainer.appendChild(badge);
    }
  }

  function removeFiltersFromTweet(article) {
    article.classList.remove('hta-hard-hidden', 'hta-tweet-collapsed');
    delete article.dataset.htaCollapsed;
    removeBanner(article);
    const badge = article.querySelector('.hta-inline-badge');
    if (badge) badge.remove();
  }

  function removeBanner(article) {
    const banner = article.querySelector('.hta-collapsed-banner');
    if (banner) banner.remove();
  }

  /**
   * Checks if user is currently viewing a profile page and renders alert banner
   */
  async function checkProfileHeader() {
    const path = window.location.pathname.replace(/^\//, '');
    const segments = path.split('/');
    const candidateHandle = segments[0]?.toLowerCase();

    // Check if valid profile handle (not home, explore, notifications, etc.)
    const reserved = ['home', 'explore', 'notifications', 'messages', 'settings', 'i', 'compose'];
    if (!candidateHandle || reserved.includes(candidateHandle) || segments.length > 2) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'CHECK_USERS',
        payload: [{ handle: candidateHandle, name: '', text: '' }]
      });

      if (response && response.data && response.data[candidateHandle]) {
        const decision = response.data[candidateHandle];
        if (decision.isAnnoying) {
          renderProfileWarning(candidateHandle, decision);
        }
      }
    } catch (err) {
      // Quiet fail on profile check
    }
  }

  function renderProfileWarning(handle, decision) {
    if (document.querySelector('.hta-profile-warning')) return;

    const meta = CATEGORY_META[decision.category] || { icon: '⚠️', label: decision.category };
    const banner = document.createElement('div');
    banner.className = 'hta-profile-warning';
    banner.innerHTML = `
      <div>
        <strong>🛡️ Hide The Annoying Alert:</strong>
        @${escapeHtml(handle)} is classified as <strong>${meta.icon} ${escapeHtml(meta.label)}</strong>.
        <em>(${escapeHtml(decision.reason)})</em>
      </div>
      <button class="hta-btn hta-btn-allow">Allow This User</button>
    `;

    const primaryCol = document.querySelector('div[data-testid="primaryColumn"]');
    if (primaryCol) {
      primaryCol.prepend(banner);

      banner.querySelector('.hta-btn-allow')?.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({
          action: 'ADD_ALLOWLIST',
          payload: { handle }
        });
        banner.remove();
      });
    }
  }

  /**
   * Updates tab action badge with count of hidden items
   */
  function updateBadge() {
    try {
      chrome.runtime.sendMessage({
        action: 'UPDATE_BADGE',
        payload: { count: filteredElements.size }
      });
    } catch (e) {
      // Extension context invalidated on reload
    }
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Listen for settings or cache changes from popup/options
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.settings || changes.userCache)) {
      if (changes.settings) currentSettings = changes.settings.newValue;
      // Invalidate memory cache & rescan
      localDecisionCache.clear();
      document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
        delete article.dataset.htaProcessed;
        delete article.dataset.htaKey;
      });
      scanPage();
    }
  });

  // Start initialization
  init();
})();
