# PenguCrush online services

API: https://pengucrush-api-production.up.railway.app

Railway project: `pengucrush-solana` (`f99e792b-0fb1-4497-9a11-bde758ba69a8`). Services: `pengucrush-api` and `Postgres`. PostgreSQL is accessible over the private Railway network; no database credential ships in the app.

Required API variables:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
- `NODE_ENV=production`, `PORT=8080`, `SOLANA_CLUSTER=mainnet-beta`
- `SOLANA_TREASURY=6zuPtQg1rygxNgzZmjn13YB3bqMGiMLbPAWbrbvwJykg`: publisher-approved receiving public address, configured in production. Payments stay disabled if this variable is absent.
- `SOLANA_RPC_URL`: optional RPC URL; defaults to the public Solana mainnet endpoint. A production provider can be configured without changing the APK.

Service settings: health check `/health`, timeout 90 seconds, restart on failure up to five times. These are configured on Railway. New Railway services no longer read the deprecated railway.json format. The APK fetches payment availability and the recipient from the API when it opens or resumes; changing the receiving address does not require rebuilding the APK. Existing orders retain the recipient recorded when they were created.

From the repository root, deploy with `railway up --service pengucrush-api --detach`. Run the database integration suite using `railway ssh --service pengucrush-api -- node test-railway.mjs`. It uses a temporary schema and simulated chain responses, never spends SOL, and deletes its test data. `node rpc-check.mjs` inside the service checks the configured RPC without a transaction.

Wallet ownership uses a one-use, five-minute signed challenge and seven-day hashed bearer sessions. Payments use a server-issued SOL transfer plus order memo and reference. Only an exact, finalized transaction credits an order; confirmation and the leaderboard update share a database transaction. Repeated confirmations are idempotent. Unknown wallet outcomes are recovered by the reference address. An unexpired order reuses the same transaction to avoid a second debit.

The server replays each submitted run and calculates its score. It stores each wallet's best score per level; the overall total is their sum. This is a casual, non-prize leaderboard. Offline inventory is client storage and is not an attested anti-cheat system. Paid consumables are credited once per receipt to the purchasing installation; game reset preserves receipt IDs but removes unused supplies. There is no cross-device inventory restoration.

Cloud notifications use Firebase project `pengucrush-solana`, Android app `1:580005181955:android:aa93fa3c0de05a1322ec36`. The client config is in the ignored `android-app/app/google-services.json`; retrieve it with `firebase apps:sdkconfig android 1:580005181955:android:aa93fa3c0de05a1322ec36 --project pengucrush-solana --out android-app/app/google-services.json`.

In-app cloud categories subscribe to `pengucrush_events_v1` and `pengucrush_news_v1` only after opt-in and Android permission. Analytics and delivery-metrics export are off. Use the operator CLI from `app/`:

```sh
node scripts/cloud-message.mjs --category news --title 'A new expedition' --body 'Your next adventure is ready.' --route journey
```

This validates without sending. Add `--send` only when you intend to send the announcement. `--token-file /private/path` targets one test installation instead of a topic. The CLI uses the operator's existing Firebase login, not a credential embedded in the APK. Notifications follow local quiet hours and delivery caps.

Wallet integration follows https://docs.solanamobile.com/get-started/kotlin/quickstart and https://docs.solanamobile.com/get-started/kotlin/installation (MWA KTX 2.0.3). The wallet retains all private keys. A physical Seeker wallet approval remains a release verification step; automated tests do not authorize mainnet spending.

The 0.6.1 client requests `/v1/catalog?version=2` to see the two power packs.
The default catalog keeps the three original packs for 0.5.0 clients. All pack
amounts and contents are selected by the server, and older confirmed receipts
retain their original contents. Score replays support both new powers.

Play telemetry: `POST /v1/telemetry` (no sign-in, 30/min per IP) records every install by its anonymous installation UUID plus `open`, `start`, `win` and `lose` events. Event IDs make retries idempotent; the response's `accepted` counts new rows. A valid session bearer links the wallet; a missing or expired one keeps the events anonymous. The optional `push` field stores the FCM token and chosen categories for operator-sent segment pushes (`push_active` needs a token and a category).

Server data is no longer pruned. Logout expires its session, and a used sign-in challenge is marked `used_at`; both rows stay and are still rejected. Sign-ins are counted in `wallets`. `DELETE /v1/profile` is unchanged.

Read-only report (installs, active installs, wallets, levels reached/completed, push reach): `node stats.mjs` from `backend/`. It uses `DATABASE_URL` or reads the Postgres public URL through the Railway CLI, runs in a read-only transaction and never prints the URL.
