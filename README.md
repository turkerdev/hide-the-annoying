# Hide The Annoying — X / Twitter AI Content Filter

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/hide-the-annoying/aapbeafdimmlobengijdpahhldmhnfkl)

A modern, 100% open-source Chrome Extension (Manifest V3) that detects and filters out annoying X/Twitter users and posts — especially those talking about **soccer/football**, **crypto/finance**, or **toxic politics** — using fast decision models like **TypeSafe Jev** and **Cloudflare Clef**.

---

## ⚡ Features

- 🛡️ **Multiple Filtering Modes**:
  - **Soft Collapse (Default)**: Replaces annoying tweets with an aesthetic, non-disruptive banner showing the detected category and reason, complete with a single-click **"Show"** toggle and an **"Always Allow"** button.
  - **Complete Hide**: Removes annoying tweets entirely from view.
  - **Inline Badges**: Keeps tweets visible while tagging accounts with high-contrast badges (e.g. `⚽ Football`, `📈 Finance`, `🏛️ Politics`).
- 🤖 **Fast Decision Model Engines**:
  - **TypeSafe Jev**: Uses the ultra-fast System One decision model (`jev-latest`) on `https://api.typesafe.ai/v1/systemone` using typed structured choice queries (~70–300ms) for 100% semantic, AI-driven categorization.
  - **Cloudflare Workers AI (Clef)**: Seamless support for Cloudflare's Clef decision models via Workers AI.
  - **Custom Endpoints**: Bring any self-hosted or private Jev-compatible decision API.
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

## 🚀 Installation

### Option 1: Chrome Web Store (Recommended)
Install directly from the official **[Chrome Web Store](https://chromewebstore.google.com/detail/hide-the-annoying/aapbeafdimmlobengijdpahhldmhnfkl)** with one click.

### Option 2: Load Unpacked (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/turkerdev/hide-the-annoying.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `hide-the-annoying/extension` folder.
6. The extension is now installed! Pin it to your toolbar for quick access.

### 📦 Building & Packaging (Automated Zip)

Run the build script to validate JavaScript syntax and generate clean release archives for the Chrome Web Store:

```bash
./build-zip.sh
```

This generates:
- `hide-the-annoying.zip` (root archive ready for Chrome Web Store upload)
- `dist/hide-the-annoying-v<version>.zip` (versioned release archive)

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
├── extension/                # Chrome Extension (Manifest V3)
│   ├── manifest.json         # Extension manifest
│   ├── background.js         # Service worker
│   ├── content.js            # Content script for X / Twitter
│   ├── content.css           # Collapsed banner and badge styles
│   ├── icons/                # Extension icons (16px, 48px, 128px)
│   ├── lib/
│   │   ├── providers.js      # TypeSafe Jev System One decision engine
│   │   └── storage.js        # Settings & cache management
│   ├── popup/                # Extension popup UI
│   └── options/              # Full options & allowlist dashboard
├── site/                     # Showcase website for Cloudflare Pages
│   ├── index.html            # Landing page with interactive live simulator
│   ├── privacy.html          # Public privacy policy
│   ├── icons/                # Web assets & favicons
│   └── hide-the-annoying.zip # Direct download archive
├── hide-the-annoying.zip     # Packaged release archive
├── CHROMEWEBSTORE.md         # Store listing metadata & justifications
├── PRIVACY.md                # Privacy policy markdown
└── README.md                 # Project documentation
```

---

## 🧪 Testing

1. Open X/Twitter (`https://x.com`).
2. Search for `#PremierLeague` or `#Crypto` or open any high-traffic football or finance thread.
3. Observe accounts and posts matching football or crypto being neatly collapsed with `[🛡️ Hidden: @user (⚽ Football / Soccer)]` or `[📈 Finance / Crypto]`.
4. Click **Show** to expand any individual tweet, or click **Always Allow** to unhide the user across the page and add them to your whitelist.
5. Open the Extension Popup to test handles or view real-time statistics of filtered posts and cache hits!
