# Privacy Policy — Hide The Annoying

Effective Date: October 23, 2026

Hide The Annoying ("the Extension", "we", "us") is dedicated to protecting your privacy. This policy outlines how information is handled when using the Hide The Annoying Chrome Extension.

## 1. Information Handled by the Extension

- **Locally Stored Settings:** Your preferences (active topics, filter mode, sensitivity, allowlist, blocklist, and cached decisions) are stored exclusively in your browser's `chrome.storage.local`.
- **API Credentials:** A TypeSafe key you paste stays in `chrome.storage.local` and is sent only to the endpoint you configure, usually `https://api.typesafe.ai`. The free-tier session from Google sign-in also stays in extension storage.
- **Free tier account:** If you sign in with Google, the free-tier API stores your Google account id, Gmail address, and a daily classification count. That path is limited to `@gmail.com` and `@googlemail.com`.
- **Website Content:** On X, the extension reads publicly visible post text, display names, and handles. With your own key, that text goes to your configured endpoint. On the free tier, it goes to our Cloudflare Worker, which forwards it to TypeSafe Jev and does not keep the post text.
- **No Personal Tracking:** The extension does not track personal browsing history, cookies, passwords, or personal messages.

## 2. Third-Party Services

- **TypeSafe AI (Jev):** Classification requests are sent to `api.typesafe.ai`, either directly with your key or through the free-tier worker with ours.
- **Google:** Free-tier sign-in uses Google OAuth to confirm the account is a Gmail address. We store the account id and email, not a Google password.

## 3. Data Retention

All cached evaluations are stored locally on your device and can be cleared at any time from the extension popup or Options dashboard with a single click ("Clear All Cache").

## 4. Updates

We may update this policy periodically. Changes will be reflected with an updated effective date.

## 5. Contact

For inquiries or questions, contact us via GitHub Issues at https://github.com/turkerdev/hide-the-annoying/issues.
