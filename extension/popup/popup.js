/**
 * Popup Script for Hide The Annoying
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const masterToggle = document.getElementById('master-toggle');
  const providerStatus = document.getElementById('provider-status');
  const apiKeyContainer = document.getElementById('api-key-container');
  const apiKeyLabel = document.getElementById('api-key-label');
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKeyHelp = document.getElementById('api-key-help');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');

  const filterModeInputs = document.querySelectorAll('input[name="filterMode"]');
  const catSoccer = document.getElementById('cat-soccer');
  const catFinance = document.getElementById('cat-finance');
  const catPolitics = document.getElementById('cat-politics');
  const catCustom = document.getElementById('cat-custom');

  const statScanned = document.getElementById('stat-scanned');
  const statFiltered = document.getElementById('stat-filtered');
  const statCache = document.getElementById('stat-cache');

  const testHandle = document.getElementById('test-handle');
  const testText = document.getElementById('test-text');
  const btnRunTest = document.getElementById('btn-run-test');
  const testResult = document.getElementById('test-result');

  const btnOpenOptions = document.getElementById('btn-open-options');

  let settings = null;

  // Load current settings and statistics
  async function loadData() {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ action: 'GET_STATS' })
      ]);

      if (settingsRes && settingsRes.success) {
        settings = settingsRes.data;
        applySettingsToUI();
      }

      if (statsRes && statsRes.success) {
        const stats = statsRes.data;
        statScanned.textContent = stats.scannedCount || 0;
        statFiltered.textContent = stats.hiddenCount || 0;
        statCache.textContent = stats.cacheHits || 0;
      }
    } catch (err) {
      console.error('[HideTheAnnoying] Error loading popup data:', err);
    }
  }

  function applySettingsToUI() {
    if (!settings) return;

    masterToggle.checked = Boolean(settings.enabled);

    // Filter Mode
    filterModeInputs.forEach(input => {
      input.checked = input.value === (settings.filterMode || 'collapse');
    });

    // Categories
    catSoccer.checked = Boolean(settings.categories?.soccer);
    catFinance.checked = Boolean(settings.categories?.finance);
    catPolitics.checked = Boolean(settings.categories?.politics);
    catCustom.checked = Boolean(settings.categories?.custom);

    updateProviderKeyUI();
  }

  function updateProviderKeyUI() {
    apiKeyInput.value = settings?.apiKeys?.jev || '';
    const currentKey = apiKeyInput.value.trim();
    if (currentKey) {
      providerStatus.textContent = 'Jev Active';
      providerStatus.className = 'badge';
    } else {
      providerStatus.textContent = 'Key Required';
      providerStatus.className = 'badge warn';
    }
  }

  async function saveCurrentSettings() {
    const updated = {
      enabled: masterToggle.checked,
      activeProvider: 'jev',
      filterMode: document.querySelector('input[name="filterMode"]:checked')?.value || 'collapse',
      categories: {
        soccer: catSoccer.checked,
        finance: catFinance.checked,
        politics: catPolitics.checked,
        custom: catCustom.checked
      },
      apiKeys: {
        ...(settings?.apiKeys || {}),
        jev: apiKeyInput.value.trim()
      }
    };

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        payload: updated
      });
      if (res && res.success) {
        settings = res.data;
        updateProviderKeyUI();
      }
    } catch (err) {
      console.error('[HideTheAnnoying] Failed to save settings:', err);
    }
  }

  // Event Listeners
  masterToggle.addEventListener('change', saveCurrentSettings);

  apiKeyInput.addEventListener('blur', saveCurrentSettings);
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      apiKeyInput.blur();
    }
  });

  toggleKeyVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyVisibility.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyVisibility.textContent = '👁️';
    }
  });

  filterModeInputs.forEach(input => input.addEventListener('change', saveCurrentSettings));
  [catSoccer, catFinance, catPolitics, catCustom].forEach(chk => chk.addEventListener('change', saveCurrentSettings));

  // Sandbox Tester
  btnRunTest.addEventListener('click', async () => {
    const handle = testHandle.value.trim();
    const text = testText.value.trim();

    if (!handle && !text) {
      testResult.style.display = 'block';
      testResult.innerHTML = '<span style="color:var(--danger-color)">Please enter at least a handle or tweet text to test.</span>';
      return;
    }

    // Ensure host permission if custom endpoint
    const endpoint = settings?.endpoints?.jev;
    if (endpoint && chrome.permissions) {
      try {
        const url = new URL(endpoint);
        const originPattern = `${url.origin}/*`;
        const hasPerm = await chrome.permissions.contains({ origins: [originPattern] });
        if (!hasPerm) {
          await chrome.permissions.request({ origins: [originPattern] });
        }
      } catch (_) {}
    }

    btnRunTest.disabled = true;
    btnRunTest.textContent = 'Evaluating...';
    testResult.style.display = 'block';
    testResult.innerHTML = '<em>Consulting decision model...</em>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TEST_CLASSIFICATION',
        payload: {
          context: {
            handle: handle.replace(/^@/, ''),
            text,
            name: handle
          }
        }
      });

      if (response && response.success) {
        const d = response.data;
        const tagClass = d.isAnnoying ? 'annoying' : 'clean';
        const tagText = d.isAnnoying ? `ANNOYING (${d.category?.toUpperCase()})` : 'CLEAN';
        const confPercent = Math.round((d.confidence || 0) * 100);

        testResult.innerHTML = `
          <div><span class="result-tag ${tagClass}">${tagText}</span> <strong>Confidence: ${confPercent}%</strong></div>
          <div style="margin-top: 4px;"><strong>Reason:</strong> ${escapeHtml(d.reason || 'N/A')}</div>
          <div style="margin-top: 2px; color: var(--text-secondary); font-size: 10px;">Provider: ${escapeHtml(d.provider || 'unknown')}</div>
        `;
      } else {
        testResult.innerHTML = `<span style="color:var(--danger-color)">Error: ${escapeHtml(response?.error || 'Failed')}</span>`;
      }
    } catch (err) {
      testResult.innerHTML = `<span style="color:var(--danger-color)">Request failed: ${escapeHtml(err.message)}</span>`;
    } finally {
      btnRunTest.disabled = false;
      btnRunTest.textContent = 'Run Decision Test';
    }
  });

  // Clear Cache Button
  const btnQuickClearCache = document.getElementById('btn-quick-clear-cache');
  btnQuickClearCache?.addEventListener('click', async () => {
    btnQuickClearCache.textContent = 'Clearing...';
    try {
      await chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' });
      statCache.textContent = '0';
      btnQuickClearCache.textContent = 'Cleared!';
    } catch (e) {
      btnQuickClearCache.textContent = 'Error';
    }
    setTimeout(() => {
      btnQuickClearCache.textContent = 'Clear';
    }, 1500);
  });

  // Open Options Page
  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Load initially
  loadData();
});
