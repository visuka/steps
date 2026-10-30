#!/usr/bin/env bash
# Installs an APK on the running emulator, opens it, and keeps the evidence in
# smoke/: install output, logcat, a screenshot, and whether the app is still
# alive 30 seconds after launch. Fails the job if it isn't.
set -u

apk="$1"
pkg=com.neutcrafts.steps
mkdir -p smoke

adb install -r -g "$apk" 2>&1 | tee smoke/install.txt
adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1
sleep 30

adb logcat -d > smoke/logcat.txt
adb exec-out screencap -p > smoke/screen.png
pid="$(adb shell pidof "$pkg" | tr -d '\r')"

grep -n -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|unknown:React|Fatal signal|DEBUG   :|UnsatisfiedLink|SoLoader" \
  smoke/logcat.txt > smoke/crash.txt || true
head -150 smoke/crash.txt

if [ -z "$pid" ]; then
  echo "::error::The app is not running 30 seconds after launch"
  exit 1
fi
echo "The app is running (pid $pid)"
