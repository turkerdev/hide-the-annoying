# Privacy Policy — Hide The Annoying

Effective Date: October 2, 2026

Hide The Annoying ("the Extension", "we", "us") is dedicated to protecting your privacy. This policy outlines how information is handled when using the Hide The Annoying Chrome Extension.

## 1. Information Handled by the Extension

- **Locally Stored Settings:** Your preferences (active topics, filter mode, sensitivity, allowlist, blocklist, and cached decisions) are stored exclusively in your browser's `chrome.storage.local`.
- **API Credentials:** Any API key for TypeSafe Jev you provide is saved locally on your device in secure extension storage. It is only sent in the HTTP `Authorization` header directly to `https://api.typesafe.ai`. We never operate an intermediary server or collect your keys.
- **Website Content:** When you visit X (formerly Twitter), the extension reads the text, display names, and handles of publicly visible posts in your timeline to classify them via TypeSafe Jev over secure HTTPS directly to `https://api.typesafe.ai`.
- **No Personal Tracking:** The extension does not track personal browsing history, cookies, passwords, or personal messages.

## 2. Third-Party Services

- **TypeSafe AI (Jev):** When configured with your API key, classification requests are sent directly to `api.typesafe.ai` subject to TypeSafe AI's API terms and privacy policy.

## 3. Data Retention

All cached evaluations are stored locally on your device and can be cleared at any time from the extension popup or Options dashboard with a single click ("Clear All Cache").

## 4. Updates

We may update this policy periodically. Changes will be reflected with an updated effective date.

## 5. Contact

For inquiries or questions, contact us via GitHub Issues at https://github.com/turkerdev/hide-the-annoying/issues.
