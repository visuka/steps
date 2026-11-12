# Food service

The app ships with a built-in food list (`src/nutrition/foods.generated.ts`). For anything not in
it, the person types what they ate ("2 masala dosa with coconut chutney") and the food Lambda in
`stepsinfra` (`POST /v1/food/estimate`) answers. When it doesn't know a dish, the person says how
they made it and `POST /v1/food/recipe` works it out.

## The rule that keeps numbers right and cheap

The model never states nutrients. It only says **what a dish is made of, in grams** (and, for a
recipe, how each part was cooked). Our code adds up the nutrients from the ingredient list, so:

- the same dish always gets the same numbers;
- better ingredient data fixes every dish at once;
- everything is stored **per 100 g**, so 200 g is 2 × the 100 g figures: plain arithmetic on the
  phone, no model call.

## Where things are stored

| What | Where | Why |
| --- | --- | --- |
| Ingredients and built-in foods (rice, dal, oil, salt…), nutrients per 100 g | `foods.generated.ts` in the app, copied to `foods.json` in the Lambda | Fixed reference data, read on every request: a file is instant and free |
| Dishes the AI worked out (shared by everyone, no user ids) | DynamoDB `steps-food`, `PK DISH / SK <name>`: units, ingredients in grams, and the name's embedding. Restaurant style under `SK R#<name>`, or `R#<restaurant>#<name>` when a restaurant was named | One item per dish, read by key; nutrients are recomputed from the ingredients when served |
| Descriptions already read | `steps-food`, `PK TEXT#<hash> / SK TEXT` | "2 masala dosa" asked again costs nothing |
| Recipes already read | `steps-food`, `PK RECIPE#<hash> / SK RECIPE` | The same recipe text asked again costs nothing |
| What a person ate | On the phone (`food_log`: food id, unit, quantity, place, restaurant); day totals in `steps-user-data` `PK USER#<id> / SK DAY#<date>` with a `nutrients` map | Day totals for every nutrient; trends on the server. Where each meal was from stays on the phone |
| AI foods and recipes a person used | On the phone (`saved_food`, the whole `FoodItem` as JSON, with the phone's own `style`, `restaurant` and `homeId` notes) | Searchable again and loggable offline |

Semantic similarity: dish names are embedded (OpenAI `text-embedding-3-small`, 256 numbers) and
compared in the Lambda by brute force. A name scoring 0.90 or more against a stored dish reuses
it, but only within its own kind: home dishes (and those from before places) with home dishes,
restaurant ones with restaurant ones, and one restaurant's with that restaurant's. A home dal never
stands in for a restaurant one. A few thousand dishes compare in milliseconds; a vector database
would cost more each month than the model calls it saves.

## Nutrient keys

Shared by the app (`src/nutrition/types.ts`, `nutrients.ts`), the Lambda (`food/catalog.py`) and
day records (`data/days.py`). Values per 100 g. Unknown nutrients are left out, never sent as zero.

| Key | Unit | Decimals | | Key | Unit | Decimals |
| --- | --- | --- | --- | --- | --- | --- |
| kcal | kcal | 0 | | vitC | mg | 1 |
| protein | g | 1 | | thiamin (B1) | mg | 2 |
| carbs | g | 1 | | riboflavin (B2) | mg | 2 |
| fiber | g | 1 | | niacin (B3) | mg | 2 |
| sugars | g | 1 | | vitB6 | mg | 2 |
| addedSugar | g | 1 | | folate | µg DFE | 0 |
| fat | g | 1 | | vitB12 | µg | 2 |
| satFat | g | 1 | | calcium | mg | 0 |
| transFat | g | 2 | | iron | mg | 2 |
| omega3 | g | 2 | | magnesium | mg | 0 |
| cholesterol | mg | 0 | | phosphorus | mg | 0 |
| vitA | µg RAE | 0 | | potassium | mg | 0 |
| vitD | µg | 1 | | sodium | mg | 0 |
| vitE | mg | 2 | | zinc | mg | 2 |
| vitK | µg | 1 | | selenium | µg | 1 |
| caffeine | mg | 0 | | alcohol | g | 1 |
| gl | (none) | 1 | | | | |

`gl` is glycemic load: GI × (carbs − fibre) ÷ 100. Unlike GI it adds up like grams, so a dish's
`gl` is the sum of its ingredients' and a day's is the sum of its foods'. The app shows a food's
GI as `gl ÷ (carbs − fibre) × 100` when it has at least 5 g of available carbs per 100 g.

`addedSugar` comes from sweeteners in the ingredient list (sugar, jaggery, honey); whole foods
have 0; packaged foods whose added sugar isn't known leave it out.

## `POST /v1/food/estimate`

```json
{ "description": "200 g chicken biryani and a lassi", "place": "dine-in", "restaurant": "Paradise", "country": "IN" }
```

`country` is the phone's region setting as ISO 3166-1 alpha-2, upper case (`IN`, `GB`, `US`), from
expo-localization's `getLocales()[0].regionCode`. The app leaves it out when the phone has none or
it isn't two letters (`419` for Latin America), and the server takes a missing country as `IN`, so
cache keys and answers from before stay the same for India. Anything else that isn't two letters
A–Z is a 400 `bad_request`. Built in `src/api/food-read.ts` (`countryCode`, `estimateRequest`,
`recipeRequest`).

`place` (`home`, `dine-in` or `delivery`) and `restaurant` (up to 60 characters, only with
`dine-in` or `delivery`) are optional. The app sends a place only when the person picked one, so
that the server can read it from the text instead ("ordered pizza", "biryani from Paradise"); a
place the app sends wins over the text.

```json
{
  "items": [
    {
      "food": FoodItem,
      "unit": "g",
      "quantity": 200,
      "ingredients": [{ "name": "Rice (cooked)", "grams": 165 }],
      "cached": true,
      "style": "restaurant"
    }
  ],
  "unknown": ["grandma's kootu"],
  "place": "dine-in",
  "restaurant": "Paradise"
}
```

- `FoodItem` is `src/nutrition/types.ts`: `per100g`, `units` (always including `g`),
  `defaultUnit`, `source`, optional `flags` (`"deep-fried"`), `ingredients` (per first unit).
- `unknown` lists dish names the model couldn't work out. The app offers the recipe form for them,
  in the words both sides share: We couldn't find “<name>” yet. Could you tell us how it's made?
  Then we can count it properly. (`unknownDishMessage` in `src/api/food-read.ts`)
- `style` is how each item was worked out: `home`, `restaurant` (for `dine-in` or `delivery`), or
  `auto` when no place was sent or read from the text, which is how it worked before places.
  The top-level `place` and `restaurant` are what was used: sent, or read from the text.
- Simple text ("200 g rice", "2 idli and sambar", "1 bowl dal") is read without the model when
  every part is a known food or a cached dish: **no model call at all**. In restaurant style the
  built-in dishes and breads don't count as known, since they're home recipes.
- Errors: 400 `bad_request` (also a place that isn't one of the three, a restaurant with no
  `dine-in` or `delivery`, or a country that isn't two letters), 402 `premium_required` (the
  account doesn't have Steps Premium: the app goes free and shows the Premium screen, see
  `src/premium/premium.ts`), 422 `not_food` (not about food or drink), 429 `daily_limit`,
  503 `unavailable` (no model answered, or no key yet).

### Home-made or eaten out

Restaurant versions of dishes usually have more oil, ghee, butter, cream and salt, and bigger
portions, so a restaurant-style estimate is a different food from the home one:

- **Plain foods** (fruit, milk, eggs, raw ingredients) are the same anywhere and match the
  built-in list in any style.
- **Dishes and breads** in the built-in list are home recipes. In restaurant style they go to the
  dish cache or the model with the style: as served in Indian restaurants, or as served at the named
  restaurant if the model knows it, else a typical restaurant version. The restaurant's name is data
  for the prompt (no angle brackets, at most 60 characters), never instructions.
- **Cache keys.** Home and `auto` dishes keep their keys from before places, so nothing cached is
  lost. Restaurant style has its own key space, with the restaurant's normalised name when one was
  given (`R#<name>`, `R#<restaurant>#<name>`). Food ids come from those keys, so the versions never
  clash on the phone: "Chicken biryani", "Chicken biryani (restaurant)", "Chicken biryani
  (Paradise)", with the source "AI estimate, restaurant style".

On the phone (`src/nutrition/place.ts`), each entry records `place` (`home` by default and for
entries from before) and an optional `restaurant`. Recipes are always home-made. When a home dish
(a built-in dish or bread, or an AI food worked out home-style, of any category but fruit and nuts,
since the server keeps a restaurant version of every AI dish) is logged as dine-in or ordered in,
the app logs its restaurant version instead: one already saved, or one look-up of the dish's name
with the place, saved like any AI food with a note of the home dish it came from (`homeId`), so
marking it home-made later switches back. The picker says so before the look-up, since the name
leaves the phone without a tap on Look up. A restaurant dish has the same id whoever asks, so
looking it up directly keeps the `homeId` already saved with it. The same unit is kept ("1 plate"
stays one plate, now a restaurant plate); a unit the other version lacks becomes the same grams.
If the server can't answer (offline, the day's limit), the home version is logged and the entry
says "Home-style values used". A saved restaurant version picked from the food list starts at its
own place (where it was last eaten, else dine-in), not home-made.


