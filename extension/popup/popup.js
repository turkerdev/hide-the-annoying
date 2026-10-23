/**
 * Popup Script for Hide The Annoying
 */

import {
  EMPTY_FREE_TIER,
  ensureOriginPermission,
  fetchFreeTierQuota,
  freeTierOrigin,
  ownApiKey,
  startGoogleSignIn
} from '../lib/freetier.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const masterToggle = document.getElementById('master-toggle');
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
  const ownKeyFold = document.getElementById('own-key');
  const freeTierSignedOut = document.getElementById('free-tier-signed-out');
  const freeTierSignedIn = document.getElementById('free-tier-signed-in');
  const freeTierEmail = document.getElementById('free-tier-email');
  const freeTierQuota = document.getElementById('free-tier-quota');
  const freeTierHint = document.getElementById('free-tier-hint');
  const freeTierError = document.getElementById('free-tier-error');
  const btnGoogleSignIn = document.getElementById('btn-google-sign-in');
  const btnSignOut = document.getElementById('btn-sign-out');

  const filterModeInputs = document.querySelectorAll('input[name="filterMode"]');
  const catSoccer = document.getElementById('cat-soccer');
  const catFinance = document.getElementById('cat-finance');
  const catPolitics = document.getElementById('cat-politics');
  const catCustom = document.getElementById('cat-custom');

  const statFiltered = document.getElementById('stat-filtered');
  const statChecked = document.getElementById('stat-checked');

  const btnOpenOptions = document.getElementById('btn-open-options');

  let settings = null;
  let painted = false;

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
        statFiltered.textContent = formatCount(statsRes.data.hiddenCount);
        statChecked.textContent = formatCount(statsRes.data.scannedCount);
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
    const ownKey = ownApiKey(settings);
    const tier = settings?.freeTier || EMPTY_FREE_TIER;
    const signedIn = Boolean(tier.session && Number(tier.expiresAt) > Date.now());
    apiKeyInput.value = settings?.apiKeys?.jev || '';
    if (!painted && ownKey) ownKeyFold.open = true;
    painted = true;

    freeTierSignedOut.hidden = signedIn;
    freeTierSignedIn.hidden = !signedIn;
    freeTierEmail.textContent = tier.email || '';

    freeTierHint.textContent = ownKey
      ? 'Your key is in use. Google sign-in is optional.'
      : 'Daily quota. Posts are read up to 1,000 characters.';

    if (ownKey && signedIn) {
      freeTierQuota.textContent = 'Using your key';
    } else if (signedIn) {
      freeTierQuota.textContent = 'Checking today’s quota…';
      refreshQuota(tier.session);
    } else {
      freeTierQuota.textContent = '';
    }
  }

  async function refreshQuota(session) {
    try {
      const quota = await fetchFreeTierQuota(freeTierOrigin(settings), session);
      if (!quota) {
        if (!ownApiKey(settings)) freeTierQuota.textContent = 'Could not reach the free tier';
        return;
      }
      if (quota.unauthorized) {
        settings = { ...settings, freeTier: { ...EMPTY_FREE_TIER } };
        await chrome.runtime.sendMessage({
          action: 'SAVE_SETTINGS',
          payload: { freeTier: EMPTY_FREE_TIER }
        });
        updateProviderKeyUI();
        return;
      }
      if (ownApiKey(settings)) return;
      freeTierQuota.textContent = `${quota.remaining} left today`;
    } catch {
      if (!ownApiKey(settings)) freeTierQuota.textContent = 'Could not reach the free tier';
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

  btnGoogleSignIn.addEventListener('click', async () => {
    freeTierError.textContent = '';
    btnGoogleSignIn.disabled = true;
    btnGoogleSignIn.textContent = 'Waiting for Google…';
    try {
      const origin = freeTierOrigin(settings);
      const allowed = await ensureOriginPermission(origin);
      if (!allowed) throw new Error('Free tier permission was declined');
      const account = await startGoogleSignIn(origin);
      const res = await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        payload: { freeTier: account }
      });
      if (res?.success) {
        settings = res.data;
        updateProviderKeyUI();
      }
    } catch (err) {
      freeTierError.textContent = err?.message || 'Sign-in failed';
    } finally {
      btnGoogleSignIn.disabled = false;
      btnGoogleSignIn.textContent = 'Continue with Google';
    }
  });

  btnSignOut.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({
      action: 'SAVE_SETTINGS',
      payload: { freeTier: EMPTY_FREE_TIER }
    });
    if (res?.success) {
      settings = res.data;
      updateProviderKeyUI();
    }
  });

  toggleKeyVisibility.addEventListener('click', () => {
    const showing = apiKeyInput.type === 'text';
    apiKeyInput.type = showing ? 'password' : 'text';
    toggleKeyVisibility.textContent = showing ? 'Show' : 'Hide';
  });

  filterModeInputs.forEach(input => input.addEventListener('change', saveCurrentSettings));
  [catSoccer, catFinance, catPolitics, catCustom].forEach(chk => chk.addEventListener('change', saveCurrentSettings));

  // Open Options Page
  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function formatCount(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  // Load initially
  loadData();
});
