# PenguCrush: Beyond the Horizon

A mobile match-3 adventure from [Digital Chocolate](https://digitalchocolate.co/pengucrush/). Explore ten islands, solve 100 levels and join Kip, Rook and Juno on their expedition.

## Run locally

Requires Node.js 22 or newer.

```sh
cp store/publisher.example.json store/publisher.json
cd app
npm ci
npm run dev
```

## Test and build

From `app/`:

```sh
npm test
npm run build
```

## Android

Requires JDK 17 or newer and Android SDK 36. Configure your local Android SDK path using `ANDROID_HOME` or an untracked `android-app/local.properties` file.

```sh
cd app
npm run build
npm run android:sync
cd ../android-app
./gradlew assembleDebug
```

Third-party dependencies retain their respective licenses; see [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).

## Solana Seeker release

The dApp Store package is in `store/solana/`. Follow `store/solana/UPLOAD-GUIDE.txt`.
The signed APK is generated in `store/solana/upload/`; private signing material stays
outside the repository in `~/.config/pengucrushsolana/signing/`.

```sh
cp store/solana/publisher.json store/publisher.json
cd app
npm run seeker:key
npm run seeker:build
npm run seeker:check -- --online
```

`seeker:key` reuses an existing key and never replaces it. On another computer,
restore the original private signing directory before running it. Release builds
without signing credentials stay unsigned. All published updates must use the
same certificate and a higher Android version code. Version 0.6.1 records completed
level activity on Solana. Version 0.6.0 introduced opt-in Firebase cloud
announcements; retrieve its Android configuration as described in
[backend/README.md](backend/README.md) before rebuilding.

## Leaderboard and SOL purchases

Leaderboard in the bottom navigation opens overall and per-level rankings. Every completed level offers an
optional 0.01 SOL score submission; Next adventure remains free. The backpack has
fixed packs of 3/10/25 hammers and shuffles for 0.005/0.015/0.03 SOL, plus network
fees. Power duo includes 2 Polar Blasts and 2 Aurora Sweeps for 0.01 SOL; Arctic
arsenal includes 6 of each for 0.025 SOL. Each power is also available for earned
shells (180 / 220), with one of each included on first use of this update. Polar
Blast clears a 5×5 area and Aurora Sweep clears a chosen colour; both trigger
specials without spending a move. Preview the target, then choose Use or Cancel.

Original background music and match, combo, win and power effects run offline.
Settings provides separate music and effects switches; audio pauses when the app
is backgrounded or the wallet opens.

Solana Mobile Wallet Adapter opens the installed Seeker wallet for approval.
Continuing after a completed level asks the wallet to submit a replay-verified
Memo transaction recording that level on Solana. The wallet pays the standard
network fee; declining leaves the player on the results screen. The memo is
public and contains the level, score, stars and run identifier, but no wallet
secret or personal information.

The API and PostgreSQL are deployed on Railway. The server verifies wallet
ownership, replays submitted runs, and confirms exact finalized payments before
crediting an order. Mainnet payments are enabled with the publisher's receiving
address `6zuPtQg1rygxNgzZmjn13YB3bqMGiMLbPAWbrbvwJykg` in Railway
`SOLANA_TREASURY`. The app refreshes payment configuration on opening or resuming;
no APK rebuild is needed for this address. See [backend/README.md](backend/README.md)
for deployment, database tests, payment recovery and the cloud announcement CLI.
