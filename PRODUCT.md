# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

(Android first. The codebase is Expo / React Native and keeps an iOS target and widget for later; no iOS release is planned yet.)

## Users

Confirmed by the owner (13 Nov 2026), all four matter:

- **Everyday adults, 25–55:** busy people keeping an eye on steps, food and weight through an ordinary day.
- **Older parents, 55+:** need bigger text, very simple screens and obvious buttons.
- **Fitness-focused people:** walkers, runners and cyclists who want detail about their activity.
- **People managing weight, blood sugar or blood pressure,** sometimes with a coach or a wellness programme.

They are mostly in India, and the app is meant for the whole world.

## Product Purpose

A daily health companion on the phone:
- steps counted automatically;
- food logged by typing what was eaten in any language, with calories plus vitamins, minerals and watch-outs worked out;
- walks and rides recorded with GPS;
- sleep, heart rate, blood pressure, weight, water and mood in a journal;
- insights that connect them.

Success: people log food and water without effort, understand their day at a glance, and come back daily.

## Positioning

- **Food in plain words, in any language and any country's dishes**, including home-made versus restaurant versions and the person's own recipes. It gives 33 nutrients, not just calories.
- **Numbers that are consistent:** the AI only names ingredients and grams; our code adds up the nutrients from a fixed food list. So the same dish always gets the same numbers, and an unknown value is never shown as zero.
- **Today's steps are free;** everything else is Steps Premium.

## Operating Context

- Used in short glances through the day: after a meal, during or after a walk, at bedtime, when a reminder comes.
- Often one-handed, outdoors in bright light, or by an older parent.
- Works offline on the phone (SQLite) and syncs day summaries to the server.
- Reads and writes Health Connect.
- Testers install builds from GitHub Releases.

## Capabilities and Constraints

- **Stack:** Expo SDK 58, expo-router, React Native, custom native Android modules (step counter, walk service, Block Store, passkeys). Built by GitHub Actions; never built locally.
- **Backend:** AWS in Mumbai. Phone-based sign-in, with email recovery through Amazon SES.
- **Premium:** free accounts see only today's steps and daily goal; while testing, everyone has premium.
- **Languages:** text must be able to render many Indian scripts (Devanagari, Telugu, Tamil, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Odia) as well as Latin. Any chosen typeface needs full fallback for these scripts.
- **Name:** "Steps" is a working name and may change. Nothing in the design may depend on the word "Steps".
- **Main features, which must be easy to reach:** Steps (today), Food, Walks and Cycling (in progress), Journal (sleep, heart, blood pressure, weight, water, mood), Goals and badges, Insights, Settings.

## Brand Commitments

- **Parent company:** Neutcrafts (neutcrafts.in), which builds several apps. No logo or colour has to be kept.
- **Owner's binding direction (13 Nov 2026, from tester feedback):**
  - the type must not read like paragraphs;
  - the colours must not look outdated;
  - it should feel premium, with nothing shiny or glittering;
  - it should be pleasant to read and interact with;
  - Food must be top-level, beside Steps and Cycling, not in a sub-menu;
  - nobody should have to hunt for a feature or button.
- **Voice:** short, plain and kind. No error codes, no medical claims, and "talk to a doctor" where it matters.

## Evidence on Hand

- Tester feedback, relayed by the owner: the font reads like paragraphs, the colours look outdated, and Food is hard to find.
- No testimonials, press, customer logos or benchmarks exist. None may be invented.

## Product Principles

1. **Glance, don't read.** A number, a ring or a short label beats a sentence; details are one tap away.
2. **Everything one tap from home.** The main features live in the bottom bar or on Today; no feature is hidden behind two levels of menus.
3. **Trustworthy numbers.** Show what we know and say what we don't. Unknown is never zero, and estimates say they're estimates.
4. **Works for a 60-year-old and a cyclist alike.** Simple by default, detail on demand.
5. **Calm, never preachy.** Gentle nudges, capped in number. Good days are noticed, and short days aren't scolded.

## Accessibility & Inclusion

- Respect the phone's text-size setting up to large sizes without breaking layouts.
- Large touch targets, at least 48 dp.
- Strong contrast, readable outdoors.
- Colour is never the only signal for a state.
- Must work on budget Android phones.
- Indian scripts must render correctly.
