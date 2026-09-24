# Banking Integration for Voice Finance

# BANKING INTEGRATION — REQUIRED NEXT FEATURE

Integrate this into the EXISTING Voice Finance app. Do not redesign the existing Home screen from scratch.

## Goal

Voice Finance should support:
- connected banks
- account list
- current/available balances
- bank transactions
- transaction currency
- merchant/bank descriptions
- last sync time

Initial target banks:
- PKO Bank Polski
- Revolut
- Erste

Trustee Plus:
- do not assume normal PSD2/Open Banking support
- treat as future custom connector/import/manual account unless personal-account API access is confirmed

## Architecture

```text
iPhone / Voice Finance PWA
        |
        | HTTPS
        v
GitHub Pages frontend
        |
        | HTTPS
        v
Cloudflare Worker backend
        |
        | HTTPS
        v
Enable Banking
        |
        v
PKO / Revolut / Erste
```

Rules:
- GitHub Pages is frontend only.
- Cloudflare Worker is the banking/security backend.
- Enable Banking is the Open Banking/PSD2 intermediary.
- Do not expose Enable Banking private keys in frontend code, GitHub, localStorage, manifest files, app bundles, or logs.
- MVP is AIS/read-only only.
- Do not implement payments, payment initiation, or money movement.

## Existing Home screen — preserve it

The current Home screen is approved.

The existing **Total Balance / "Загальний баланс" widget must remain visually unchanged.**

Do not:
- replace it
- redesign it
- insert bank icons inside it
- turn it into a bank carousel

Add a NEW Accounts panel directly UNDER the existing balance widget.

Required Home order:

```text
HEADER

TOTAL BALANCE
[existing approved widget — visually unchanged]

ACCOUNTS
[bank icons panel]

CATEGORIES
[existing]

RECENT TRANSACTIONS
[existing]
```

## Accounts panel design

The Accounts panel should visually resemble iPhone Home Screen app icons.

Example:

```text
Рахунки                               ⌄

[ PKO ]     [ Revolut ]     [ Erste ]     [ + ]
  PKO         Revolut         Erste
15 240 zł      6 480 zł        3 100 zł
```

Critical requirement:
- bank name = white text
- bank balance = smaller GREEN text under the bank name

The green text is the **BALANCE**, not a connection status.

Correct:

```text
[PKO icon]
PKO
15 240 zł
```

Incorrect:

```text
PKO
Connected
```

Preserve original account currency where appropriate:
- `15 240 zł`
- `1 250 €`

## Expand/collapse behavior

Collapsed:
- show 3–4 bank icons depending on viewport width
- keep the `+` tile visible if practical
- subtle expand affordance if more banks exist

Expanded:
- show all accounts/banks in a clean iOS-like icon grid
- do not convert it into a dense table
- final tile remains `+`

## Plus button

The `+` button is correct in the web app.

It means:
**Add Account / Connect Bank**

It must NOT expose:
- API key fields
- client secret fields
- PSD2 token fields
- RSA private key fields

Tap `+` -> open an Apple-like bottom sheet:

```text
Додати рахунок

Підключити банк
[ PKO Bank Polski ]
[ Revolut ]
[ Erste ]
[ Інший банк ]

----------------

Додати вручну
[ Готівка ]
[ Інший рахунок ]
```

## Bank connect flow

Example for PKO:

```text
User taps "+"
-> PKO
-> frontend POST /api/banks/connect { provider: "PKO" }
-> Cloudflare backend creates Enable Banking authorization
-> browser opens bank/provider authorization
-> user authenticates with PKO
-> user approves access
-> callback returns to backend
-> backend validates state/session
-> frontend refreshes accounts
-> PKO appears in Accounts panel
```

Voice Finance must never ask for bank password/PIN/SMS codes.

## Bank icon tap

Tapping a bank icon opens bank/account details.

Example:

