# Releasing Tempify on iOS

Tempify is built on this Mac and uploaded straight to App Store Connect. Nothing goes through EAS
or Xcode's cloud signing. Uploading is fine at any time; **submitting for App Review waits until
Jett says so in that session.**

## A release

1. Set the version in `ios/App/App.xcodeproj/project.pbxproj`: `MARKETING_VERSION` (1.8, 1.9 and
   so on) and `CURRENT_PROJECT_VERSION` (back to 1 for a new version, up by one for another upload
   of the same version). Commit it.
2. Check `.env`. Every `VITE_` value, the Premium and admin email lists included, is baked into
   the bundle at build time, so the build ships whatever `.env` holds right then.
3. `./scripts/release-ios.sh` builds the web bundle, copies it into the iOS project, archives,
   exports, validates and uploads. About five minutes.
4. On App Store Connect: make the version, write What's New, pick the build once Apple has
   processed it, and submit only with Jett's ok.

## Signing

Set up October 24, 2026, when this Mac had no distribution certificate and Xcode had no Apple
account signed in.

| | |
| --- | --- |
| Certificate | Apple Distribution: Jett Nguyen, id `DP55FA2P5M`, expires October 24, 2027 |
| Its private key | Only in `~/Library/Keychains/tempify-signing.keychain-db` on this Mac |
| That keychain's password | In the login keychain, item `tempify-signing-keychain` (the script reads it) |
| Profile | `Tempify App Store`, id `UNV2372WZY`, for `me.tempify`, expires October 24, 2027 |
| API key | The shared App Store Connect key at `../asc-api-key.p8` (App Manager) |

The API key can't use Apple's cloud-managed certificates, which is why the export signs by hand
with the certificate above. The team's other distribution certificate belongs to EAS for the Expo
apps and isn't used here.

**When they expire,** make a new certificate and profile through the API (a certificate signing
request from `openssl`, then `POST /v1/certificates` with type `DISTRIBUTION`, then
`POST /v1/profiles` with type `IOS_APP_STORE`), import the certificate into the same keychain, and
install the profile in `~/Library/Developer/Xcode/UserData/Provisioning Profiles`.

## Screenshots

The iPhone set is 6.9 inch (1320 by 2868), taken on the iPhone 18 Pro Max simulator with the
status bar set to 9:41 and full bars:

```sh
xcrun simctl status_bar <device> override --time "9:41" --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100
```

Album art has to be blurred for Apple. For 1.8 the blur was put on the running app rather than
painted over afterward, through the simulator's web inspector:
`.track-artwork__img { filter: blur(7px) saturate(1.15); clip-path: inset(0 round 8px); }`. The
clip keeps the blur inside each cover's rounded corners. The 1.8 set is in
`~/Desktop/Tempify Files/6.9"/1.8 blurred`.

## iPhone Duo

The Duo's status bar runs down the side of the screen in both postures, so it reports no top
inset and a right inset of 84 points. Folded, the app gets 466 by 678 points; open, it runs on
its side at 951 by 669, below the 744 point short side that turns on the iPad layout. Check both
postures when a layout changes. Device Hub's bottom toolbar switches the posture, and a second
Duo simulator boots folded.
