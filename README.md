# SmartConnect X

Digital business cards with the original forest-green/lime jury-day design, company logo and promotional video. Includes a guest QR-card builder, saved customer cards, Google/email sign-in, a QR scanner, digital subscriptions and an owner payment-review dashboard.

**Launch status:** the production build and 23 automated tests passed. The new Vercel deployment and production sign-in checks are pending. Paid checkout remains closed until those checks are complete. This repository contains source code; it is not the live website.

## Run locally

Use Node.js 22.12 or later.

~~~sh
npm ci
npm run dev
~~~

~~~sh
npm test
npm run build
~~~

Tests cover card ownership, private profiles, legacy QR links, Google PKCE, safe return paths, UPI amounts, payment-review controls and database subscription rules. Database tests use an isolated PGlite instance and do not modify the live backend.

## Deploy to Vercel

Import **atharvsood576/smartconnect5** into a new project in the intended owner's Vercel account. Existing sites are separate projects. Record the actual production URL in RELEASE.json after deployment succeeds.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root |
| Node.js | 22.x |
| Install command | npm ci --no-audit --no-fund |
| Build command | npm run build |
| Output directory | dist |

vercel.json includes route rewrites and security headers. Build from source with the committed lockfile; dependencies and build output are not committed.

## Authentication and launch checks

The app uses the existing Supabase backend configured in cloud-config.js. Only its public URL and publishable key are included. Never place service-role keys, secret API keys or Google client secrets in frontend code.

After deployment:

1. Set the Supabase Auth Site URL to the new production origin. Allow that origin's exact /auth/callback, /account and /reset-password URLs.
2. Verify Google sign-in, email confirmation and password reset on the deployed site. Google is enabled and browser testing reached its account chooser; full production sign-in has not been verified. Keep email confirmation enabled.
3. Sign in with the designated owner account and verify /admin. Owner access is already assigned in the backend. Customer signup and Google login never assign owner access.
4. Check a saved-card update and scanner camera permission over HTTPS.
5. Verify the receiving UPI identity in the owner's UPI app, review plan prices, and enable checkout through the owner dashboard.

The Google provider callback remains https://eezljofhwbohqundogjk.supabase.co/auth/v1/callback. The application's return URL is the new website's /auth/callback.

The SQL files under supabase/migrations are historical migrations already applied to the existing backend. Do not reapply or rename them on that database. RLS and authenticated database functions enforce ownership and payment state changes.

## Payments and subscriptions

Receiving UPI: **soodatharv@fam**. Merchant: **SmartConnect X**.

The current catalog is Free (one saved card), Pro monthly (₹99) and Pro yearly (₹499). Active Pro supports up to five saved cards. Prices load from the backend; each order preserves its quoted amount and recipient.

Subscriptions renew manually. There is no automatic UPI debit or AutoPay mandate. A submitted 12-digit payment reference remains pending until the owner independently matches the bank receipt and approves it. Submitting a reference never activates Pro by itself. Saved cards remain editable after Pro expires.

## Routes

| Route | Purpose |
| --- | --- |
| / | Homepage, guest card builder and scanner |
| /?card=... | Original guest QR profile links |
| /?profile=... | Published saved card with a stable address |
| /editor?id=... | Signed-in owner's card editor |
| /signup.html or /login | Google/email customer sign-in |
| /auth/callback | Google PKCE callback |
| /account | Cards, subscription, orders and support |
| /plans | Subscription catalog |
| /checkout?plan=pro-monthly | UPI subscription checkout |
| /admin | Owner settings and payment review |
| /reset-password | Password reset completion |
| /scan.html | Compatibility route to the scanner |
| /pricing.html | Optional setup and NFC service enquiries |
| /terms | Payment process and privacy information |

## Compatibility and assets

Original Unicode/base64url QR snapshots remain readable. Saved-card links are editable by their owner and may be unpublished. Public text is escaped, external links allow HTTP(S), and contact downloads escape vCard control characters.

The scanner requests camera access only after Start and stops when the page is hidden or closed. The locally bundled html5-qrcode library is pinned to 2.3.8; its Apache 2.0 license is included at public/vendor/html5-qrcode.LICENSE.

The built-in SmartConnect guide provides preset help, not a generative AI service. Original physical-card and AI Premium concepts are separate from paid digital subscriptions. Optional service enquiries copy text only; they do not send messages or place orders.

Full production login/reset, physical camera scanning and actual UPI payment tests remain pending. No fake payment claims, test customers or production test orders were created during development.
