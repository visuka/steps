# Review 5 — CI screenshots against the spec (T12, Opus, 14 Nov 2026)

Source: CI run 43618948597 (0844c07, all four jobs green), artifact `smoke-test` in `smoke-ci5/` (not committed).
No system dialog in any shot, and no crash in `crash.txt`.

- **Walk:** both review 4 fixes worked. The pace sparkline now goes up and down across the whole width, as in
  the mockup (item 24). The removed part reads "Vehicle · 6 min · removed" with the speed gauge in a grey circle
  and "Keep" in accent (item 25, the owner's decision overrides the mockup's "Car"). The route, the dotted
  vehicle stretch, 2.3 km, the four stat cards and Parts all match.
- **Today and Food result:** unchanged from review 4, and they still match the mockups.

## Items

None.

## For the owner

- The Vehicle icon is a gauge, close to the Pace card's gauge. If you'd like them to look different, that is a
  one-line change in `src/components/ui/icon-paths.ts` and spec section 8.
- Still accepted as before: "Good afternoon", real map tiles with the ⓘ, **Delete walk**, and the "Updated 2 min
  ago · Sample day" line.

## Next

The owner looks at the screenshots and gives the final design OK. That closes T12.