```text
PKO Bank Polski

12 481,54 zł
Available: 11 982,11 zł

Last sync
today, 14:32

Transactions
Biedronka        -184 zł
Uber              -42 zł
Johnny          +3000 zł

[ Refresh ]

Settings
[ Reconnect ]
[ Disconnect ]
```

If one bank has multiple accounts, prefer one Home icon and show subaccounts inside the detail view rather than duplicating the same bank icon.

## Total Balance logic

Keep the widget visually unchanged, but its source changes.

Do NOT calculate Total Balance as:
`income - expenses`

Correct:

```text
connected bank balances
+ manual accounts
+ cash
= Total Balance
```

Bank transactions are used for analytics, not subtracted again from current balances.

Example:
- PKO before purchase: 10 000 PLN
- Biedronka: -200 PLN
- bank reports current balance: 9 800 PLN
- Total Balance uses 9 800 PLN, not 9 600 PLN

## Account data model

Suggested fields:

```text
id
provider
bankName
displayName
accountType
currency
currentBalance
availableBalance
externalAccountId
connectionId
lastSyncedAt
isActive
source:
  bank
  manual
  cash
```

## Transaction data model

Suggested fields:

```text
id
accountId
type:
  expense
  income
  transfer
amount
currency
categoryId
merchant
client
note
date
source:
  bank
  voice
  manual
  import
externalTransactionId
status
createdAt
```

## Transfers between own accounts

Own-account transfers are NOT expense/income.

Example:

```text
PKO -> Revolut
1000 PLN
```

Effect:
- PKO -1000
- Revolut +1000
- Total Balance unchanged
- Income unchanged
- Expenses unchanged

Use type `transfer`.

## Voice/manual <-> bank reconciliation

Example:
Voice:
`200 злотих Biedronka`

creates a provisional record:
- -200 PLN
- Biedronka
- category: Продукти
- source: voice
- status: pending_bank_match

Later bank sync returns:
- BIEDRONKA 3821
- -200 PLN
- source: bank

Do NOT keep both.

Match using:
- same/near amount
- same currency
- close date/time
- fuzzy merchant similarity

Bank transaction remains the financial source of truth.
Voice/manual enriches it with:
- category
- client
- project
- note
- business/personal metadata

Do not silently merge uncertain matches.

## Multi-currency

Do not directly add different currencies.

Preserve:
- original balance
- original currency

If base currency is PLN, keep conversion separate.

Example:
```text
Revolut EUR
500 EUR
≈ 2 150 PLN
```

## Cash/manual accounts

Cash is an Account.

Example:
```text
Cash
currency: PLN
source: cash
currentBalance: 600
```

The `+` sheet must support:
- Connect Bank
- Cash
- Manual Account

## Cloudflare Worker backend

No always-on personal computer is required.

Suggested endpoints:

```text
POST /api/banks/connect
GET  /api/banks/callback
GET  /api/accounts
GET  /api/accounts/:id
GET  /api/accounts/:id/balance
GET  /api/accounts/:id/transactions
POST /api/sync
POST /api/banks/:id/disconnect
```

Initial sync:
- sync on app open
- if last sync > ~10 minutes, refresh
- manual Refresh button
- no continuous polling

Cloudflare Cron can be added later if needed.

## Secrets

Store only in Cloudflare Worker Secrets:

```text
ENABLE_BANKING_PRIVATE_KEY
ENABLE_BANKING_APPLICATION_ID
SESSION_SIGNING_SECRET
```

Never put them in:
- GitHub
- frontend JS
- index.html
- manifest
- localStorage
- committed `.env`
- logs

Local development secret files must be gitignored.

## Server-side persistence

Cloudflare D1 is acceptable for:
- users
- bank_connections
- accounts
- sync_state
- optional transaction cache

Do NOT store Enable Banking private key in D1.

Minimize retained banking data.

## Authentication

Banking endpoints must require authentication.

Preferred personal-app direction:
- Passkey/WebAuthn
- Face ID-backed passkey on iPhone
- backend session through secure cookie

