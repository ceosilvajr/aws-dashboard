# Flutter / Dart — Run Locally

## Detection
File: `pubspec.yaml`

## Pre-flight
Check pub dependencies installed:
```bash
[ -d ".dart_tool" ] || flutter pub get
```

Run `flutter doctor` to confirm the target platform is available:
```bash
flutter doctor -v 2>&1 | grep -E "✓|✗|!" | head -10
```

---

## Build

For **mobile** (iOS/Android):
```bash
flutter build apk --debug    # Android
flutter build ios --debug --no-codesign  # iOS (macOS only)
```

For **web**:
```bash
flutter build web
```

For **desktop** (macOS/Linux/Windows):
```bash
flutter build macos   # or linux / windows
```

Success signal: `✓ Built` or `Build process complete`
Build output location is printed by flutter automatically.

## Test
```bash
flutter test
```
Success signal: `All tests passed!` or `X tests passed`
Failure: `Some tests failed`

## Run

Flutter run opens a device/emulator selector when multiple devices are connected. To run on a specific target:

```bash
# List connected devices first
flutter devices

# Run on the first available device
flutter run
```

For **web specifically**:
```bash
flutter run -d chrome --web-port 8080
```

For **macOS desktop**:
```bash
flutter run -d macos
```

Flutter's run command is interactive — it stays in the foreground and accepts hot-reload commands (`r` = hot reload, `R` = hot restart, `q` = quit). This is intentional for Flutter development. Run in the foreground rather than backgrounding.

Startup signal: `Flutter run key commands` — app is ready when this appears.

## Notes
- Hot reload (`r`) is the primary development loop for Flutter — the skill should mention this after the app starts
- Web builds require Chrome or `flutter run -d web-server` for headless
- iOS builds require macOS + Xcode
