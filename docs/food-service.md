# Food estimate service (planned)

The app ships with a built-in food list (`src/nutrition/foods.generated.ts`). For anything not in
it, the plan is an AI service: the person types what they ate ("2 masala dosa with coconut
chutney") and gets calories and nutrients back. This note fixes the contract so the app and the
Lambda can be built separately.

## Flow

1. App sends the description to the food Lambda over HTTPS.
2. Lambda checks a **semantic cache**: an embedding of the normalised description, matched by
   similarity, so "2 masala dosas" and "two masala dosa" reuse one answer.
3. On a miss, a model breaks the dish into ingredients with grams per portion, looks each one up
   (the same USDA-based values as the app, or better Indian sources), adds them up, and stores
   the result in the cache.
4. App shows the result in the normal portion picker; the person can correct it like any food.

## Security

- No model or AWS keys in the app. The app calls our API only.
- Signed-in users only (Cognito or similar), plus app attestation (Play Integrity on Android,
  App Attest on iOS) so only the real app can call it.
- Rate limit per user; log descriptions without personal data.

## Request

```json
{ "description": "2 masala dosa with coconut chutney", "locale": "en-IN" }
```

## Response

The same shape as a catalog food (`FoodItem` in `src/nutrition/types.ts`), with nutrients per
100 g and the units it was asked about, plus the breakdown so people can see where numbers come
from:

```json
{
  "food": {
    "id": "ai:9f2c…",
    "name": "Masala dosa with coconut chutney",
    "aliases": [],
    "category": "dish",
    "per100g": { "kcal": 150, "protein": 3.1, "carbs": 21, "fat": 6, "fiber": 2.2, "vitC": 3 },
    "units": [{ "key": "piece", "label": "masala dosa with chutney", "grams": 210 }],
    "defaultUnit": "piece",
    "source": "AI estimate from ingredients"
  },
  "quantity": 2,
  "ingredients": [
    { "name": "Dosa batter (rice, urad dal)", "grams": 90 },
    { "name": "Potato masala", "grams": 80 },
    { "name": "Coconut chutney", "grams": 40 }
  ],
  "cached": true
}
```

Nutrient keys and units are the app's (`NutrientKey` in `src/nutrition/types.ts`): kcal, g for
macros, mg or µg as listed in `src/nutrition/nutrients.ts`. Unknown nutrients are left out, not
sent as zero.

The app would save an AI food like an own food (so it can be logged again offline) and keep the
entry as food + unit + quantity, so portion corrections recalculate past entries the same way.
