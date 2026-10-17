# Product: PenguCrush — Beyond the Horizon

<!-- impeccable:product-schema 1 -->

## Platform

web

React game UI delivered in an Android WebView for Solana Seeker, with native wallet, lifecycle, haptic and notification bridges. The visual language is the existing game UI; browser play is also supported.

## Product Purpose

A match-3 expedition across ten islands with Kip, Rook and Juno: 100 levels containing 111 playable stages. Players match pieces, complete goals, earn stars and shells, and advance the expedition.

## Operating Context

The campaign and retries are free and work offline. Progress and consumable balances stay on the installation. Optional online features are leaderboard submission, SOL packs and user-opted-in Firebase cloud announcements. The API and PostgreSQL run on Railway.

## Capabilities and Constraints

- Camp, Journey, Leaderboard, Journal, Crew and Pack are visible footer destinations. Rankings support overall totals and individual levels; each level's best submitted score contributes to the total.
- Completed runs offer optional 0.01 SOL score submission plus network fees. Continuing the campaign remains free. Rankings have no prizes or payouts.
- SOL purchases request approval through native Solana Mobile Wallet Adapter. Server verification checks wallet ownership, replays score runs and confirms finalized payments before crediting orders. Consumables are installation-bound.
- Ice hammer and Snow shuffle remain available for 60 and 40 earned shells. Original SOL packs remain 3/10/25 of each for 0.005/0.015/0.03 SOL.
- Polar Blast clears a 5 × 5 area; Aurora Sweep clears a chosen colour. Both trigger affected specials and spend no move. Each starts with one free use, including migration of saves without the new inventory fields. More cost 180/220 earned shells respectively. Power duo supplies two of each for 0.01 SOL; Arctic arsenal supplies six of each for 0.025 SOL. All pack prices exclude network fees.
- New powers preview their targets before Use or Cancel; cancellation spends no inventory. Specials may chain beyond the initial preview.
- Original synthesized music and effects run offline. Music and effects have separate settings; audio pauses in the background and during wallet handoff. Animation and native haptic settings are separate.

## Brand Commitments

Preserve the established illustrated expedition, characters and piece silhouettes, cream/navy/teal/gold palette, Lilita One and Rubik typography, and Phosphor interface icons. Extend the existing game rather than replacing its identity.

## Evidence on Hand

Verified against `README.md`, `app/src/levels.js`, `storage.js`, `boosters.js`, `main.jsx`, `Commerce.jsx`, `audio.js`, and `backend/catalog.js`. Final native `phone-*.png` captures in `.impeccable/review/` show the corrected signed 0.6.0 build. The power walkthrough finishes Level 1 with 6,060 points and all 12 moves preserved. These records do not establish a physical Seeker payment or notification-delivery test.
