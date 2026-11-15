# T18. Count only walking and running (owner, 15 Nov 2026)

**Problem (owner's phone, Sun 15 Nov 2026):** a morning mostly on a bike showed about 5,000 steps (7:00–9:00). Google's step recorder and the app's own counter agree, because both read the same step chip, which counts bike bumps as steps. Neither removes riding.

**Owner's rule:** keep only minutes that fall inside the walking and running pattern; exclude everything else. Among the excluded minutes, find the ones that look like cycling and ask the person. One rule for every user, tuned on the owner's and testers' data, never per person.

## How a minute is judged

Each minute with steps gets these figures (in the app's own background counter service, which may read sensors):

1. **Steps per minute** (already stored).
2. **Rhythm:** how regular the steps are (walking and running: steady, about 90–180 a minute).
3. **Forward push and braking:** the accelerometer, split into up-down and forward using gravity, smoothed over about 2 s so footstep jolts cancel; the strongest forward speed-up and the hardest slow-down in the minute (m/s²).
4. **Speed gained in the biggest burst:** the smoothed forward acceleration added up over 5–10 s (short, so sensor drift stays small).
5. **Engine buzz:** shaking energy well above step rhythm. The phone is read at about 25 Hz, so only 6 to 12.5 Hz can be seen; faster vibration (a 30 Hz engine, say) folds down to a low frequency and shows as no buzz. Buzz is a hint (rough road, engine at some speeds), never proof; T18b sets the real range from the owner's numbers, and a faster sample period for the buzz part is the option if 25 Hz proves too slow.
6. **Android's activity signal** (Activity Recognition transitions, all day): walking, running, still, on bicycle, in vehicle.
7. **GPS speed and stride** (only during recorded walks and rides): stride = metres a minute ÷ steps a minute; a person's stride is under about 2 m.

Battery: the accelerometer is read only while the step chip reports steps, in short batched bursts (about 10 s a minute, hardware FIFO), never while still.

## Starting ranges (to be checked against real data before removal is on)

| Movement | Forward speed-up | Slow-down | Speed gained in a burst | Top speed |
| --- | --- | --- | --- | --- |
| Walking | 0–0.3 m/s² | small | under 1.5 m/s | about 1.5 m/s |
| Walk → run | 1–2 m/s² for 1–2 s | gentle | under 4 m/s | about 4 m/s |
| Bicycle | 0.5–1.5 m/s² | 1–3 m/s² | 5–7 m/s | 5–7 m/s |
| Motorbike, scooter | 1–3 m/s² for several s | 2–6 m/s², sharp at speed breakers | 8–15 m/s | 8–15 m/s |
| Car, bus | 1–3 m/s² | 3–8 m/s² | above any person | above any person |

A minute is **kept** when it fits walking or running (steady rhythm, gentle push and braking, human speed gain, stride under 2 m when GPS exists). Anything else is **excluded**. No single signal removes a minute by itself; at least two must disagree with walking/running.

Over about 220 steps a minute is always excluded.

## Cycling question

- Excluded minutes that look like pedalling (bicycle push and braking range, no engine buzz, Android says bicycle when it says anything) are grouped into a stretch.
- The app asks once: "Were you cycling 8:05–8:40?"
  - **Yes:** saved as a cycling ride (no route, time only); the steps stay out.
  - **No, I was walking:** the steps go back in.
  - **No, I was in a vehicle:** they stay out.
- Rides the person recorded are already cycling; no question.
- On a day's detail screen the person can also mark a time as "I was riding" or undo a removal.

## Phases

1. **T18a: record, remove nothing (next build).** Native: Activity Recognition transitions all day; accelerometer bursts while steps happen; per-minute figures stored in StepStore. App: Step check, tap an hour to see each minute (steps from recorder and counter, rhythm, push, braking, speed gained, buzz, Android's signal); recorded walks show speed, pace and stride per part. Tests for the per-minute maths (pure Kotlin or TS functions).
2. **T18b: owner checks** a bike day and a walk day with Opus; the ranges above are set from real numbers.
3. **T18c: exclusion on,** the cycling question, and the detail-screen correction. Step check shows "On a bike or vehicle: N steps removed".
4. **Later, optional:** all-day low-power location for people who turn it on, so the stride check works all day (needs "all the time" location and Google review).

## Not in this task

Changing how Health Connect sources from other apps are read; iOS (HealthKit already filters on the iPhone side).
