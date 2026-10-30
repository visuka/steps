# Food catalog

`src/nutrition/foods.generated.ts` is built from USDA FoodData Central (SR Legacy, public domain)
plus rough home recipes for Indian dishes. To change foods, portions or recipes, edit
`build_catalog.py` and regenerate; don't edit the generated file.

```bash
mkdir -p fdc
python fetch_fdc.py fdc fruit    # one request per batch: fruit, veg, grain, animal
python fetch_fdc.py fdc veg
python fetch_fdc.py fdc grain
python fetch_fdc.py fdc animal
python build_catalog.py fdc ../../src/nutrition/foods.generated.ts
```

`fetch_fdc.py` uses the public `DEMO_KEY`, which allows about 10 requests an hour; get a free key
at api.data.gov for heavier use. Paneer isn't in SR Legacy, so its values are a rough estimate
from typical labels (see `PANEER`).