Cookie:
- HttpOnly
- Secure
- SameSite

Do not keep auth session tokens in localStorage.

## Security requirements

### XSS
- no unsafe `innerHTML`
- escape/sanitize user input
- use Content Security Policy

### Supply chain
Avoid `.../latest.js`.
Prefer:
- pinned versions
- bundled dependencies
- self-hosted critical assets where practical
- minimal runtime third-party scripts

### Public GitHub repo
Public repo is acceptable only if it contains zero secrets.
Downloading the entire frontend repo must give zero bank access.

### CORS
Do not use `Access-Control-Allow-Origin: *` for banking endpoints.
Allow only known frontend origin(s).
CORS is not authentication; protected routes still require auth.

### CSRF
Use:
- SameSite cookies
- Origin validation
- CSRF protection for state-changing endpoints where appropriate

### Redirect/callback security
Use:
- exact redirect URI
- `state` validation
- one-time authorization sessions
- callback validation
- PKCE/nonce where supported/appropriate

### Banking tokens/sessions
Do not store them in:
- localStorage
- sessionStorage
- long-lived URL query strings
- frontend JS
- logs

Keep them server-side.

### Logging
Never log:
- Authorization headers
- Enable Banking private key
- bank tokens
- full session IDs
- full IBAN/account numbers unless strictly required
- complete raw transaction payloads by default

Add redaction.

### Service Worker
Prevent stale security-sensitive JS:
- cache versioning
- controlled upgrades
- remove old caches
- avoid indefinite caching of critical code

### Lost phone/privacy
Bank data is sensitive even if read-only.
Use passkey/WebAuthn before returning banking data.

## Source-of-truth rule

For connected bank accounts:
**bank data is the financial source of truth.**

Voice/manual data can enrich bank transactions with semantic metadata but should not duplicate them.

## Frontend/backend boundary

Frontend (GitHub Pages/PWA):
- UI
- Accounts icon panel
- Add Account sheet
- local voice
- categories
- charts
- preferences
- manual/cash accounts
- safe requests to backend

Frontend must never contain:
- Enable Banking private key
- provider access tokens
- server session secrets

Backend (Cloudflare Worker):
- authentication
- Enable Banking JWT signing
- bank auth flow
- callback validation
- connection/session management
- balances
- transactions
- sync
- safe response shaping
- reconciliation support
- secret handling

## Future SwiftUI version

Design backend so native iOS can reuse it later.

Current:
```text
GitHub Pages PWA
-> Cloudflare Worker
-> Enable Banking
```

Future:
```text
SwiftUI app
-> same Cloudflare Worker
-> same Enable Banking
```

Do not couple core banking logic tightly to browser-only code.

## Implementation order

### Phase 1 — UI/data model
- add Account model
- add manual/cash accounts
- add Accounts panel under existing Total Balance
- expandable iOS-icon grid
- `+` Add Account sheet
- preserve Total Balance widget appearance exactly

### Phase 2 — Cloudflare backend shell
- auth
- secrets
- safe API endpoints
- mocks/test data

### Phase 3 — Enable Banking
- PKO
- Revolut
- Erste
- AIS/read-only only
- connect/callback/disconnect

### Phase 4 — Sync
- accounts
- balances
- transactions
- last sync
- refresh

### Phase 5 — Analytics integration
- Total Balance from account balances
- income/expense analytics from transactions
- transfer handling
- multi-currency groundwork

### Phase 6 — Reconciliation
- voice/manual <-> bank dedup
- merchant normalization
- metadata enrichment

### Phase 7 — Security hardening
Before real accounts:
- CSP
- XSS
- CORS
- CSRF
- passkey auth
- secrets
- logs
- redirect state
- service worker cache
- dependency pinning

## Definition of done — banking UI milestone

