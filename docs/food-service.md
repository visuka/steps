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
| Dishes the AI worked out (shared by everyone, no user ids) | DynamoDB `steps-food`, `PK DISH / SK <name>`: units, ingredients in grams, and the name's embedding | One item per dish, read by key; nutrients are recomputed from the ingredients when served |
| Descriptions already read | `steps-food`, `PK TEXT#<hash> / SK TEXT` | "2 masala dosa" asked again costs nothing |
| Recipes already read | `steps-food`, `PK RECIPE#<hash> / SK RECIPE` | The same recipe text asked again costs nothing |
| What a person ate | On the phone (`food_log`: food id, unit, quantity); day totals in `steps-user-data` `PK USER#<id> / SK DAY#<date>` with a `nutrients` map | Day totals for every nutrient; trends on the server |
| AI foods and recipes a person used | On the phone (`saved_food`, the whole `FoodItem` as JSON) | Searchable again and loggable offline |

Semantic similarity: dish names are embedded (OpenAI `text-embedding-3-small`, 256 numbers) and
compared in the Lambda by brute force. A name scoring 0.90 or more against a stored dish reuses
it. A few thousand dishes compare in milliseconds; a vector database would cost more each month
than the model calls it saves.

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
{ "description": "200 g chicken biryani and a lassi" }
```

```json
{
  "items": [
    {
      "food": FoodItem,
      "unit": "g",
      "quantity": 200,
      "ingredients": [{ "name": "Rice (cooked)", "grams": 165 }],
      "cached": true
    }
  ],
  "unknown": ["grandma's kootu"]
}
```

- `FoodItem` is `src/nutrition/types.ts`: `per100g`, `units` (always including `g`),
  `defaultUnit`, `source`, optional `flags` (`"deep-fried"`), `ingredients` (per first unit).
- `unknown` lists dish names the model couldn't work out. The app offers the recipe form for them.
- Simple text ("200 g rice", "2 idli and sambar", "1 bowl dal") is read without the model when
  every part is a known food or a cached dish: **no model call at all**.
- Errors: 400 `bad_request`, 422 `not_food` (not about food or drink), 429 `daily_limit`,
  503 `unavailable` (no model answered, or no key yet).

## `POST /v1/food/recipe`

```json
{
  "name": "Grandma's kootu",
  "ingredients": "1 cup moong dal, 2 cups ash gourd, half coconut grated, 2 tsp oil, salt",
  "steps": "Pressure cook dal and ash gourd for 2 whistles. Grind coconut with cumin, add, simmer 5 min. Temper with mustard seeds in oil.",
  "servings": 4,
  "unit": "bowl"
}
```

`ingredients` and `steps` up to 1,500 characters each; `servings` 1–50 and `unit` (one of
`bowl, plate, piece, glass, cup, serving`) are optional (the model estimates them).

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
