#!/usr/bin/env bash
# Installs an APK on the running emulator, opens it, and keeps the evidence in
# smoke/: install output, logcat, a screenshot, and whether the app is still
# alive 30 seconds after launch. Fails the job if it isn't.
#
# Then photographs the real Today, Food result, Walk and steps Detail screens
# in the Clean+ look over the mockup's sample day (app/design-preview.tsx), for
# checking against the mockup: smoke/clean-<screen>.png at the emulator's own
# size, plus smoke/clean-today-dark.png and smoke/clean-detail-dark.png with the
# phone in dark mode (the look must stay light). side-by-side.py then puts them
# next to the mockup. These are evidence only: they never fail the job.
set -u

apk="$1"
pkg=com.neutcrafts.steps
scheme=neutcraftssteps
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

# --- Design preview ----------------------------------------------------------

# A common phone: 1080 x 2400 at 420 dpi (the workflow asks for a Pixel 6, which is that).
size="$(adb shell wm size | tr -d '\r')"
density="$(adb shell wm density | tr -d '\r')"
echo "Emulator screen: $size, $density"
case "$size" in *"1080x2400"*) ;; *) echo "::warning::Screen is not 1080x2400; setting it"; adb shell wm size 1080x2400 ;; esac
case "$density" in *": 420"*) ;; *) echo "::warning::Density is not 420; setting it"; adb shell wm density 420 ;; esac

# Waits up to 30 s for the route's "ready" line, then until two photos in a
# row are the same (fonts, map tiles), at most about 6 s. Saves the last one.
capture() {
  local theme="$1" screen="$2" out="$3" prev="" cur="" start
  adb shell am force-stop "$pkg"
  adb logcat -c
  # Quoted again for the phone's shell, which would take & as "run in background".
  adb shell "am start -W -a android.intent.action.VIEW -d '$scheme://design-preview?theme=$theme&screen=$screen' $pkg" > /dev/null
  start=$SECONDS
  until adb logcat -d -s ReactNativeJS:V | grep -q "design-preview ready: $theme $screen"; do
    if [ $((SECONDS - start)) -ge 30 ]; then
      echo "::warning::$out: the preview never said it was ready"
      adb logcat -d -s ReactNativeJS:V | tail -20
      break
    fi
    sleep 0.5
  done
  start=$SECONDS
  while [ $((SECONDS - start)) -lt 6 ]; do
    sleep 0.5
    adb exec-out screencap -p > "$out.tmp"
    cur="$(md5sum < "$out.tmp")"
    [ "$cur" = "$prev" ] && break
    prev="$cur"
  done
  mv "$out.tmp" "$out"
  echo "Captured $out"
}

adb shell cmd uimode night no
for screen in today food walk detail; do
  capture clean "$screen" "smoke/clean-$screen.png"
done

# The Clean+ look with the phone in dark mode: it must look the same as the light shots.
adb shell cmd uimode night yes
capture clean today smoke/clean-today-dark.png
capture clean detail smoke/clean-detail-dark.png
adb shell cmd uimode night no

adb logcat -d > smoke/logcat-preview.txt
adb shell am force-stop "$pkg"
ls -l smoke/*.png