Done when:
- existing Total Balance card looks unchanged
- Accounts section sits directly underneath
- bank icons look like iPhone app icons
- bank name is white under icon
- bank BALANCE is smaller green text under name
- collapsed and expanded grid states work
- final icon is `+`
- `+` opens Add Account sheet
- sheet offers Connect Bank + Cash + Manual Account
- tapping bank opens detail view
- mock PKO/Revolut/Erste can be added locally
- Total Balance logic is ready to switch to account balances
- no secrets are introduced into frontend code

---

# MONOBANK — ADDITIONAL BANK PROVIDER

Monobank must be ADDED to the already described bank support.

Important:
- Do NOT remove or replace any previously described banks/providers.
- Keep PKO / Revolut / Erste and any other previously documented supported-bank plans.
- Monobank is an additional Ukrainian bank connector.

## Provider architecture

Use a separate provider adapter for Monobank rather than routing it through Enable Banking.

```text
BankProvider
├── EnableBankingProvider
│   ├── PKO Bank Polski
│   ├── Revolut
│   └── Erste
│
└── MonobankPersonalProvider
    └── Monobank
```

## Add Account UI

Monobank must appear in the existing Add Account / Connect Bank sheet.

```text
Додати рахунок

Підключити банк
[ PKO Bank Polski ]
[ Revolut ]
[ Erste ]
[ Monobank ]
[ Інший банк ]

----------------

Додати вручну
[ Готівка ]
[ Інший рахунок ]
```

## Monobank connection flow

Monobank connection is token-based.

```text
User taps Monobank
-> secure connection sheet
-> explain that a personal API token is required
-> user pastes personal token
-> frontend sends token once over HTTPS to backend
-> backend validates token with Monobank API
-> backend stores token server-side only
-> frontend never persists or receives the raw token again
-> Monobank accounts/balances/transactions become available through the normal Accounts UI
```

## Token security

The raw Monobank personal API token must NEVER be stored in:
- localStorage
- sessionStorage
- frontend JS persistence
- GitHub
- manifest
- committed files
- logs

Store it server-side only.

If Cloudflare D1 is used for per-user credentials, encrypt the token before storage with an application encryption key held in Cloudflare Secrets, e.g. `MONOBANK_TOKEN_ENCRYPTION_KEY`.

Normalize Monobank data into the same Account/Transaction models used by Enable Banking so the frontend does not care which provider supplied the data.

---

# INTERACTIVE TOTAL BALANCE CHART

The current Home screen and the current Total Balance widget are already approved.

Do NOT redesign the Total Balance card.

The small graph already visible inside the Total Balance widget must become interactive/tappable.

Minimum requirement:
- tapping the mini chart opens a dedicated Balance Analysis / Balance Details screen
- optionally the whole Total Balance card may also be tappable, but the mini chart itself must definitely be an active tap target

## Balance detail page

The detail page should be inspired by the UX logic of Apple's Stocks/Yahoo Finance style financial detail views:
- dark full-screen presentation
- large balance value
- large interactive line chart
- period selector
- detailed metrics underneath
- account breakdown underneath

Do NOT copy stock-market-specific metrics such as P/E or market cap.

Suggested structure:

```text
Загальний баланс

24 820 zł
+1 240 zł за період

[ 7D ] [ 1M ] [ 3M ] [ YTD ] [ 1Y ] [ ALL ]

[ LARGE INTERACTIVE BALANCE CHART ]

Поточний       24 820 zł
Зміна          +1 240 zł
Максимум       25 110 zł
Мінімум        22 980 zł
Доходи         11 500 zł
Витрати         6 720 zł

Рахунки
PKO            15 240 zł
Revolut         6 480 zł
Monobank        2 300 zł
Cash              800 zł
```

## Periods

Support at least:
- 7D
- 1M
- 3M
- YTD
- 1Y
- ALL

Optional:
- 6M

The selected period must affect:
- chart data
- change amount
- min/max
- income/expense metrics

## Chart interaction

On touch/drag:
- show nearest data point
- show timestamp/date
- show total balance for that point
- keep interactions smooth on iPhone