## `POST /v1/food/recipe`

```json
{
  "name": "Grandma's kootu",
  "ingredients": "1 cup moong dal, 2 cups ash gourd, half coconut grated, 2 tsp oil, salt",
  "steps": "Pressure cook dal and ash gourd for 2 whistles. Grind coconut with cumin, add, simmer 5 min. Temper with mustard seeds in oil.",
  "servings": 4,
  "unit": "bowl",
  "country": "IN"
}
```

`ingredients` and `steps` up to 1,500 characters each; `servings` 1–50 and `unit` (one of
`bowl, plate, piece, glass, cup, serving`) are optional (the model estimates them). `country` as
for `estimate`.

```json
{
  "food": FoodItem,
  "servings": 4,
  "cookedGrams": 820,
  "ingredients": [{ "name": "Moong dal (raw)", "grams": 200, "method": "pressure-cooked" }],
  "notes": ["Salt not listed: 5 g assumed.", "Vitamin C: about 40% lost in cooking."],
  "cached": false
}
```

The food's first unit is one serving (`cookedGrams ÷ servings`). Errors as for `estimate`;
422 `not_food` when the text isn't a recipe.

### How a recipe is worked out (server, no model)

1. The model lists each ingredient as a catalog id (raw versions for raw amounts) or a name with
   macros per 100 g, with grams **as used**, and how it was cooked: `raw, boiled, drained,
   pressure-cooked, steamed, simmered, fried, deep-fried, roasted, grilled`. Oil used for deep
   frying is marked as the frying medium. Salt is listed; if the recipe doesn't say, a typical
   amount is assumed and noted. It also estimates the cooked weight and servings.
2. Nutrients of each raw ingredient are multiplied by **retention factors** for its cooking method
   (rounded from the USDA Table of Nutrient Retention Factors, Release 6): heat-sensitive vitamins
   (C, B1, B2, B3, B6, folate, B12, A, E) lose a share; minerals are lost only when the cooking
   water is thrown away (`drained`). Catalog foods that are already cooked get no factor.
3. Deep-frying oil counts only the oil absorbed: about 15% of the weight of the fried
   ingredients, never more than the oil used.
4. Per 100 g = totals ÷ cooked weight. Cooked weight is kept between 0.3× and 4× the raw weight.
