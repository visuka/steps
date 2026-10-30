"""Fetches USDA FoodData Central (SR Legacy) nutrients for exact food descriptions.

Usage: python -I fetch_fdc.py OUT_DIR BATCH_NAME
Reads the batch's descriptions from BATCHES, makes one POST search with an OR query,
saves the raw response and prints which descriptions were not found.
"""
import json
import sys
import urllib.request

BATCHES = {
    "fruit": [
        "Bananas, raw", "Apples, raw, with skin", "Mangos, raw", "Oranges, raw, all commercial varieties",
        "Papayas, raw", "Guavas, common, raw",
        "Grapes, red or green (European type, such as Thompson seedless), raw", "Watermelon, raw",
        "Pineapple, raw, all varieties", "Pomegranates, raw", "Sapodilla, raw", "Jackfruit, raw", "Pears, raw",
        "Melons, cantaloupe, raw", "Litchis, raw", "Strawberries, raw", "Sugar-apples, (sweetsop), raw",
        "Dates, medjool", "Nuts, coconut meat, raw", "Plums, raw", "Kiwifruit, green, raw", "Figs, raw",
        "Raisins, seedless", "Nuts, almonds", "Nuts, cashew nuts, raw", "Nuts, walnuts, english",
        "Peanuts, all types, dry-roasted, without salt", "Lemons, raw, without peel",
    ],
    "veg": [
        "Potatoes, boiled, cooked without skin, flesh, without salt", "Onions, raw",
        "Tomatoes, red, ripe, raw, year round average", "Spinach, raw",
        "Spinach, cooked, boiled, drained, without salt", "Carrots, raw", "Cabbage, raw",
        "Cauliflower, cooked, boiled, drained, without salt", "Eggplant, cooked, boiled, drained, without salt",
        "Okra, cooked, boiled, drained, without salt", "Peas, green, cooked, boiled, drained, without salt",
        "Beans, snap, green, cooked, boiled, drained, without salt",
        "Gourd, white-flowered (calabash), cooked, boiled, drained, without salt",
        "Balsam-pear (bitter gourd), pods, cooked, boiled, drained, without salt", "Cucumber, with peel, raw",
        "Beets, raw", "Sweet potato, cooked, boiled, without skin", "Peppers, sweet, green, raw",
        "Pumpkin, cooked, boiled, drained, without salt", "Mushrooms, white, raw", "Drumstick pods, raw",
        "Radishes, raw", "Corn, sweet, yellow, cooked, boiled, drained, without salt",
        "Broccoli, cooked, boiled, drained, without salt", "Lettuce, cos or romaine, raw",
        "Coriander (cilantro) leaves, raw", "Garlic, raw", "Ginger root, raw", "Peppers, hot chili, green, raw",
        "Mustard greens, cooked, boiled, drained, without salt",
    ],
    "grain": [
        "Rice, white, long-grain, regular, enriched, cooked", "Rice, brown, long-grain, cooked",
        "Bread, chapati or roti, plain, commercially prepared",
        "Bread, chapati or roti, whole wheat, commercially prepared, frozen",
        "Bread, naan, plain, commercially prepared, refrigerated",
        "Bread, white, commercially prepared (includes soft bread crumbs)", "Bread, whole-wheat, commercially prepared",
        "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt",
        "Wheat flour, whole-grain", "Semolina, enriched", "Millet, cooked", "Rice flour, white",
        "Lentils, mature seeds, cooked, boiled, without salt",
        "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt",
        "Beans, kidney, all types, mature seeds, cooked, boiled, without salt",
        "Mung beans, mature seeds, cooked, boiled, without salt",
        "Mungo beans, mature seeds, cooked, boiled, without salt",
        "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt",
        "Soybeans, mature cooked, boiled, without salt", "Tofu, raw, firm, prepared with calcium sulfate",
        "Pasta, cooked, enriched, without added salt", "Peanut butter, smooth style, without salt",
        "Sugars, granulated", "Honey", "Oil, canola", "Oil, coconut", "Oil, mustard", "Butter, salted",
        "Butter oil, anhydrous", "Rice, white, long-grain, regular, raw, enriched",
    ],
    "animal": [
        "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
        "Chicken, broilers or fryers, thigh, meat only, cooked, roasted", "Lamb, ground, cooked, broiled",
        "Game meat, goat, cooked, roasted", "Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled",
        "Egg, whole, cooked, hard-boiled", "Egg, whole, cooked, fried", "Egg, whole, cooked, omelet",
        "Crustaceans, shrimp, cooked", "Crustaceans, shrimp, mixed species, cooked, moist heat",
        "Fish, carp, cooked, dry heat", "Fish, salmon, Atlantic, farmed, cooked, dry heat",
        "Fish, mackerel, Atlantic, cooked, dry heat", "Fish, mackerel, king, cooked, dry heat",
        "Fish, butterfish, cooked, dry heat", "Fish, tilapia, cooked, dry heat",
        "Fish, sardine, Atlantic, canned in oil, drained solids with bone",
        "Fish, tuna, light, canned in water, drained solids", "Crustaceans, crab, blue, cooked, moist heat",
        "Milk, whole, 3.25% milkfat, with added vitamin D",
        "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", "Milk, indian buffalo, fluid",
        "Yogurt, plain, whole milk", "Cheese, cheddar", "Cheese, mozzarella, whole milk",
        "Cheese, cottage, creamed, large or small curd", "Cream, fluid, heavy whipping",
        "Milk, buttermilk, fluid, cultured, lowfat", "Ice creams, vanilla",
        "Beverages, tea, black, brewed, prepared with tap water",
        "Beverages, coffee, brewed, prepared with tap water", "paneer",
    ],
}


def main():
    out_dir, batch = sys.argv[1], sys.argv[2]
    names = BATCHES[batch]
    query = " OR ".join(f'"{n}"' if " " in n or "," in n else n for n in names)
    body = json.dumps({"query": query, "dataType": ["SR Legacy"], "pageSize": 200}).encode()
    req = urllib.request.Request(
        "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        print("remaining", res.headers.get("X-Ratelimit-Remaining"))
        data = json.load(res)
    with open(f"{out_dir}/{batch}.json", "w", encoding="utf-8") as f:
        json.dump(data, f)
    found = {f["description"].lower() for f in data.get("foods", [])}
    print("hits", data.get("totalHits"), "returned", len(data.get("foods", [])))
    for n in names:
        if n.lower() not in found:
            near = [f["description"] for f in data.get("foods", []) if n.split(",")[0].lower() in f["description"].lower()]
            print("MISSING", n, "| near:", near[:4])


main()
