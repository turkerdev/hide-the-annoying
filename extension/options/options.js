/**
 * Options Dashboard Logic for Hide The Annoying
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetId = item.dataset.tab;
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Elements
  const btnSaveAll = document.getElementById('btn-save-all');
  const saveStatus = document.getElementById('save-status');

  // Provider Inputs
  const optJevKey = document.getElementById('opt-jev-key');
  const optJevModel = document.getElementById('opt-jev-model');
  const optJevEndpoint = document.getElementById('opt-jev-endpoint');



  // Prompts
  const optPromptInstructions = document.getElementById('opt-prompt-instructions');
  const optPromptPolitics = document.getElementById('opt-prompt-politics');
  const optPromptSoccer = document.getElementById('opt-prompt-soccer');
  const optPromptFinance = document.getElementById('opt-prompt-finance');
  const btnResetPrompts = document.getElementById('btn-reset-prompts');

  // Topics & Rules
  const ruleCatSoccer = document.getElementById('rule-cat-soccer');
  const ruleCatFinance = document.getElementById('rule-cat-finance');
  const ruleCatPolitics = document.getElementById('rule-cat-politics');
  const ruleCatCustom = document.getElementById('rule-cat-custom');
  const optCustomKeywords = document.getElementById('opt-custom-keywords');
  const optSensitivity = document.getElementById('opt-sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');

  // Lists
  const newAllowInput = document.getElementById('new-allow-input');
  const btnAddAllow = document.getElementById('btn-add-allow');
  const allowlistBox = document.getElementById('allowlist-box');

  const newBlockInput = document.getElementById('new-block-input');
  const btnAddBlock = document.getElementById('btn-add-block');
  const blocklistBox = document.getElementById('blocklist-box');

  // Cache
  const cacheCountSpan = document.getElementById('cache-count');
  const cacheSearch = document.getElementById('cache-search');
  const cacheTableBody = document.getElementById('cache-table-body');
  const btnClearCache = document.getElementById('btn-clear-cache');

  // Backup
  const btnExportJson = document.getElementById('btn-export-json');
  const importFileInput = document.getElementById('import-file-input');

  let currentSettings = null;
  let userCacheData = {};

  // Load Initial Settings
  async function loadDashboard() {
    try {
      const [settingsRes, cacheRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ action: 'GET_CACHED_USERS' })
      ]);

      if (settingsRes && settingsRes.success) {
        currentSettings = settingsRes.data;
        populateSettings(currentSettings);
      }

      if (cacheRes && cacheRes.success) {
        userCacheData = cacheRes.data || {};
        renderCacheTable(userCacheData);
      }
    } catch (err) {
      console.error('[HideTheAnnoying] Error initializing options:', err);
    }
  }

  function populateSettings(s) {
    // Jev
    optJevKey.value = s.apiKeys?.jev || '';
    optJevModel.value = s.models?.jev || 'jev-latest';
    optJevEndpoint.value = s.endpoints?.jev || 'https://api.typesafe.ai/v1/systemone';
    // Prompts
    optPromptInstructions.value = s.prompts?.customInstructions || '';
    optPromptPolitics.value = s.prompts?.politicsCriteria || '';
    optPromptSoccer.value = s.prompts?.soccerCriteria || '';
    optPromptFinance.value = s.prompts?.financeCriteria || '';

    // Categories
    ruleCatSoccer.checked = Boolean(s.categories?.soccer);
    ruleCatFinance.checked = Boolean(s.categories?.finance);
    ruleCatPolitics.checked = Boolean(s.categories?.politics);
    ruleCatCustom.checked = Boolean(s.categories?.custom);

    // Custom Keywords
    optCustomKeywords.value = (s.customKeywords || []).join(', ');

    // Sensitivity
    const sens = typeof s.sensitivity === 'number' ? s.sensitivity : 0.6;
    optSensitivity.value = sens;
    updateSensitivityLabel(sens);

    // Render Lists
    renderAllowlist(s.allowlist || []);
    renderBlocklist(s.blocklist || []);
  }

  function updateSensitivityLabel(val) {
    const num = parseFloat(val);
    let label = 'Balanced';
    if (num <= 0.35) label = 'Aggressive';
    else if (num >= 0.8) label = 'Conservative';
    sensitivityValue.textContent = `${num.toFixed(2)} (${label})`;
  }

  optSensitivity.addEventListener('input', (e) => {
    updateSensitivityLabel(e.target.value);
  });

  // Render Allowlist
  function renderAllowlist(list) {
    allowlistBox.innerHTML = '';
    if (!list.length) {
      allowlistBox.innerHTML = '<span style="color:var(--text-secondary);font-size:12px;padding:4px;">No users whitelisted.</span>';
      return;
    }

    list.forEach(handle => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span class="handle-text">@${escapeHtml(handle)}</span>
        <button class="btn-remove" title="Remove">&times;</button>
      `;
      item.querySelector('.btn-remove').addEventListener('click', async () => {
        const res = await chrome.runtime.sendMessage({
          action: 'REMOVE_ALLOWLIST',
          payload: { handle }
        });
        if (res && res.success) {
          currentSettings.allowlist = res.data;
          renderAllowlist(res.data);
        }
      });
      allowlistBox.appendChild(item);
    });
  }

  // Render Blocklist
  function renderBlocklist(list) {
    blocklistBox.innerHTML = '';
    if (!list.length) {
      blocklistBox.innerHTML = '<span style="color:var(--text-secondary);font-size:12px;padding:4px;">No users manually blocked.</span>';
      return;
    }

    list.forEach(handle => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span class="handle-text" style="color:var(--danger-color)">@${escapeHtml(handle)}</span>
        <button class="btn-remove" title="Remove">&times;</button>
      `;
      item.querySelector('.btn-remove').addEventListener('click', async () => {
        const res = await chrome.runtime.sendMessage({
          action: 'REMOVE_BLOCKLIST',
          payload: { handle }
        });
        if (res && res.success) {
          currentSettings.blocklist = res.data;
          renderBlocklist(res.data);
        }
      });
      blocklistBox.appendChild(item);
    });
  }

  // Add Allowlist
  btnAddAllow.addEventListener('click', async () => {
    const handle = newAllowInput.value.trim().replace(/^@/, '');
    if (!handle) return;
    newAllowInput.value = '';

    const res = await chrome.runtime.sendMessage({
      action: 'ADD_ALLOWLIST',
      payload: { handle }
    });
    if (res && res.success) {
      currentSettings.allowlist = res.data;
      renderAllowlist(res.data);
    }
  });

  // Add Blocklist
  btnAddBlock.addEventListener('click', async () => {
    const handle = newBlockInput.value.trim().replace(/^@/, '');
    if (!handle) return;
    newBlockInput.value = '';

    const res = await chrome.runtime.sendMessage({
      action: 'ADD_BLOCKLIST',
      payload: { handle }
    });
    if (res && res.success) {
      currentSettings.blocklist = res.data;
      renderBlocklist(res.data);
    }
  });

  // Render Cache Table
  function renderCacheTable(cache, filter = '') {
    const entries = Object.entries(cache);
    cacheCountSpan.textContent = entries.length;

    const lowerFilter = filter.toLowerCase().trim();
    const filtered = entries.filter(([handle, data]) => {
      if (!lowerFilter) return true;
      return handle.toLowerCase().includes(lowerFilter) ||
        (data.category || '').toLowerCase().includes(lowerFilter) ||
        (data.reason || '').toLowerCase().includes(lowerFilter);
    });

    if (!filtered.length) {
      cacheTableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-secondary);padding:18px;">No users found in cache.</td></tr>`;
      return;
    }

    cacheTableBody.innerHTML = '';
    filtered.forEach(([key, data]) => {
      const tr = document.createElement('tr');
      const isAnnoying = Boolean(data.isAnnoying);
      const confPercent = Math.round((data.confidence || 0) * 100);
      const displayHandle = data.handle || key;

      tr.innerHTML = `
        <td><strong>@${escapeHtml(displayHandle)}</strong></td>
        <td><span class="badge-tag ${isAnnoying ? 'annoying' : 'clean'}">${isAnnoying ? 'Filtered' : 'Clean'}</span></td>
        <td>${escapeHtml(data.category || 'N/A')}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(data.reason || '')}">${escapeHtml(data.reason || 'N/A')}</td>
        <td>${confPercent}%</td>
        <td><button class="btn btn-secondary btn-sm remove-cache-btn" style="padding: 2px 8px; font-size: 11px;">Remove</button></td>
      `;

      tr.querySelector('.remove-cache-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({
          action: 'REMOVE_CACHED_USER',
          payload: { handle: displayHandle, tweetKey: key }
        });
        delete userCacheData[key];
        renderCacheTable(userCacheData, cacheSearch.value);
      });

      cacheTableBody.appendChild(tr);
    });
  }

  cacheSearch.addEventListener('input', (e) => {
    renderCacheTable(userCacheData, e.target.value);
  });

  btnClearCache.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all cached decisions?')) return;
    await chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' });
    userCacheData = {};
    renderCacheTable(userCacheData);
  });

  // Save All Changes
  btnSaveAll.addEventListener('click', async () => {
    btnSaveAll.disabled = true;
    btnSaveAll.textContent = 'Saving...';

    const customKwArray = optCustomKeywords.value
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    const payload = {
      activeProvider: 'jev',
      sensitivity: parseFloat(optSensitivity.value),
      categories: {
        soccer: ruleCatSoccer.checked,
        finance: ruleCatFinance.checked,
        politics: ruleCatPolitics.checked,
        custom: ruleCatCustom.checked
      },
      customKeywords: customKwArray,
      apiKeys: {
        jev: optJevKey.value.trim()
      },
      models: {
        jev: optJevModel.value.trim() || 'jev-latest'
      },
      endpoints: {
        jev: optJevEndpoint.value.trim() || 'https://api.typesafe.ai/v1/systemone'
      },
      prompts: {
        customInstructions: optPromptInstructions.value.trim(),
        politicsCriteria: optPromptPolitics.value.trim(),
        soccerCriteria: optPromptSoccer.value.trim(),
        financeCriteria: optPromptFinance.value.trim()
      }
    };

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        payload
      });
      if (res && res.success) {
        currentSettings = res.data;
        saveStatus.textContent = 'All changes saved successfully!';
        saveStatus.style.color = 'var(--success-color)';
        setTimeout(() => {
          saveStatus.textContent = 'All changes saved';
        }, 3000);
      }
    } catch (err) {
      saveStatus.textContent = `Error: ${err.message}`;
      saveStatus.style.color = 'var(--danger-color)';
    } finally {
      btnSaveAll.disabled = false;
      btnSaveAll.textContent = 'Save All Changes';
    }
  });

  // Reset Prompts Button
  btnResetPrompts.addEventListener('click', () => {
    if (!confirm('Reset all Jev prompts to default instructions?')) return;
    optPromptInstructions.value = "Which category does this content belong to? Determine whether it discusses politics, soccer/football, finance/crypto, or is a normal clean topic.";
    optPromptPolitics.value = "National, domestic, or international politics in any language: political figures, heads of state, politicians, ministers, candidates, or party leaders mentioned by full name, surname, initials, handles, or nicknames (e.g. Trump, Biden, Harris, Obama, Macron, Starmer, or Turkish political figures like Erdoğan / RTE, Kılıçdaroğlu / KK, Özdağ, İnce / @vekilince, Özel / ÖÖ, İmamoğlu, Yavaş); political parties and member affiliates (e.g. Democrats, Republicans, Tories, Labour, AKP, CHP, MHP, DEM, etc.); government ministries, state bureaucracy, public appointments; legislation, elections, campaigns, voting, protests, and partisan commentary, debate, or political satire.";
    optPromptSoccer.value = "Soccer, football, matches, transfers, clubs, leagues, tournaments, or players.";
    optPromptFinance.value = "Finance: credit cards, bank loans, debt, interest, cryptocurrency, Bitcoin, altcoins, memecoins, buying or selling crypto tokens or coins, stock market, NASDAQ, Wall Street, trading, forex, or financial hustle / get-rich-quick schemes. Explicitly do NOT classify AI/LLM tokens (such as LLM input/output tokens, API context window limits, token usage or exhaustion), AI agents, software development, coding, tech projects, Steam game sales, video game discounts, shopping deals, coupons, or everyday consumer purchases as finance.";
  });

  // Backup & Restore
  btnExportJson.addEventListener('click', async () => {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: currentSettings,
      userCache: userCacheData
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hide-the-annoying-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.settings) {
          await chrome.runtime.sendMessage({
            action: 'SAVE_SETTINGS',
            payload: imported.settings
          });
        }
        if (imported.userCache) {
          await chrome.storage.local.set({ userCache: imported.userCache });
        }
        alert('Configuration imported successfully!');
        window.location.reload();
      } catch (err) {
        alert('Invalid JSON file format: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  loadDashboard();
});
