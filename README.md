# Hide The Annoying — X / Twitter AI Content Filter

A modern Chrome Extension (Manifest V3) that detects and filters out annoying X/Twitter users and posts — especially those talking about **soccer/football**, **crypto/finance**, or **toxic politics** — using the **TypeSafe Jev** System One decision model.

---

## ⚡ Features

- 🛡️ **Multiple Filtering Modes**:
  - **Soft Collapse (Default)**: Replaces annoying tweets with an aesthetic, non-disruptive banner showing the detected category and reason, complete with a single-click **"Show"** toggle and an **"Always Allow"** button.
  - **Complete Hide**: Removes annoying tweets entirely from view.
  - **Inline Badges**: Keeps tweets visible while tagging accounts with high-contrast badges (e.g. `⚽ Football`, `📈 Finance`, `🏛️ Politics`).
- 🤖 **TypeSafe Jev AI Engine**:
  - **TypeSafe Jev (System One)**: Uses the ultra-fast System One decision model (`jev-latest`) on `https://api.typesafe.ai/v1/systemone` using typed structured choice queries (~70–300ms) for 100% semantic, AI-driven categorization.
- ⚡ **High-Speed Caching**:
  - Remembers classifications for tweets in local storage so that browsing remains lightning-fast and API requests are minimized.
- 📋 **Allowlist & Blocklist**:
  - Whitelist favorite creators and friends so they are never filtered.
  - Blacklist persistent spam handles permanently.
- ⚙️ **Custom Keyword Rules & Prompts**:
  - Customize prompt criteria and block custom topics (e.g. `dropshipping`, `astrology`, `memecoin`).
- 🔍 **Live Sandbox Tester**:
  - Test any handle or tweet text right from the popup or options page to see live decision model output, confidence scores, and reasons.

---

## 🚀 Installation (Load Unpacked in Chrome)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/turkerdev/hide-the-annoying.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `hide-the-annoying` folder.
6. The extension is now installed! Pin it to your toolbar for quick access.

---

## ⚙️ Configuration & Decision Engine

Click the **Hide The Annoying** icon in your Chrome toolbar or right-click and choose **Options**:

### TypeSafe Jev (System One Engine)
- **API Endpoint:** `https://api.typesafe.ai/v1/systemone`
- **Model:** `jev-latest`
- Enter your TypeSafe API key in the extension popup or Options dashboard.
- Jev evaluates candidate posts with calibrated probabilities and typed structured choices in ~70–300ms.

---

## 📁 Project Structure

```
hide-the-annoying/
├── manifest.json            # Manifest V3 specification
├── background.js            # Background service worker (ES module)
├── content.js               # Content script injected into x.com and twitter.com
├── content.css              # Styling for collapsed banners, badges, and alerts
├── CHROMEWEBSTORE.md        # Chrome Web Store listing metadata & justifications
├── PRIVACY.md               # User privacy disclosures
├── generate_icons.py        # Python script generating standard PNG icons
├── icons/                   # Extension icons (16x16, 48x48, 128x128 PNG)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── lib/
│   ├── providers.js         # TypeSafe Jev System One decision engine
│   └── storage.js           # Settings, stats, and user cache helpers
├── popup/
│   ├── popup.html           # Toolbar popup interface
│   ├── popup.css            # Popup stylesheet
│   └── popup.js             # Real-time popup settings and sandbox tester
└── options/
    ├── options.html         # Full options & allowlist management dashboard
    ├── options.css          # Options dashboard styling
    └── options.js           # Dashboard controller and cache inspector
```

---

## 🧪 Testing

1. Open X/Twitter (`https://x.com`).
2. Search for `#PremierLeague` or `#Crypto` or open any high-traffic football or finance thread.
3. Observe accounts and posts matching football or crypto being neatly collapsed with `[🛡️ Hidden: @user (⚽ Football / Soccer)]` or `[📈 Finance / Crypto]`.
4. Click **Show** to expand any individual tweet, or click **Always Allow** to unhide the user across the page and add them to your whitelist.
5. Open the Extension Popup to test handles or view real-time statistics of filtered posts and cache hits!