Visual style:
- green line
- subtle area fill/gradient if appropriate
- low-contrast grid
- no flashy neon styling

The chart represents historical TOTAL BALANCE, not market price.

---

# BALANCE HISTORY / BalanceSnapshot MODEL

Add a dedicated historical balance model so the Total Balance graph has real historical data.

```text
BalanceSnapshot
- id
- timestamp
- baseCurrency
- totalBalance
- convertedTotalBalance
- accountsSummary
- source
- createdAt
```

`accountsSummary` should capture enough per-account balance information to explain the total at that moment without storing unnecessary sensitive raw bank payloads.

Example:

```json
{
  "timestamp": "2026-09-24T06:30:00Z",
  "baseCurrency": "PLN",
  "totalBalance": 24820,
  "accountsSummary": [
    { "accountId": "pko-1", "currency": "PLN", "balance": 15240, "convertedPLN": 15240 },
    { "accountId": "rev-1", "currency": "PLN", "balance": 6480, "convertedPLN": 6480 },
    { "accountId": "mono-1", "currency": "PLN", "balance": 2300, "convertedPLN": 2300 },
    { "accountId": "cash-1", "currency": "PLN", "balance": 800, "convertedPLN": 800 }
  ]
}
```

## When to create snapshots

Create/update snapshots:
- after successful bank sync
- after manual account balance changes
- after relevant manual/cash transaction changes
- on app open if enough time passed and the balance materially changed
- after explicit refresh

Avoid redundant points.

## Aggregation

Suggested behavior:
- 7D: intraday/daily as available
- 1M: daily
- 3M: daily
- YTD: daily or weekly depending density
- 1Y/ALL: weekly/monthly when appropriate

For connected bank accounts, bank-reported balances are authoritative.
For manual/cash accounts, local/manual balance logic can update snapshots.

Use BalanceSnapshot records as the source for the large historical chart.


---

# PERSISTENT TOP ACCOUNT TICKER / RUNNING STRIP

Add a permanent horizontally scrolling accounts ticker at the very top of the app, inspired by the supplied financial-market ticker reference.

This is an ADDITIONAL navigation/information layer.
Do NOT remove:
- the existing Total Balance widget
- the Accounts icon panel under Total Balance
- the existing Home content

## Placement

The ticker must remain visible at the top of the screen while using the main app.

Conceptually:

```text
[ ACCOUNT TICKER — continuously moving horizontally ]

HEADER / greeting / date
SEARCH
TOTAL BALANCE
ACCOUNTS ICON PANEL
...
```

Respect iPhone safe-area/status-bar spacing.
The ticker must not overlap the Dynamic Island/status bar or make content unreadable.

If the current layout uses a fixed/sticky header, integrate the ticker cleanly into that upper region.

## Visual reference

Match the UX character of a stock/market ticker:
- compact items
- short bank/account name
- balance/value
- tiny sparkline
- red or green movement indication
- black / near-black background
- white main text
- compact typography
- visually dense but still premium/iOS-like

Do NOT turn it into a large card.

## Each ticker item

Each account item should contain:

```text
PKO
15 240 zł
[ tiny sparkline ]
+420 zł
```

or:

```text
MONO
2 870 ₴
[ tiny red sparkline ]
-180 ₴
```

Recommended fields:
- short account/bank label
- current balance
- tiny sparkline
- change over the selected/default comparison window
- green/red movement value

Examples of short labels:
- `PKO`
- `REV`
- `ERSTE`
- `MONO`
- `CASH`

If multiple accounts belong to one bank, either:
1. aggregate them into one bank ticker item, or
2. use short disambiguated labels if the product later needs per-account visibility.

Prefer bank-level aggregation on the Home ticker to avoid clutter.

## Green / red movement rule

Movement color must represent BALANCE MOVEMENT over the ticker comparison period.

Green:
- account balance increased

Red:
- account balance decreased

Neutral/gray:
- no meaningful change / insufficient history

