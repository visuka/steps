#!/usr/bin/env bash
# Installs an APK on the running emulator, opens it, and keeps the evidence in
# smoke/: install output, logcat, a screenshot, and whether the app is still
# alive 30 seconds after launch. Fails the job if it isn't.
#
# Then photographs the app's one look, Calm and large (theme e), over the
# mockup's sample day (app/design-preview.tsx): smoke/calm-<screen>.png at the
# emulator's own size, with a large font, at 360 dp, and with the phone in dark
# mode (the look must stay light). The emulator runs with animations off, so
# every photo shows the screens at rest; last, animations are switched on and
# Today and the steps Detail are filmed (smoke/motion-*.mp4) so the movement
# can be seen. These are evidence only: they never fail the job.
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
for screen in today food walk detail plus activity news; do
  capture e "$screen" "smoke/calm-$screen.png"
done
# The screens Today's Water and Sleep tiles open (graph, then add and remove).
capture e detail smoke/calm-water.png '&kind=water'
capture e detail smoke/calm-sleep.png '&kind=sleep'
# The Food result opened on its ingredient editor (T15), and as the person's own version.
capture e food smoke/calm-food-edit.png "&edit=1" edit
capture e food smoke/calm-food-mine.png "&mine=1" mine
# Today in each part of the day's colours (T18: Dawn, Noon, Dusk).
for part in dawn noon dusk; do
  capture e today "smoke/calm-today-$part.png" "&part=$part" "$part"
done

# The largest common font size: every tile must still fit (fit any phone).
adb shell settings put system font_scale 1.3
capture e today smoke/calm-today-large-font.png '&part=noon' noon
capture e activity smoke/calm-activity-large-font.png
adb shell settings put system font_scale 1.0

# The owner's phone: 360 dp wide (1080 px at 480 dpi) with a larger text size.
adb shell wm density 480
adb shell settings put system font_scale 1.2
capture e today smoke/calm-today-360dp.png '&part=noon' noon
for screen in food activity; do
  capture e "$screen" "smoke/calm-$screen-360dp.png"
done
adb shell settings put system font_scale 1.0
adb shell wm density 420

# With the phone in dark mode: it must look the same as the light shots.
adb shell cmd uimode night yes
capture e today smoke/calm-today-dark.png
capture e detail smoke/calm-detail-dark.png
adb shell cmd uimode night no

# --- Every screen ------------------------------------------------------------
# The rest of the app over the sample day (17 Nov 2026), each scrolled to its
# end: smoke/all-<screen>.png, then -2, -3… for each further screenful.
more() {
  local base="$1" i prev cur
  prev="$(md5sum < "$base.png")"
  for i in 2 3 4 5 6; do
    adb shell input swipe 540 1700 540 700 400
    sleep 1.5
    adb exec-out screencap -p > "$base-$i.png"
    cur="$(md5sum < "$base-$i.png")"
    if [ "$cur" = "$prev" ]; then rm -f "$base-$i.png"; break; fi
    prev="$cur"
  done
}
for screen in you foodtab buddies settings insights stepcheck places record scan find requests signin welcome; do
  capture e "$screen" "smoke/all-$screen.png" && more "smoke/all-$screen"
done
for section in workouts bp weight; do
  capture e activity "smoke/all-activity-$section.png" "&section=$section" && more "smoke/all-activity-$section"
done
for kind in active food; do
  capture e detail "smoke/all-detail-$kind.png" "&kind=$kind" && more "smoke/all-detail-$kind"
done
capture e chat smoke/all-chat.png '&key=b.p1&title=Ravi'
capture e walker smoke/all-walker.png '&pid=p1&name=Ravi&handle=ravi_walks'
# The long screens CI already photographs, the rest of the way down.
for screen in food walk detail activity plus; do
  capture e "$screen" "smoke/all-$screen.png" && more "smoke/all-$screen"
done

# --- Motion ------------------------------------------------------------------
# Animations on (the emulator starts with them off), then 8 s of each screen
# from the moment it opens: the cards rising in, the counting, the walker, the
# bowl, glass and moon, the charts growing.
film() {
  local screen="$1" out="$2" extra="${3:-}"
  adb shell am force-stop "$pkg"
  adb shell rm -f /sdcard/motion.mp4
  adb shell screenrecord --time-limit 9 --bit-rate 6000000 /sdcard/motion.mp4 &
  local rec=$!
  sleep 1
  adb shell "am start -a android.intent.action.VIEW -d '$scheme://design-preview?theme=e&screen=$screen$extra' $pkg" > /dev/null
  wait "$rec" || true
  sleep 1
  adb pull /sdcard/motion.mp4 "$out" > /dev/null && echo "Filmed $out" || echo "::warning::$out: no film"
}
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$scale" 1
done
film today smoke/motion-today.mp4
film detail smoke/motion-detail.mp4
film food smoke/motion-food.mp4
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$scale" 0
done
adb logcat -d > smoke/logcat-preview.txt
adb shell am force-stop "$pkg"
ls -l smoke/*.png smoke/*.mp4
