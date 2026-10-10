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