The tiny sparkline must use the same semantic direction:
- green for positive movement
- red for negative movement
- neutral gray when flat/unknown

Do NOT color by arbitrary transaction type.
It represents the account/bank balance trend.

## Sparkline data

Use `BalanceSnapshot` / account balance history.

Do not invent fake market-like movement.

For each bank/account:
- derive recent balance points
- normalize timestamps
- render a very small line sparkline
- no axes
- no labels inside sparkline
- keep it lightweight

If there is not enough history:
- show a subtle neutral/flat placeholder
- do not fabricate data

## Continuous loop

All connected accounts must circulate continuously in a seamless loop.

Required behavior:
- ticker moves from RIGHT to LEFT
- after the last account, it continues from the first account
- loop must appear seamless
- no visible jump/reset at loop boundary
- duplicate the rendered sequence internally if needed to create an infinite marquee

## Required speed

This requirement is explicit:

**The travel time from the RIGHT EDGE of the viewport to the LEFT EDGE must be 3 seconds.**

Do not implement this merely as a fixed arbitrary `animation-duration` for the whole list, because the list width changes with number of accounts.

Calculate animation speed from viewport width / actual travel distance so that the visual velocity corresponds to:

```text
viewport width / 3 seconds
```

Conceptually:

```text
pixelsPerSecond = viewportWidth / 3
duration = trackTravelDistance / pixelsPerSecond
```

Recalculate on:
- viewport resize
- orientation change
- meaningful ticker-width changes

The intention is that an item crossing the visible screen from right boundary to left boundary takes ~3 seconds.

## Interaction

Ticker must remain usable, not decorative only.

Tap on a bank ticker item:
- open that bank/account detail view

Optional:
- pause movement while finger is held down
- pause while the bank detail sheet is opening

Do NOT make horizontal scrolling gestures conflict badly with the rest of the UI.

## Accessibility / motion

Respect `prefers-reduced-motion`.

If reduced motion is enabled:
- stop the automatic marquee
- show a horizontally scrollable static row instead

Ticker information must still be accessible to screen readers.

## Performance

This runs continuously, so it must be cheap.

Requirements:
- use transform-based animation (`translate3d`/equivalent)
- avoid JS animation loops that update layout every frame
- avoid expensive chart libraries for tiny sparklines if a simple SVG/path/canvas is sufficient
- do not cause frequent React/full-page rerenders
- do not repeatedly query banking APIs just to animate the ticker
- animation uses already cached account/snapshot data

## Privacy

The ticker exposes balances visibly at all times.

Add a future-compatible privacy mechanism:
- honor the app's balance-visibility/privacy setting if one exists
- when balances are hidden, mask values while retaining bank labels
- do not bypass authentication just because ticker is visually persistent

For now, if banking data requires authentication, ticker must not show protected balances before the authenticated session is established.

## Relationship with the Accounts panel

Both must exist:

1. Top ticker:
   - glanceable
   - continuously cycling
   - balance movement + sparkline

2. Accounts panel below Total Balance:
   - static interactive bank icons
   - bank name in white
   - current bank balance in smaller green text
   - expandable grid
   - `+` add account button

Do NOT replace one with the other.

## Ticker mock-data milestone

Before real Open Banking data:
- support ticker using mock/local accounts
- test PKO, Revolut, Erste, Monobank and Cash
- use real local BalanceSnapshot mock fixtures for sparklines
- test positive, negative, neutral and no-history states

## Definition of done — ticker milestone

Done when:
- ticker is visible at the top without breaking existing layout
- it continuously loops all account items right-to-left
- an item's visible right-edge-to-left-edge traversal is approximately 3 seconds
- each item shows short bank name + current balance + tiny sparkline + movement
- positive movement is green
- negative movement is red
- neutral state exists
- data comes from BalanceSnapshot/account history
- tapping a ticker item opens account details
- loop is seamless
- reduced-motion fallback works
- ticker remains performant on iPhone Safari

