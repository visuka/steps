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

# Waits up to 30 s for the route's "ready" line, then 2 s (the splash screen
# is still fading out when the line appears), then until three photos in a row
# are the same (fonts, map tiles), at most about 8 s. Saves the last one.
capture() {
  # $4: extra link parameters (food: &edit=1 or &mine=1); $5: the word the ready line then ends with (edit or mine).
  local theme="$1" screen="$2" out="$3" extra="${4:-}" word="${5:-}" prev="" cur="" start same=0 ready
  adb shell am force-stop "$pkg"
  adb logcat -c
  # Quoted again for the phone's shell, which would take & as "run in background".
  ready="$theme $screen"
  [ -n "$word" ] && ready="$ready $word"
  adb shell "am start -W -a android.intent.action.VIEW -d '$scheme://design-preview?theme=$theme&screen=$screen$extra' $pkg" > /dev/null
  start=$SECONDS
  until adb logcat -d -s ReactNativeJS:V | grep -q "design-preview ready: $ready"; do
    if [ $((SECONDS - start)) -ge 30 ]; then
      echo "::warning::$out: the preview never said it was ready"
      adb logcat -d -s ReactNativeJS:V | tail -20
      break
    fi
    sleep 0.5
  done
  sleep 2
  # The emulator's launcher once hung and put its "isn't responding" box over the shot (run 43599840988).
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1 || true
  start=$SECONDS
  while [ $((SECONDS - start)) -lt 8 ]; do
    sleep 0.5
    adb exec-out screencap -p > "$out.tmp"
    cur="$(md5sum < "$out.tmp")"
    if [ "$cur" = "$prev" ]; then same=$((same + 1)); else same=0; fi
    [ "$same" -ge 2 ] && break
    prev="$cur"
  done
  mv "$out.tmp" "$out"
  if adb shell dumpsys window | grep -q "Application Not Responding"; then
    echo "::warning::$out: a system dialog was on screen"
  fi
  echo "Captured $out"
}

# Stop the emulator's own apps from showing "isn't responding" boxes over the shots (review 3, item 23).
adb shell settings put global hide_error_dialogs 1 || true
adb shell cmd uimode night no
for screen in today food walk detail; do
  capture clean "$screen" "smoke/clean-$screen.png"
done

# The bar's plus: chats and groups.
capture clean plus smoke/clean-plus-tab.png
# Activity: Health and Workouts at the top, then the health readings.
capture clean activity smoke/clean-activity.png

# Every look's Today and Food, so each look's colours are checked (owner, 15 Nov 2026).
for look in park a b c d e f; do
  capture "$look" today "smoke/look-$look-today.png"
  capture "$look" food "smoke/look-$look-food.png"
done
# Colour blocks' Steps detail (owner asked about its small text, 16 Nov 2026).
capture d detail smoke/look-d-detail.png
# The screens Today's Water and Sleep tiles open (graph, then add and remove), and Activity without them (16 Nov 2026).
capture d detail smoke/look-d-water.png '&kind=water'
capture d detail smoke/look-d-sleep.png '&kind=sleep'
capture d activity smoke/look-d-activity.png
# The good-news ticker's list (16 Nov 2026).
capture d news smoke/look-d-news.png

# The largest common font size: every tile must still fit (fit any phone).
adb shell settings put system font_scale 1.3
capture clean today smoke/clean-today-large-font.png
capture clean activity smoke/clean-activity-large-font.png
adb shell settings put system font_scale 1.0

# The owner's phone: 360 dp wide (1080 px at 480 dpi) with a larger text size.
# The design must scale down to fit, not look oversized.
adb shell wm density 480
adb shell settings put system font_scale 1.2
for screen in today food activity; do
  capture clean "$screen" "smoke/clean-$screen-360dp.png"
done
adb shell settings put system font_scale 1.0
adb shell wm density 420

# The Food result opened on its ingredient editor (T15).
capture clean food smoke/clean-food-edit.png "&edit=1" edit
# The person's own version: the Your version pill, and Use our guess again in the Edit panel.
capture clean food smoke/clean-food-mine.png "&mine=1" mine

# The Clean+ look with the phone in dark mode: it must look the same as the light shots.
adb shell cmd uimode night yes
capture clean today smoke/clean-today-dark.png
capture clean detail smoke/clean-detail-dark.png
adb shell cmd uimode night no

adb logcat -d > smoke/logcat-preview.txt
adb shell am force-stop "$pkg"
ls -l smoke/*.png
