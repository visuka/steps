# Review 3 — CI screenshots against the spec (T12, Opus, 14 Nov 2026)

Source: CI run 43599840988 (b2b473d, all four jobs green), artifact `smoke-test` in `smoke-ci3/` (not committed).

**Overall:** every shot in this run is covered by an Android system box, "Pixel Launcher isn't
responding", which dims the screen. That's the emulator's own home app hanging, not Steps: the app keeps
drawing underneath. What can be seen under it confirms review 2's fixes:

- **Walk (21, 22):** the route has the mockup's shape (up, east, down, south-west), and the removed car part
  is a dotted line joining the two walk parts. There is no gap.
- **Food (20):** the list ends at Vitamin A; the extra "not counted yet" note is gone.
- **Detail (19):** the light shot shows the steps detail, not the splash.
- **Today:** unchanged from review 2.

The colours can't be judged through the dimming, so one more clean run is needed.

## Items

| # | Difference | Fix (file → value) | Model |
|---|---|---|---|
| 23 | A system "isn't responding" box covers every shot. | `.github/scripts/launch-and-capture.sh`, before the first `capture` → `adb shell settings put global hide_error_dialogs 1`; and in `capture()`, right before the same-frame loop, `adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1 \|\| true`. Also in `capture()`, after `mv`: if `adb shell dumpsys window \| grep -q "Application Not Responding"`, print `::warning::$out: a system dialog was on screen`. Comment why (emulator launcher ANR, run 43599840988). | Haiku |

## Next

1. **Haiku:** "Fix item 23 in docs/design/review-3.md", then commit, push and run CI (standing OK).
2. **Opus:** "Review the CI screenshots" → review 4. If it is clean, you look at the screenshots and give the final OK.
