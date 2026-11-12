# Food catalog

`src/nutrition/foods.generated.ts` is built from USDA FoodData Central (SR Legacy, public domain)
plus rough home recipes for Indian dishes. To change foods, portions or recipes, edit
`build_catalog.py` and regenerate; don't edit the generated file. Then copy it to the food Lambda
(`stepsinfra`: `node scripts/import-foods.mjs ../pedometer/src/nutrition/foods.generated.ts`).

```bash
mkdir -p fdc
python -I fetch_fdc.py fdc fruit    # one request per batch: fruit, veg, grain, animal, raw
python -I fetch_fdc.py fdc veg
python -I fetch_fdc.py fdc grain
python -I fetch_fdc.py fdc animal
python -I fetch_fdc.py fdc raw
python -I build_catalog.py fdc ../../src/nutrition/foods.generated.ts
```

`fetch_fdc.py` uses the public `DEMO_KEY`, which allows only about 10 requests an hour; get a free
key at api.data.gov for heavier use. The search results carry every nutrient, so one request per
batch is enough. A `MISSING` line is fine when the build uses the near match it prints.

## Batches

- **fruit, veg, grain, animal**: the foods people log (rice, dal, fruit, curd, chicken...).
- **raw**: recipe ingredients as bought: raw dals, flours, raw vegetables, raw meat and fish, salt,
  spices, oils, vanaspati and coconut milk. When someone types a recipe, the server starts from
  these raw amounts and applies cooking losses itself.

Rice, maida, semolina and pasta are the **unenriched** kinds: Indian ones don't have the iron,
thiamin and folic acid added to US ones. Naan is built as a dish from maida, not USDA's naan (US
enriched flour). USDA white bread keeps its other values, but its added iron, thiamin, riboflavin,
niacin and folate are left out (`UNFORTIFIED`): most Indian bread has none added, some brands do.

Some USDA foods stand in for Indian ones and say so in `source`: brown sugar for jaggery, household
shortening for vanaspati (its trans fat set to India's legal limit of 2 g per 100 g), cayenne for red
chilli powder (USDA "chili powder" is a salted US blend), and soybean oil for "refined oil". Soybean
oil is common at home in India and USDA gives its trans fat. It has about 7 g of plant omega-3 per
100 g, so dishes cooked in it show some omega-3 from the oil. Sunflower and palm oil have almost none,
but USDA gives no trans fat for them.

Two foods aren't in SR Legacy and are rough estimates typed in by hand: paneer (`PANEER`, from typical
labels) and ragi flour (`RAGI`, from IFCT 2017 and NIN tables). USDA's "millet" is proso millet, so
ragi has its own food: it has far more calcium.

## What the numbers mean

- All values are per 100 g. A missing nutrient means **not known**, never zero. The build fills in
  0 only where a nutrient can't be there: no cholesterol, vitamin B12, vitamin D or trans fat in plant
  foods (oils keep USDA's trans fat), no caffeine or alcohol except in tea and coffee.
- **Added sugar** is 0 for whole and plain foods, all of the sugar in sugar, jaggery and honey, and
  left out for packaged foods where it isn't known (ice cream, bread, peanut butter).
- **Glycemic load** (`gl`) is GI × (carbs − fibre) ÷ 100. GI values in `GI` are typical published
  ones (International Tables of Glycemic Index, Atkinson et al. 2008 and 2021, and Indian studies),
  rounded; real GI varies with variety, ripeness and cooking. Foods with less than 1 g of available
  carbs get 0. The build stops if a food with carbs has no GI.
- **Dishes** add up their ingredients like any nutrient, `gl` included. A dish's nutrient is left out
  when ingredients with no value for it weigh 5% or more of the dish (the same rule as the Lambda).
- **Salt** is in every dish that is normally salted, at typical home amounts (estimates): about 1% of
  the batch for dals, curries, sabzis, rice dishes and snacks, less for batters and doughs, none in
  chai, coffee or sweet lassi. Most sodium in Indian meals comes from this salt, so leaving it out
  would hide it.

## Ingredient-only foods

Foods in `INGREDIENT_ONLY` get `ingredientOnly: true`: raw dals, flours, raw vegetables, meat and
fish, salt, spices, palm oil, vanaspati, coconut milk. They are for recipes and AI estimates, not
offered in the app's food search. Their aliases all say "raw" (or name only the ingredient), and they
come last in the list, so a person typing "toor dal" or "chicken breast" gets the cooked food.

Also set when it applies: `cooked: true` (USDA says cooked, boiled, roasted, fried, brewed or canned;
breads; every dish), so the server doesn't apply cooking losses twice, and `flags: ['deep-fried']`.

## Names

The food Lambda reads simple text ("2 cups tea") by exact name: a food's id, its name, its name
without the brackets, then aliases. The app's search ranks an exact alias first. Keep them agreeing:

- A plain food never carries a dish's name as an alias ("rajma", "chole", "sarson ka saag"). The
  dish has salt and oil the plain food doesn't, so the alias would hide them.
- A name without its brackets mustn't be a word another food owns as an alias. That's why the
  plain drinks are "Black tea (no milk)", "Black coffee (no milk)" and "Cultured buttermilk (US
  style)": "tea", "coffee" and "buttermilk" are chai, filter coffee and chaas.
- One alias, one food: "palak" is cooked spinach only.

Units agree with each other: a tablespoon is about 3 teaspoons and a cup about 16 tablespoons
(besan 92 g a cup, 6 g a tablespoon; honey 7 g a teaspoon, 21 g a tablespoon).
