"""Builds src/nutrition/foods.generated.ts from the fetched USDA SR Legacy data plus recipes.

Usage: python -I build_catalog.py FDC_DIR OUT_TS
"""
import json
import re
import sys

FDC_DIR, OUT = sys.argv[1], sys.argv[2]

# USDA nutrient numbers. omega3, addedSugar and gl are worked out below.
NUTRIENT_NUMBERS = {
    "kcal": "208", "protein": "203", "carbs": "205", "fiber": "291", "sugars": "269", "fat": "204",
    "satFat": "606", "transFat": "605", "cholesterol": "601",
    "vitA": "320", "vitD": "328", "vitE": "323", "vitK": "430", "vitC": "401", "thiamin": "404",
    "riboflavin": "405", "niacin": "406", "vitB6": "415", "folate": "435", "vitB12": "418",
    "calcium": "301", "iron": "303", "magnesium": "304", "phosphorus": "305", "potassium": "306",
    "sodium": "307", "zinc": "309", "selenium": "317", "caffeine": "262", "alcohol": "221",
}
# Decimals from docs/food-service.md, in the order of NutrientKey in types.ts (also the output order).
DECIMALS = {
    "kcal": 0, "protein": 1, "carbs": 1, "fiber": 1, "sugars": 1, "addedSugar": 1, "fat": 1, "satFat": 1,
    "transFat": 2, "omega3": 2, "cholesterol": 0,
    "vitA": 0, "vitD": 1, "vitE": 2, "vitK": 1, "vitC": 1, "thiamin": 2, "riboflavin": 2, "niacin": 2,
    "vitB6": 2, "folate": 0, "vitB12": 2,
    "calcium": 0, "iron": 2, "magnesium": 0, "phosphorus": 0, "potassium": 0, "sodium": 0, "zinc": 2,
    "selenium": 1, "caffeine": 0, "alcohol": 1, "gl": 1,
}
EPA_DHA_DPA = ("629", "621", "631")

usda = {}
for batch in ["fruit", "veg", "grain", "animal", "raw"]:
    for f in json.load(open(f"{FDC_DIR}/{batch}.json", encoding="utf-8"))["foods"]:
        nums = {n["nutrientNumber"]: float(n["value"]) for n in f["foodNutrients"]
                if n.get("nutrientNumber") and n.get("value") is not None}
        values = {key: nums[num] for key, num in NUTRIENT_NUMBERS.items() if num in nums}
        # Omega-3: ALA (the n-3 form, else all 18:3) plus the fish ones. Only when ALA is reported,
        # since in plant foods it is nearly all the omega-3 there is.
        ala = nums.get("851", nums.get("619"))
        if ala is not None:
            values["omega3"] = ala + sum(nums.get(n, 0) for n in EPA_DHA_DPA)
        usda[f["description"].lower()] = {"fdcId": f["fdcId"], "description": f["description"], "n": values,
                                          "nums": nums}


def u(desc):
    hit = usda.get(desc.lower())
    if not hit:
        raise SystemExit(f"not in USDA data: {desc}")
    return hit


# (id, name, aliases, category, USDA description, [(unit key, label, grams)], default unit)
G = ("g", "grams", 1)
BOWL = ("bowl", "bowl (katori)", 150)
CUP = ("cup", "cup", 240)
TBSP = ("tbsp", "tablespoon", 14)
TSP = ("tsp", "teaspoon", 5)
HANDFUL = ("handful", "handful", 28)
PIECE_100 = ("piece", "piece (100 g)", 100)


def spice_tsp(grams):
    return [("tsp", "teaspoon", grams)]


RAW = [
    # Fruit
    ("banana", "Banana", ["kela", "vazhaipazham", "arati pandu"], "fruit", "Bananas, raw", [("piece", "medium banana", 118)], "piece"),
    ("apple", "Apple", ["seb", "saeb"], "fruit", "Apples, raw, without skin", [("piece", "medium apple", 160)], "piece"),
    ("mango", "Mango", ["aam", "mampazham", "mamidi"], "fruit", "Mangos, raw", [("cup", "cup, sliced", 165), ("piece", "whole mango", 200)], "cup"),
    ("orange", "Orange", ["santra", "narangi", "mosambi"], "fruit", "Oranges, raw, all commercial varieties", [("piece", "medium orange", 131)], "piece"),
    ("papaya", "Papaya", ["papita", "omakka", "boppayi"], "fruit", "Papayas, raw", [("cup", "cup, pieces", 145)], "cup"),
    ("guava", "Guava", ["amrood", "peru", "koyya", "jama"], "fruit", "Guavas, common, raw", [("piece", "guava", 55)], "piece"),
    ("grapes", "Grapes", ["angoor", "draksha"], "fruit", "Grapes, red or green (European type, such as Thompson seedless), raw", [("cup", "cup", 151)], "cup"),
    ("watermelon", "Watermelon", ["tarbooz", "tarbuj", "kalingad"], "fruit", "Watermelon, raw", [("cup", "cup, diced", 152)], "cup"),
    ("pineapple", "Pineapple", ["ananas"], "fruit", "Pineapple, raw, all varieties", [("cup", "cup, chunks", 165)], "cup"),
    ("pomegranate", "Pomegranate", ["anar", "anaar", "madulai"], "fruit", "Pomegranates, raw", [("cup", "cup, seeds", 174)], "cup"),
    ("chikoo", "Chikoo (sapota)", ["sapota", "sapodilla", "chiku"], "fruit", "Sapodilla, raw", [("piece", "chikoo", 100)], "piece"),
    ("jackfruit", "Jackfruit", ["kathal", "chakka", "panasa", "pala"], "fruit", "Jackfruit, raw", [("cup", "cup, pieces", 165)], "cup"),
    ("pear", "Pear", ["nashpati", "naspati"], "fruit", "Pears, raw", [("piece", "medium pear", 178)], "piece"),
    ("muskmelon", "Muskmelon", ["kharbuja", "cantaloupe", "kharbooja"], "fruit", "Melons, cantaloupe, raw", [("cup", "cup, diced", 160)], "cup"),
    ("litchi", "Litchi", ["lychee", "lichi"], "fruit", "Litchis, raw", [("piece", "litchi", 10)], "piece"),
    ("strawberries", "Strawberries", [], "fruit", "Strawberries, raw", [("cup", "cup", 152)], "cup"),
    ("custard-apple", "Custard apple", ["sitaphal", "sharifa", "seetha pazham"], "fruit", "Sugar-apples, (sweetsop), raw", [("piece", "fruit", 155)], "piece"),
    ("dates", "Dates", ["khajur", "khajoor", "pericham pazham"], "fruit", "Dates, medjool", [("piece", "date", 24)], "piece"),
    ("coconut", "Coconut (fresh)", ["nariyal", "thengai", "kobbari", "thenga"], "fruit", "Nuts, coconut meat, raw", [("piece", "piece (2 inch)", 45), ("cup", "cup, grated", 80)], "piece"),
    ("plum", "Plum", ["aloo bukhara"], "fruit", "Plums, raw", [("piece", "plum", 66)], "piece"),
    ("kiwi", "Kiwi", ["kiwifruit"], "fruit", "Kiwifruit, green, raw", [("piece", "kiwi", 69)], "piece"),
    ("fig", "Fig (fresh)", ["anjeer", "anjir"], "fruit", "Figs, raw", [("piece", "fig", 50)], "piece"),
    ("lemon", "Lemon", ["nimbu", "lime", "elumichai"], "fruit", "Lemons, raw, without peel", [("piece", "lemon", 58)], "piece"),
    # Nuts
    ("almonds", "Almonds", ["badam"], "nut", "Nuts, almonds", [("piece", "almond", 1.2), HANDFUL], "handful"),
    ("cashews", "Cashews", ["kaju", "mundiri"], "nut", "Nuts, cashew nuts, raw", [("piece", "cashew", 1.5), HANDFUL], "handful"),
    ("walnuts", "Walnuts", ["akhrot"], "nut", "Nuts, walnuts, english", [("piece", "walnut half", 2), HANDFUL], "handful"),
    ("peanuts", "Peanuts (roasted)", ["moongphali", "groundnut", "verkadalai", "palli", "shengdana"], "nut", "Peanuts, all types, dry-roasted, without salt", [HANDFUL, ("tbsp", "tablespoon", 9)], "handful"),
    ("peanut-butter", "Peanut butter", [], "nut", "Peanut butter, smooth style, without salt", [("tbsp", "tablespoon", 16)], "tbsp"),
    # Vegetables
    ("potato", "Potato (boiled)", ["aloo", "batata", "urulaikizhangu", "bangaladumpa"], "vegetable", "Potatoes, boiled, cooked without skin, flesh, without salt", [("piece", "medium potato", 135), ("cup", "cup, diced", 156)], "piece"),
    ("onion", "Onion", ["pyaz", "pyaaz", "kanda", "vengayam", "ullipaya"], "vegetable", "Onions, raw", [("piece", "medium onion", 110)], "piece"),
    ("tomato", "Tomato", ["tamatar", "thakkali"], "vegetable", "Tomatoes, red, ripe, raw, year round average", [("piece", "medium tomato", 123)], "piece"),
    ("spinach", "Spinach (cooked)", ["palak", "keerai", "palakura"], "vegetable", "Spinach, cooked, boiled, drained, without salt", [BOWL, ("cup", "cup", 180)], "bowl"),
    # "palak" alone is the cooked one, on the server and in the app's search alike.
    ("spinach-raw", "Spinach (raw)", ["raw palak"], "vegetable", "Spinach, raw", [("cup", "cup", 30)], "cup"),
    ("carrot", "Carrot", ["gajar", "gajjar"], "vegetable", "Carrots, raw", [("piece", "medium carrot", 61)], "piece"),
    ("cabbage", "Cabbage", ["patta gobhi", "band gobhi", "muttaikose", "kosu"], "vegetable", "Cabbage, raw", [("cup", "cup, chopped", 89)], "cup"),
    ("cauliflower", "Cauliflower (cooked)", ["gobi", "phool gobhi"], "vegetable", "Cauliflower, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("brinjal", "Brinjal (cooked)", ["baingan", "eggplant", "kathirikai", "vankaya", "vangi"], "vegetable", "Eggplant, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("okra", "Okra / bhindi (cooked)", ["bhindi", "ladies finger", "vendakkai", "bendakaya"], "vegetable", "Okra, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("peas", "Green peas (cooked)", ["matar", "pattani", "batani"], "vegetable", "Peas, green, cooked, boiled, drained, without salt", [BOWL, ("cup", "cup", 160)], "bowl"),
    ("beans", "Green beans (cooked)", ["french beans"], "vegetable", "Beans, snap, green, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("bottle-gourd", "Bottle gourd (cooked)", ["lauki", "dudhi", "ghiya", "sorakaya", "suraikkai"], "vegetable", "Gourd, white-flowered (calabash), cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("bitter-gourd", "Bitter gourd (cooked)", ["karela", "pavakkai", "kakarakaya"], "vegetable", "Balsam-pear (bitter gourd), pods, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("cucumber", "Cucumber", ["kheera", "kakdi", "vellarikka"], "vegetable", "Cucumber, with peel, raw", [("piece", "medium cucumber", 200), ("cup", "cup, sliced", 104)], "cup"),
    ("beetroot", "Beetroot", ["chukandar", "beet"], "vegetable", "Beets, raw", [("piece", "beetroot", 82)], "piece"),
    ("sweet-potato", "Sweet potato (boiled)", ["shakarkandi", "sakkaravalli"], "vegetable", "Sweet potato, cooked, boiled, without skin", [("piece", "medium", 150)], "piece"),
    ("capsicum", "Capsicum", ["shimla mirch", "bell pepper", "kudai milagai"], "vegetable", "Peppers, sweet, green, raw", [("piece", "capsicum", 119)], "piece"),
    ("pumpkin", "Pumpkin (cooked)", ["kaddu", "parangikai", "poosanikai"], "vegetable", "Pumpkin, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("mushrooms", "Mushrooms", ["khumb"], "vegetable", "Mushrooms, white, raw", [("cup", "cup, sliced", 70)], "cup"),
    ("drumstick", "Drumstick (moringa pods)", ["murungakkai", "sahjan", "shevga", "munagakaya"], "vegetable", "Drumstick pods, raw", [("piece", "pod", 15)], "piece"),
    ("radish", "Radish", ["mooli", "mullangi"], "vegetable", "Radishes, raw", [("cup", "cup, sliced", 116)], "cup"),
    ("corn", "Sweet corn (cooked)", ["bhutta", "makka", "makai"], "vegetable", "Corn, sweet, yellow, cooked, boiled, drained, without salt", [("piece", "ear of corn", 103), ("cup", "cup, kernels", 145)], "piece"),
    ("broccoli", "Broccoli (cooked)", [], "vegetable", "Broccoli, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("lettuce", "Lettuce", ["salad leaves"], "vegetable", "Lettuce, cos or romaine, raw", [("cup", "cup, shredded", 47)], "cup"),
    ("coriander", "Coriander leaves", ["dhania", "kothamalli", "cilantro"], "vegetable", "Coriander (cilantro) leaves, raw", [("tbsp", "tablespoon, chopped", 1)], "tbsp"),
    # Plain foods carry no dish names ("sarson ka saag", "rajma", "chole"): the dish has salt and
    # oil the plain food doesn't, and an alias would hide them.
    ("mustard-greens", "Mustard greens (cooked)", ["sarson"], "vegetable", "Mustard greens, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    # Grains and breads. Rice and pasta are the unenriched kinds: Indian ones have no added iron,
    # B vitamins or folic acid. Naan is a dish below (made from maida), not the US enriched one.
    ("rice", "Rice (white, cooked)", ["chawal", "bhat", "sadam", "annam", "choru", "plain rice"], "grain", "Rice, white, long-grain, regular, unenriched, cooked without salt", [BOWL, ("cup", "cup", 158), ("plate", "plate", 250)], "bowl"),
    ("brown-rice", "Rice (brown, cooked)", ["brown rice"], "grain", "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", [BOWL], "bowl"),
    ("chapati", "Chapati / roti", ["roti", "phulka", "chapathi", "rotli", "fulka"], "bread", "Bread, chapati or roti, whole wheat, commercially prepared, frozen", [("piece", "roti", 40)], "piece"),
    ("bread", "Bread (white)", ["pav", "sandwich bread"], "bread", "Bread, white, commercially prepared (includes soft bread crumbs)", [("slice", "slice", 25)], "slice"),
    ("bread-brown", "Bread (whole wheat)", ["brown bread", "atta bread"], "bread", "Bread, whole-wheat, commercially prepared", [("slice", "slice", 28)], "slice"),
    ("oats", "Oats (cooked)", ["oatmeal", "porridge"], "grain", "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt", [BOWL, ("cup", "cup", 234)], "bowl"),
    # USDA's millet is proso millet. Ragi (finger millet) has far more calcium, so it has its own food.
    ("millet", "Millet (cooked)", ["bajra", "jowar", "siridhanya"], "grain", "Millet, cooked", [BOWL], "bowl"),
    ("pasta", "Pasta (cooked)", ["macaroni", "spaghetti"], "grain", "Pasta, cooked, unenriched, without added salt", [("cup", "cup", 140)], "cup"),
    ("atta", "Wheat flour (atta)", ["atta", "whole wheat flour"], "grain", "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)", [("cup", "cup", 120), ("tbsp", "tablespoon", 8)], "cup"),
    # Legumes
    ("toor-dal", "Toor dal (cooked, plain)", ["arhar", "tuvar", "pigeon peas", "kandi pappu", "thuvaram paruppu"], "legume", "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("masoor-dal", "Masoor dal (cooked, plain)", ["lentils", "red lentils"], "legume", "Lentils, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("moong-dal", "Moong dal (cooked, plain)", ["mung", "green gram", "pesarapappu", "pasi paruppu"], "legume", "Mung beans, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("urad-dal", "Urad dal (cooked, plain)", ["black gram", "minapappu", "ulundhu"], "legume", "Mungo beans, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("chickpeas", "Chickpeas (boiled)", ["chana", "kabuli chana", "kondakadalai"], "legume", "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("kidney-beans", "Kidney beans (boiled)", [], "legume", "Beans, kidney, all types, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("soybeans", "Soybeans (boiled)", ["soya"], "legume", "Soybeans, mature cooked, boiled, without salt", [BOWL], "bowl"),
    ("tofu", "Tofu", ["soya paneer"], "legume", "Tofu, raw, firm, prepared with calcium sulfate", [("piece", "piece (100 g)", 100)], "piece"),
    # Meat, egg, fish
    ("chicken-breast", "Chicken breast (cooked)", ["chicken", "murgh", "kozhi", "kodi"], "meat", "Chicken, broilers or fryers, breast, meat only, cooked, roasted", [("piece", "piece (100 g)", 100)], "piece"),
    ("chicken-thigh", "Chicken leg/thigh (cooked)", ["chicken leg", "drumstick chicken"], "meat", "Chicken, broilers or fryers, thigh, meat only, cooked, roasted", [("piece", "thigh (70 g)", 70)], "piece"),
    ("mutton", "Mutton (goat, cooked)", ["goat", "gosht", "aattu kari", "mamsam"], "meat", "Game meat, goat, cooked, roasted", [("piece", "piece (30 g)", 30), BOWL], "bowl"),
    ("lamb-mince", "Keema (lamb mince, cooked)", ["keema", "mince"], "meat", "Lamb, ground, cooked, broiled", [BOWL], "bowl"),
    ("beef", "Beef (minced, cooked)", [], "meat", "Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled", [("piece", "patty", 85)], "piece"),
    ("egg-boiled", "Egg (boiled)", ["anda", "muttai", "guddu", "boiled egg"], "egg", "Egg, whole, cooked, hard-boiled", [("piece", "egg", 50)], "piece"),
    ("egg-fried", "Egg (fried)", ["fried egg", "half fry", "bullseye"], "egg", "Egg, whole, cooked, fried", [("piece", "egg", 46)], "piece"),
    ("omelette", "Omelette", ["omelet", "amlet"], "egg", "Egg, whole, cooked, omelet", [("piece", "2-egg omelette", 120)], "piece"),
    ("prawns", "Prawns (cooked)", ["shrimp", "jhinga", "eral", "royyalu", "chemmeen"], "fish", "Crustaceans, shrimp, cooked", [BOWL], "bowl"),
    ("fish-rohu", "Rohu / katla (cooked)", ["rohu", "katla", "carp", "rui"], "fish", "Fish, carp, cooked, dry heat", [("piece", "piece (80 g)", 80)], "piece"),
    ("fish-pomfret", "Pomfret (cooked)", ["pomfret", "vavval", "butterfish"], "fish", "Fish, butterfish, cooked, dry heat", [("piece", "piece (80 g)", 80)], "piece"),
    ("fish-seer", "Seer fish / surmai (cooked)", ["surmai", "vanjaram", "neymeen", "king mackerel"], "fish", "Fish, mackerel, king, cooked, dry heat", [("piece", "piece (80 g)", 80)], "piece"),
    ("fish-mackerel", "Mackerel / bangda (cooked)", ["bangda", "ayala", "ayila", "mackerel"], "fish", "Fish, mackerel, Atlantic, cooked, dry heat", [("piece", "fish (100 g)", 100)], "piece"),
    ("fish-sardine", "Sardine (cooked)", ["mathi", "chaala", "tarli", "sardine"], "fish", "Fish, sardine, Atlantic, canned in oil, drained solids with bone", [("piece", "fish (25 g)", 25)], "piece"),
    ("fish-salmon", "Salmon (cooked)", ["salmon", "rawas"], "fish", "Fish, salmon, Atlantic, farmed, cooked, dry heat", [("piece", "fillet (100 g)", 100)], "piece"),
    ("fish-tilapia", "Tilapia (cooked)", ["jilebi fish", "tilapia"], "fish", "Fish, tilapia, cooked, dry heat", [("piece", "fillet (90 g)", 90)], "piece"),
    ("crab", "Crab (cooked)", ["kekda", "nandu", "peetha"], "fish", "Crustaceans, crab, blue, cooked, moist heat", [("cup", "cup", 118)], "cup"),
    # Dairy and drinks
    ("milk", "Milk (whole)", ["doodh", "paal", "palu", "full cream milk"], "dairy", "Milk, whole, 3.25% milkfat, with added vitamin D", [("glass", "glass", 250), CUP], "glass"),
    ("milk-toned", "Milk (toned, 2%)", ["toned milk", "low fat milk"], "dairy", "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", [("glass", "glass", 250)], "glass"),
    ("milk-buffalo", "Milk (buffalo)", ["bhains ka doodh", "buffalo milk"], "dairy", "Milk, indian buffalo, fluid", [("glass", "glass", 250)], "glass"),
    ("curd", "Curd / dahi", ["dahi", "yogurt", "thayir", "perugu", "mosaru"], "dairy", "Yogurt, plain, whole milk", [BOWL, ("cup", "cup", 245)], "bowl"),
    # Names of the plain US-style drinks don't start with the bare word: the food Lambda also
    # matches a name without its brackets, and "tea", "coffee" and "buttermilk" belong to chai,
    # filter coffee and chaas (their aliases), as in the app's search.
    ("buttermilk-plain", "Cultured buttermilk (US style)", [], "dairy", "Milk, buttermilk, fluid, cultured, lowfat", [("glass", "glass", 245)], "glass"),
    ("cheese", "Cheese (cheddar)", ["cheese slice"], "dairy", "Cheese, cheddar, sharp, sliced", [("slice", "slice", 21)], "slice"),
    ("mozzarella", "Mozzarella", ["pizza cheese"], "dairy", "Cheese, mozzarella, whole milk", [("cup", "cup, shredded", 112)], "cup"),
    ("cream", "Cream (fresh)", ["malai"], "dairy", "Cream, fluid, heavy whipping", [TBSP], "tbsp"),
    ("ice-cream", "Ice cream (vanilla)", ["kulfi"], "sweet", "Ice creams, vanilla", [("scoop", "scoop", 66)], "scoop"),
    ("tea-black", "Black tea (no milk)", ["black tea", "kattan chai"], "drink", "Beverages, tea, black, brewed, prepared with tap water", [("cup", "cup", 150)], "cup"),
    ("coffee-black", "Black coffee (no milk)", ["black coffee"], "drink", "Beverages, coffee, brewed, prepared with tap water", [("cup", "cup", 150)], "cup"),
    ("espresso", "Espresso", ["espresso shot"], "drink", "Beverages, coffee, brewed, espresso, restaurant-prepared", [("shot", "shot", 30)], "shot"),
    # Fats and sweeteners. "Cooking oil" is soybean oil, one of the most used refined oils at home
    # in India, and USDA gives its trans fat. Its saturated fat sits between sunflower and palmolein,
    # but it has about 7 g omega-3 (plant ALA) per 100 g, where those two have almost none, so food
    # cooked in it shows real plant omega-3 from the oil. Sunflower and palm have no USDA trans fat
    # value: as the generic oil they would leave fried dishes with no trans fat figure.
    ("ghee", "Ghee", ["clarified butter", "neyyi", "nei", "tuppa"], "fat", "Butter oil, anhydrous", [TSP, TBSP], "tsp"),
    ("butter", "Butter", ["makhan", "venna"], "fat", "Butter, salted", [TSP, TBSP], "tsp"),
    ("oil", "Cooking oil (refined)", ["refined oil", "soybean oil", "soyabean oil", "tel", "ennai"], "fat", "Oil, soybean, salad or cooking", [TSP, TBSP], "tsp"),
    ("sunflower-oil", "Sunflower oil", ["surajmukhi tel"], "fat", "Oil, sunflower, linoleic, (approx. 65%)", [TSP, TBSP], "tsp"),
    ("groundnut-oil", "Groundnut oil", ["peanut oil", "kadalai ennai", "moongphali tel", "verusenaga nune", "shengdana tel"], "fat", "Oil, peanut, salad or cooking", [TSP, TBSP], "tsp"),
    ("sesame-oil", "Sesame oil (gingelly)", ["gingelly oil", "til oil", "nallennai", "nuvvula nune"], "fat", "Oil, sesame, salad or cooking", [TSP, TBSP], "tsp"),
    ("coconut-oil", "Coconut oil", ["thengai ennai", "velichenna"], "fat", "Oil, coconut", [TSP, TBSP], "tsp"),
    ("mustard-oil", "Mustard oil", ["sarson ka tel"], "fat", "Oil, mustard", [TSP, TBSP], "tsp"),
    ("canola-oil", "Canola oil", ["rapeseed oil"], "fat", "Oil, canola", [TSP, TBSP], "tsp"),
    ("sugar", "Sugar", ["cheeni", "sakkarai", "chakkera"], "sweet", "Sugars, granulated", [("tsp", "teaspoon", 4)], "tsp"),
    ("jaggery", "Jaggery (gur)", ["gur", "gud", "vellam", "bellam", "bella"], "sweet", "Sugars, brown", [("piece", "small piece", 10), ("tsp", "teaspoon, grated", 5)], "piece"),
    # Honey is heavier than water (USDA: 7 g a teaspoon, 21 g a tablespoon).
    ("honey", "Honey", ["shahad", "madhu", "then"], "sweet", "Honey", [("tsp", "teaspoon", 7), ("tbsp", "tablespoon", 21)], "tsp"),

    # Recipe ingredients, as bought (ingredientOnly below). They come after the foods people log,
    # so the food Lambda's exact name match ("toor dal", "chicken breast") finds the cooked food
    # first, and their aliases all say "raw" for the same reason.
    ("rice-raw", "Rice (raw)", ["raw rice", "uncooked rice"], "grain", "Rice, white, long-grain, regular, raw, unenriched", [("cup", "cup", 185)], "cup"),
    ("rice-flour", "Rice flour", ["chawal ka atta", "arisi maavu", "biyyam pindi"], "grain", "Rice flour, white, unenriched", [("cup", "cup", 158), ("tbsp", "tablespoon", 10)], "cup"),
    ("maida", "Maida (white flour)", ["all-purpose flour", "refined flour", "plain flour"], "grain", "Wheat flour, white, all-purpose, unenriched", [("cup", "cup", 125), ("tbsp", "tablespoon", 8)], "cup"),
    ("semolina", "Semolina (sooji / rava)", ["sooji", "suji", "bombay rava"], "grain", "Semolina, unenriched", [("cup", "cup", 167), ("tbsp", "tablespoon", 10)], "cup"),
    ("besan", "Besan (gram flour)", ["gram flour", "chickpea flour", "kadalai maavu", "senaga pindi"], "legume", "Chickpea flour (besan)", [("cup", "cup", 92), ("tbsp", "tablespoon", 6)], "cup"),
    ("toor-dal-raw", "Toor dal (raw)", ["raw toor dal", "raw arhar dal"], "legume", "Pigeon peas (red gram), mature seeds, raw", [("cup", "cup", 200), ("tbsp", "tablespoon", 12)], "cup"),
    ("masoor-dal-raw", "Masoor dal (raw)", ["raw masoor dal", "raw lentils"], "legume", "Lentils, raw", [("cup", "cup", 190), ("tbsp", "tablespoon", 12)], "cup"),
    ("moong-dal-raw", "Moong dal (raw)", ["raw moong dal", "raw green gram"], "legume", "Mung beans, mature seeds, raw", [("cup", "cup", 200), ("tbsp", "tablespoon", 12)], "cup"),
    ("urad-dal-raw", "Urad dal (raw)", ["raw urad dal", "raw black gram"], "legume", "Mungo beans, mature seeds, raw", [("cup", "cup", 200), ("tbsp", "tablespoon", 12)], "cup"),
    # Kabuli chickpeas; split desi chana dal is close enough for a recipe.
    ("chana-raw", "Chana / chana dal (raw)", ["raw chana", "raw chickpeas", "raw chana dal", "raw bengal gram"], "legume", "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw", [("cup", "cup", 200), ("tbsp", "tablespoon", 12)], "cup"),
    ("rajma-raw", "Rajma (raw)", ["raw rajma", "raw kidney beans"], "legume", "Beans, kidney, all types, mature seeds, raw", [("cup", "cup", 185)], "cup"),
    ("peanuts-raw", "Peanuts (raw)", ["raw peanuts", "raw groundnut"], "nut", "Peanuts, all types, raw", [("tbsp", "tablespoon", 9), HANDFUL], "tbsp"),
    ("sesame-seeds", "Sesame seeds (til)", ["til", "ellu", "nuvvulu"], "nut", "Seeds, sesame seeds, whole, dried", [("tbsp", "tablespoon", 9), ("tsp", "teaspoon", 3)], "tbsp"),
    ("potato-raw", "Potato (raw)", ["raw potato"], "vegetable", "Potatoes, flesh and skin, raw", [("piece", "medium potato", 150)], "piece"),
    ("cauliflower-raw", "Cauliflower (raw)", ["raw cauliflower"], "vegetable", "Cauliflower, raw", [("cup", "cup, chopped", 107)], "cup"),
    ("okra-raw", "Okra / bhindi (raw)", ["raw bhindi", "raw okra"], "vegetable", "Okra, raw", [("cup", "cup, chopped", 100)], "cup"),
    ("brinjal-raw", "Brinjal (raw)", ["raw brinjal", "raw baingan"], "vegetable", "Eggplant, raw", [("cup", "cup, cubes", 82), ("piece", "medium brinjal", 150)], "cup"),
    ("beans-raw", "Green beans (raw)", ["raw beans", "raw french beans"], "vegetable", "Beans, snap, green, raw", [("cup", "cup, chopped", 100)], "cup"),
    ("peas-raw", "Green peas (raw)", ["raw peas", "raw matar", "frozen peas"], "vegetable", "Peas, green, raw", [("cup", "cup", 145)], "cup"),
    ("bottle-gourd-raw", "Bottle gourd (raw)", ["raw lauki", "raw bottle gourd"], "vegetable", "Gourd, white-flowered (calabash), raw", [("cup", "cup, pieces", 116)], "cup"),
    ("bitter-gourd-raw", "Bitter gourd (raw)", ["raw karela", "raw bitter gourd"], "vegetable", "Balsam-pear (bitter gourd), pods, raw", [("cup", "cup, pieces", 93), ("piece", "medium karela", 100)], "cup"),
    ("pumpkin-raw", "Pumpkin (raw)", ["raw pumpkin", "raw kaddu"], "vegetable", "Pumpkin, raw", [("cup", "cup, cubes", 116)], "cup"),
    ("sweet-potato-raw", "Sweet potato (raw)", ["raw sweet potato"], "vegetable", "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)", [("piece", "medium", 130)], "piece"),
    ("mustard-greens-raw", "Mustard greens (raw)", ["raw sarson", "raw mustard greens"], "vegetable", "Mustard greens, raw", [("cup", "cup, chopped", 56)], "cup"),
    ("broccoli-raw", "Broccoli (raw)", ["raw broccoli"], "vegetable", "Broccoli, raw", [("cup", "cup, chopped", 91)], "cup"),
    ("corn-raw", "Sweet corn (raw)", ["raw corn", "raw sweet corn"], "vegetable", "Corn, sweet, yellow, raw", [("cup", "cup, kernels", 154)], "cup"),
    ("garlic", "Garlic", ["lehsun", "lasun", "poondu", "vellulli"], "vegetable", "Garlic, raw", [("clove", "clove", 3)], "clove"),
    ("ginger", "Ginger", ["adrak", "inji", "allam"], "vegetable", "Ginger root, raw", [("piece", "1-inch piece", 6), ("tsp", "teaspoon, grated", 2)], "piece"),
    ("green-chilli", "Green chilli", ["hari mirch", "pachai milagai", "pachi mirapakaya"], "vegetable", "Peppers, hot chili, green, raw", [("piece", "chilli", 4)], "piece"),
    ("mint", "Mint leaves", ["pudina", "pudhina"], "vegetable", "Spearmint, fresh", [("tbsp", "tablespoon, chopped", 3), ("handful", "handful", 10)], "tbsp"),
    ("tamarind", "Tamarind", ["imli", "puli", "chintapandu", "hunase"], "fruit", "Tamarinds, raw", [("piece", "lemon-size ball", 15)], "piece"),
    ("chicken-breast-raw", "Chicken breast (raw)", ["raw chicken breast", "raw boneless chicken"], "meat", "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw", [PIECE_100], "piece"),
    ("chicken-thigh-raw", "Chicken leg/thigh (raw)", ["raw chicken", "raw chicken leg"], "meat", "Chicken, broilers or fryers, dark meat, thigh, meat only, raw", [PIECE_100], "piece"),
    ("mutton-raw", "Mutton (goat, raw)", ["raw mutton", "raw goat meat"], "meat", "Game meat, goat, raw", [PIECE_100], "piece"),
    ("lamb-mince-raw", "Keema (lamb mince, raw)", ["raw keema", "raw mince"], "meat", "Lamb, ground, raw", [PIECE_100], "piece"),
    ("egg-raw", "Egg (raw)", ["raw egg"], "egg", "Egg, whole, raw, fresh", [("piece", "egg", 50)], "piece"),
    ("fish-rohu-raw", "Rohu / katla (raw)", ["raw rohu", "raw fish"], "fish", "Fish, carp, raw", [PIECE_100], "piece"),
    ("fish-seer-raw", "Seer fish / surmai (raw)", ["raw surmai", "raw seer fish"], "fish", "Fish, mackerel, king, raw", [PIECE_100], "piece"),
    ("prawns-raw", "Prawns (raw)", ["raw prawns", "raw shrimp"], "fish", "Crustaceans, shrimp, raw", [PIECE_100], "piece"),
    ("salt", "Salt", ["namak", "uppu", "table salt"], "spice", "Salt, table", [("tsp", "teaspoon", 6)], "tsp"),
    ("turmeric", "Turmeric powder", ["haldi", "manjal", "pasupu"], "spice", "Spices, turmeric, ground", spice_tsp(3), "tsp"),
    ("chilli-powder", "Red chilli powder", ["lal mirch", "mirchi powder", "milagai thool", "kaaram"], "spice", "Spices, pepper, red or cayenne", spice_tsp(1.8), "tsp"),
    ("cumin", "Cumin seeds (jeera)", ["jeera", "jeerakam", "zeera"], "spice", "Spices, cumin seed", spice_tsp(2.1), "tsp"),
    ("coriander-powder", "Coriander powder (dhania)", ["dhania powder", "coriander seeds", "malli podi"], "spice", "Spices, coriander seed", spice_tsp(2), "tsp"),
    ("mustard-seeds", "Mustard seeds (rai)", ["rai", "kadugu", "avalu"], "spice", "Spices, mustard seed, ground", spice_tsp(3), "tsp"),
    ("black-pepper", "Black pepper", ["kali mirch", "milagu", "miriyalu"], "spice", "Spices, pepper, black", spice_tsp(2.3), "tsp"),
    ("fenugreek-seeds", "Fenugreek seeds (methi)", ["methi seeds", "vendhayam", "menthulu"], "spice", "Spices, fenugreek seed", spice_tsp(3.7), "tsp"),
    ("cardamom", "Cardamom (elaichi)", ["elaichi", "elakkai", "yelakulu"], "spice", "Spices, cardamom", spice_tsp(2), "tsp"),
    ("cinnamon", "Cinnamon (dalchini)", ["dalchini", "pattai"], "spice", "Spices, cinnamon, ground", spice_tsp(2.6), "tsp"),
    ("cloves", "Cloves (laung)", ["laung", "lavang", "krambu"], "spice", "Spices, cloves, ground", spice_tsp(2.1), "tsp"),
    ("fennel", "Fennel seeds (saunf)", ["saunf", "sombu", "sopu"], "spice", "Spices, fennel seed", spice_tsp(2), "tsp"),
    ("palm-oil", "Palm oil (palmolein)", ["palmolein"], "fat", "Oil, palm", [TSP, TBSP], "tsp"),
    ("vanaspati", "Vanaspati (dalda)", ["dalda", "vanaspati ghee"], "fat", "Shortening, vegetable, household, composite", [TSP, TBSP], "tsp"),
    ("coconut-milk", "Coconut milk", ["thengai paal", "nariyal doodh", "kobbari palu"], "fat", "Nuts, coconut milk, raw (liquid expressed from grated meat and water)", [("cup", "cup", 240), TBSP], "cup"),
]

# Ingredients for recipes, not offered in the app's food search (FoodItem.ingredientOnly).
INGREDIENT_ONLY = {
    "atta", "coriander", "rice-raw", "rice-flour", "maida", "semolina", "besan", "toor-dal-raw", "masoor-dal-raw",
    "moong-dal-raw", "urad-dal-raw", "chana-raw", "rajma-raw", "peanuts-raw", "sesame-seeds", "potato-raw",
    "cauliflower-raw", "okra-raw", "brinjal-raw", "beans-raw", "peas-raw", "bottle-gourd-raw", "bitter-gourd-raw",
    "pumpkin-raw", "sweet-potato-raw", "mustard-greens-raw", "broccoli-raw", "corn-raw", "garlic", "ginger",
    "green-chilli", "mint", "tamarind", "chicken-breast-raw", "chicken-thigh-raw", "mutton-raw", "lamb-mince-raw",
    "egg-raw", "fish-rohu-raw", "fish-seer-raw", "prawns-raw", "salt", "turmeric", "chilli-powder", "cumin",
    "coriander-powder", "mustard-seeds", "black-pepper", "fenugreek-seeds", "cardamom", "cinnamon", "cloves",
    "fennel", "palm-oil", "vanaspati", "coconut-milk", "ragi-flour",
}

# Shown after the USDA number when a USDA food stands in for an Indian one.
SOURCE_NOTES = {
    "oil": "soybean oil, standing in for refined oil",
    "jaggery": "brown sugar, standing in for jaggery",
    "vanaspati": "household shortening, standing in for vanaspati; trans fat set to India's 2% limit",
    "chilli-powder": "cayenne pepper",
    "bread": "US bread; its added iron, B vitamins and folic acid are left out",
}
# Values that replace USDA's. Vanaspati sold in India must have at most 2 g trans fat per 100 g
# since 2022 (FSSAI); the US shortening has 13 g. Loose or old stock can still have far more.
OVERRIDES = {"vanaspati": {"transFat": 2.0}}
# US white bread has iron, thiamin, riboflavin, niacin and folic acid added by law. Most Indian
# bread and pav is plain maida, though some brands add them, so these are unknown rather than
# shown at US levels (two slices would look like a fifth of a day's folate).
UNFORTIFIED = {"bread": ("iron", "thiamin", "riboflavin", "niacin", "folate")}

# Missing means unknown, except where a nutrient can't be in that kind of food. Plants have no
# cholesterol, vitamin B12 or vitamin D (mushrooms do have some D, and USDA reports it) and no trans
# fat; plant oils are kept out of the trans fat rule, since refining makes a little.
PLANT_CATEGORIES = {"fruit", "vegetable", "grain", "legume", "nut", "spice"}
PLANT_IDS = {"sugar", "jaggery", "tea-black", "coffee-black", "espresso"}
PLANT_FATS = {"oil", "sunflower-oil", "groundnut-oil", "sesame-oil", "coconut-oil", "mustard-oil", "canola-oil",
              "palm-oil", "vanaspati", "coconut-milk"}
# Fibre comes only from plants.
ANIMAL_CATEGORIES = {"meat", "fish", "egg", "dairy"}
# The only foods here with caffeine or alcohol; everything else gets 0.
TEA_COFFEE = {"tea-black", "coffee-black", "espresso"}

# Added sugar: sweeteners are all added sugar; packaged foods whose added sugar isn't known leave
# it out; everything else here is a whole or plain food with none. Chapati counts as 0 because
# home roti is flour, water and salt (USDA's is a commercial one standing in).
SWEETENERS = {"sugar", "jaggery", "honey"}
ADDED_SUGAR_UNKNOWN = {"ice-cream", "bread", "bread-brown", "peanut-butter"}

# Glycemic index of every food with 1 g or more of available carbs (carbs - fibre) per 100 g.
# Typical published values (International Tables of Glycemic Index, Atkinson et al. 2008 and 2021,
# and Indian studies), rounded. Real GI varies a lot with variety, ripeness and cooking. Raw
# ingredients take the GI of the food as usually cooked. Values marked "est." have no good published
# figure and are estimates from similar foods: they are eaten in small amounts or have few carbs, so
# they barely move a day's glycemic load.
GI = {
    # Fruit
    "banana": 51, "apple": 36, "mango": 51, "orange": 43, "papaya": 60, "grapes": 59, "watermelon": 76,
    "pineapple": 59, "pear": 38, "muskmelon": 65, "strawberries": 40, "custard-apple": 54, "dates": 42,
    "plum": 39, "kiwi": 53, "chikoo": 55, "litchi": 50, "jackfruit": 60,
    "guava": 30, "pomegranate": 35, "fig": 45, "lemon": 20, "coconut": 45, "tamarind": 25,  # est.
    # Nuts and seeds
    "cashews": 25, "peanuts": 14, "peanuts-raw": 14, "peanut-butter": 14,
    "almonds": 15, "walnuts": 15, "sesame-seeds": 35,  # est.
    # Starchy vegetables
    "potato": 78, "potato-raw": 78, "sweet-potato": 63, "sweet-potato-raw": 63, "peas": 51, "peas-raw": 51,
    "corn": 52, "corn-raw": 52, "pumpkin": 64, "pumpkin-raw": 64, "beetroot": 64, "carrot": 35,
    # Other vegetables, herbs and spices: rarely tested because they have few carbs (est.)
    "onion": 15, "tomato": 15, "spinach": 15, "spinach-raw": 15, "cabbage": 15, "cauliflower": 15,
    "cauliflower-raw": 15, "brinjal": 15, "brinjal-raw": 15, "okra": 20, "okra-raw": 20, "beans": 15,
    "beans-raw": 15, "bottle-gourd": 15, "bottle-gourd-raw": 15, "bitter-gourd": 15, "bitter-gourd-raw": 15,
    "cucumber": 15, "capsicum": 15, "mushrooms": 15, "drumstick": 20, "radish": 15, "broccoli": 15,
    "broccoli-raw": 15, "lettuce": 15, "coriander": 15, "mustard-greens": 15, "mustard-greens-raw": 15,
    "garlic": 30, "ginger": 15, "green-chilli": 15, "mint": 15, "turmeric": 15, "chilli-powder": 15,
    "cumin": 15, "coriander-powder": 15, "mustard-seeds": 15, "black-pepper": 15, "fenugreek-seeds": 15,
    "cardamom": 15, "cinnamon": 15, "cloves": 15, "fennel": 15,
    # Grains, breads and flours (flours take the GI of what is usually made from them)
    "rice": 73, "rice-raw": 73, "rice-flour": 73, "brown-rice": 68, "chapati": 55, "atta": 55,
    "maida": 71, "bread": 75, "bread-brown": 74, "oats": 55, "millet": 71, "pasta": 49, "semolina": 66,
    "ragi-flour": 65,  # est.: published values for ragi dishes vary widely
    # Legumes
    "toor-dal": 25, "toor-dal-raw": 25, "masoor-dal": 26, "masoor-dal-raw": 26, "moong-dal": 31,
    "moong-dal-raw": 31, "urad-dal": 43, "urad-dal-raw": 43, "chickpeas": 28, "chana-raw": 28,
    "kidney-beans": 24, "rajma-raw": 24, "soybeans": 16, "besan": 35,
    # Dairy: the carbs are milk sugar
    "milk": 39, "milk-toned": 32, "milk-buffalo": 39, "curd": 36, "buttermilk-plain": 35, "ice-cream": 60,
    "cheese": 30, "mozzarella": 30, "cream": 30, "paneer": 30,  # est. for cheese, cream, paneer
    # Sweeteners: jaggery is mostly sucrose, counted like sugar
    "sugar": 65, "jaggery": 65, "honey": 61,
    # Coconut milk est.; eggs and coffee have too little carbohydrate to test (coffee's isn't sugar
    # or starch), so they count as 0
    "coconut-milk": 40, "egg-boiled": 0, "espresso": 0,
}

# Not in USDA SR Legacy; rough values from typical packaged paneer labels (per 100 g). Saturated
# fat is about 60% of milk fat, cholesterol about 3 mg per g of milk fat; most milk sugar and
# sodium leave with the whey (no salt added); phosphorus about 0.7 of calcium as in fresh cheeses.
PANEER = {"kcal": 290, "protein": 18, "carbs": 4, "sugars": 3, "fat": 22, "satFat": 13, "cholesterol": 65,
          "calcium": 400, "phosphorus": 280, "sodium": 30}

# Ragi (finger millet) flour isn't in SR Legacy either. Rough values per 100 g from Indian food
# tables: energy, protein, fat, carbs and fibre from IFCT 2017; minerals the lower of the IFCT 2017
# and older NIN figures, rounded, so they don't overstate. Sodium is a few mg as in other grains.
RAGI = {"kcal": 321, "protein": 7.2, "carbs": 66.8, "fiber": 11.2, "fat": 1.9, "calcium": 344, "iron": 3.9,
        "magnesium": 135, "phosphorus": 210, "potassium": 400, "zinc": 2.3, "sodium": 10}

# Cooked when USDA says so; breads are baked and canned fish is cooked in the can, though the
# description doesn't say it.
COOKED = re.compile(r"\b(cooked|boiled|roasted|broiled|fried|brewed|canned)\b", re.I)

per100 = {"water": {}}
foods = []
gi_missing = []


def fill(fid, category, n):
    """Adds the zeros that follow from the kind of food, added sugar and glycemic load."""
    n = dict(n)
    plant = category in PLANT_CATEGORIES or fid in PLANT_IDS
    zero = []
    if plant or fid in PLANT_FATS:
        zero += ["cholesterol", "vitB12", "vitD"]
    if plant:
        zero.append("transFat")
    if n.get("fat") == 0:
        zero += ["satFat", "transFat"]  # no fat at all: sugar, honey, salt
    if n.get("carbs") == 0:
        zero.append("sugars")  # meat, fish, oils
    if category in ANIMAL_CATEGORIES:
        zero.append("fiber")
    if fid not in TEA_COFFEE:
        zero += ["caffeine", "alcohol"]
    for key in zero:
        n.setdefault(key, 0.0)
    if fid in SWEETENERS:
        n["addedSugar"] = n["sugars"]
    elif fid not in ADDED_SUGAR_UNKNOWN:
        n["addedSugar"] = 0.0
    available = max(0.0, n["carbs"] - n.get("fiber", 0.0))
    if available < 1:
        n["gl"] = 0.0
    elif fid in GI:
        n["gl"] = GI[fid] * available / 100
    else:
        gi_missing.append(f"{fid} ({available:.1f} g available carbs)")
    return n


def rounded(values):
    return {k: round(values[k], DECIMALS[k]) if DECIMALS[k] else int(round(values[k])) for k in DECIMALS if k in values}


for fid, name, aliases, category, desc, units, default in RAW:
    hit = u(desc)
    n = dict(hit["n"])
    # Fish: EPA and DHA are most of the omega-3 and fish carry little ALA, so when USDA gives the
    # first two but no ALA, their sum stands as a slight underestimate rather than "unknown".
    nums = hit["nums"]
    if category == "fish" and "omega3" not in n and "629" in nums and "621" in nums:
        n["omega3"] = sum(nums.get(k, 0) for k in EPA_DHA_DPA)
    n.update(OVERRIDES.get(fid, {}))
    for key in UNFORTIFIED.get(fid, ()):
        n.pop(key, None)
    n = fill(fid, category, n)
    per100[fid] = n
    note = SOURCE_NOTES.get(fid)
    foods.append({
        "id": fid, "name": name, "aliases": aliases, "category": category, "per100g": rounded(n),
        "units": units, "defaultUnit": default,
        "source": f"USDA FoodData Central #{hit['fdcId']}" + (f" ({note})" if note else ""),
        "ingredientOnly": fid in INGREDIENT_ONLY,
        "cooked": bool(COOKED.search(desc)) or category == "bread",
    })

per100["paneer"] = fill("paneer", "dairy", PANEER)
foods.append({"id": "paneer", "name": "Paneer", "aliases": ["cottage cheese", "chhena"], "category": "dairy",
              "per100g": rounded(per100["paneer"]), "units": [("piece", "cube (20 g)", 20), ("bowl", "bowl (100 g)", 100)],
              "defaultUnit": "bowl", "source": "Estimate from typical paneer labels"})
per100["ragi-flour"] = fill("ragi-flour", "grain", RAGI)
foods.append({"id": "ragi-flour", "name": "Ragi flour (finger millet)",
              "aliases": ["ragi", "ragi atta", "nachni", "mandua", "finger millet", "kezhvaragu"], "category": "grain",
              "per100g": rounded(per100["ragi-flour"]), "units": [("cup", "cup", 120), ("tbsp", "tablespoon", 8)],
              "defaultUnit": "cup", "source": "Rough estimate from Indian food tables (IFCT 2017, NIN)",
              "ingredientOnly": True})

# Dishes: grams of each ingredient (catalog ids above, or "water") for one batch. Rough home-style
# recipes; per-100 g values follow from the batch's total weight. Negative water is what boils off.
#
# Salt is a typical home amount (an estimate): about 1% of the batch for dals, curries, sabzis,
# rice dishes and snacks, less for batters and doughs, none in tea, coffee or sweet lassi. Most of
# the sodium in an Indian meal comes from this added salt.
DISHES = [
    ("dal", "Dal (toor, home-style)", ["dal tadka", "dal fry", "paruppu", "pappu", "varan"], {"toor-dal": 100, "tomato": 20, "onion": 15, "oil": 5, "water": 50, "salt": 1.9}, [BOWL], "bowl"),
    ("sambar", "Sambar", ["sambhar", "kuzhambu"], {"toor-dal": 50, "drumstick": 20, "pumpkin": 30, "tomato": 20, "onion": 20, "tamarind": 4, "oil": 5, "water": 100, "salt": 2.5}, [BOWL], "bowl"),
    ("rasam", "Rasam", ["saaru", "charu"], {"toor-dal": 15, "tomato": 40, "tamarind": 5, "oil": 3, "water": 150, "salt": 2.1}, [BOWL], "bowl"),
    ("idli", "Idli", ["idly", "iddli"], {"rice": 65, "urad-dal": 35, "salt": 0.6}, [("piece", "idli", 40)], "piece"),
    ("dosa", "Dosa (plain)", ["dosai", "dose", "plain dosa"], {"rice": 60, "urad-dal": 30, "oil": 5, "salt": 0.6}, [("piece", "dosa", 90)], "piece"),
    ("masala-dosa", "Masala dosa", ["masala dosai"], {"rice": 60, "urad-dal": 30, "oil": 8, "potato": 70, "onion": 10, "salt": 1.3}, [("piece", "masala dosa", 175)], "piece"),
    ("uttapam", "Uttapam", ["uthappam", "oothappam"], {"rice": 60, "urad-dal": 30, "oil": 6, "onion": 15, "tomato": 10, "salt": 0.8}, [("piece", "uttapam", 120)], "piece"),
    ("medu-vada", "Medu vada", ["vada", "vadai", "garelu", "uddina vada"], {"urad-dal": 60, "oil": 12, "onion": 5, "salt": 0.8}, [("piece", "vada", 45)], "piece"),
    ("upma", "Upma", ["uppittu", "rava upma"], {"semolina": 30, "water": 80, "oil": 5, "onion": 10, "peas": 10, "salt": 1.3}, [BOWL], "bowl"),
    ("poha", "Poha", ["aval", "avalakki", "atukulu"], {"rice-raw": 40, "water": 40, "oil": 5, "onion": 15, "peanuts": 5, "potato": 15, "salt": 1.2}, [BOWL, ("plate", "plate", 200)], "plate"),
    ("khichdi", "Khichdi", ["kichdi", "pongal"], {"rice": 60, "moong-dal": 40, "ghee": 3, "water": 30, "salt": 1.3}, [BOWL], "bowl"),
    # Stiff like ugali: about 70% water once cooked.
    ("ragi-mudde", "Ragi mudde (ragi ball)", ["ragi ball", "ragi sangati", "ragi kali", "mudde"], {"ragi-flour": 100, "water": 220, "salt": 0.5}, [("piece", "ragi ball", 150), BOWL], "piece"),
    ("curd-rice", "Curd rice", ["thayir sadam", "daddojanam", "mosaranna"], {"rice": 60, "curd": 40, "oil": 1, "salt": 1}, [BOWL], "bowl"),
    ("lemon-rice", "Lemon rice", ["chitranna", "pulihora", "tamarind rice"], {"rice": 85, "oil": 5, "peanuts": 5, "lemon": 5, "salt": 1}, [BOWL], "bowl"),
    ("chicken-curry", "Chicken curry", ["murgh curry", "kozhi kuzhambu", "chicken masala"], {"chicken-thigh": 50, "onion": 20, "tomato": 20, "oil": 6, "curd": 5, "water": 30, "salt": 1.3}, [BOWL], "bowl"),
    ("butter-chicken", "Butter chicken", ["murgh makhani", "chicken makhani"], {"chicken-thigh": 45, "curd": 5, "tomato": 30, "butter": 6, "cream": 8, "cashews": 3, "onion": 5, "ginger": 1, "garlic": 1, "sugar": 1, "water": 10, "salt": 1.2}, [BOWL], "bowl"),
    ("fish-curry", "Fish curry", ["meen kuzhambu", "machher jhol", "chepala pulusu"], {"fish-seer": 50, "coconut": 10, "tomato": 15, "onion": 10, "oil": 5, "water": 40, "salt": 1.3}, [BOWL], "bowl"),
    ("egg-curry", "Egg curry", ["anda curry", "muttai kuzhambu"], {"egg-boiled": 50, "onion": 20, "tomato": 20, "oil": 6, "water": 30, "salt": 1.3}, [BOWL], "bowl"),
    ("mutton-curry", "Mutton curry", ["gosht curry", "rogan josh", "mutton kuzhambu"], {"mutton": 50, "onion": 20, "tomato": 15, "oil": 8, "curd": 5, "water": 30, "salt": 1.3}, [BOWL], "bowl"),
    ("paneer-curry", "Paneer butter masala", ["paneer makhani", "shahi paneer", "paneer curry"], {"paneer": 35, "tomato": 35, "butter": 5, "cream": 8, "onion": 10, "cashews": 4, "water": 20, "salt": 1.1}, [BOWL], "bowl"),
    ("palak-paneer", "Palak paneer", ["saag paneer"], {"spinach": 60, "paneer": 25, "oil": 4, "onion": 10, "cream": 3, "salt": 1}, [BOWL], "bowl"),
    # Atta stands in for the maize flour (makki ka atta) that thickens it.
    ("sarson-ka-saag", "Sarson ka saag", ["sarson saag", "mustard greens curry"], {"mustard-greens": 70, "spinach": 20, "atta": 3, "ghee": 5, "onion": 8, "garlic": 2, "ginger": 1, "green-chilli": 1, "salt": 1.1}, [BOWL], "bowl"),
    # Not "rajma chawal": that plate is mostly rice, which this bowl doesn't count.
    ("rajma", "Rajma curry", ["rajma masala"], {"kidney-beans": 80, "onion": 15, "tomato": 20, "oil": 5, "water": 40, "salt": 1.6}, [BOWL], "bowl"),
    ("chole", "Chole / chana masala", ["chana masala", "chole masala", "chana curry"], {"chickpeas": 80, "onion": 15, "tomato": 20, "oil": 6, "water": 40, "salt": 1.6}, [BOWL], "bowl"),
    ("sundal", "Chana sundal", ["sundal", "chickpea sundal", "kondakadalai sundal"], {"chickpeas": 100, "coconut": 10, "oil": 3, "mustard-seeds": 0.5, "green-chilli": 2, "salt": 1.1}, [BOWL], "bowl"),
    ("aloo-sabzi", "Aloo sabzi", ["potato curry", "aloo bhaji", "urulai roast", "batata bhaji"], {"potato": 85, "oil": 6, "onion": 10, "tomato": 10, "salt": 1.1}, [BOWL], "bowl"),
    ("mixed-veg", "Mixed vegetable sabzi", ["veg curry", "sabzi", "poriyal", "kurma", "avial"], {"carrot": 20, "beans": 20, "peas": 20, "cauliflower": 20, "potato": 15, "oil": 5, "onion": 10, "tomato": 10, "salt": 1.2}, [BOWL], "bowl"),
    ("bhindi-sabzi", "Bhindi sabzi", ["bhindi fry", "vendakkai poriyal"], {"okra": 85, "onion": 10, "oil": 6, "salt": 1}, [BOWL], "bowl"),
    ("chicken-biryani", "Chicken biryani", ["biryani", "biriyani", "dum biryani"], {"rice": 55, "chicken-thigh": 25, "onion": 8, "curd": 5, "ghee": 5, "tomato": 5, "salt": 1}, [("plate", "plate", 300), BOWL], "plate"),
    ("veg-biryani", "Veg biryani / pulao", ["pulao", "pulav", "veg pulao"], {"rice": 70, "peas": 10, "carrot": 8, "ghee": 4, "onion": 8, "salt": 1}, [("plate", "plate", 250), BOWL], "plate"),
    ("paratha", "Paratha (plain)", ["parotta", "parantha"], {"atta": 40, "ghee": 7, "water": 13, "salt": 0.4}, [("piece", "paratha", 80)], "piece"),
    ("aloo-paratha", "Aloo paratha", ["alu paratha"], {"atta": 35, "potato": 35, "ghee": 7, "water": 10, "onion": 3, "salt": 0.6}, [("piece", "aloo paratha", 120)], "piece"),
    ("puri", "Puri", ["poori"], {"atta": 25, "oil": 8, "water": 8, "salt": 0.3}, [("piece", "puri", 25)], "piece"),
    # Restaurant naan: maida, curd, a little sugar; some water bakes off. (USDA's naan is made from
    # enriched US flour, with several times the thiamin and iron of Indian maida.)
    ("naan", "Naan", ["nan"], {"maida": 100, "curd": 25, "oil": 5, "sugar": 2, "water": 17, "salt": 1.5}, [("piece", "naan", 90)], "piece"),
    ("samosa", "Samosa", ["samsa"], {"maida": 20, "oil": 15, "potato": 35, "peas": 5, "onion": 5, "salt": 0.7}, [("piece", "samosa", 70)], "piece"),
    # Chai is boiled strong: the leaves for about a mug of brewed tea go into one cup and some
    # water boils off, which gives about 30 mg caffeine a cup (ICMR-NIN: 30-65 mg per 150 ml).
    ("chai", "Tea with milk and sugar", ["chai", "masala chai", "tea"], {"tea-black": 150, "milk": 60, "sugar": 8, "water": -68}, [("cup", "cup", 150)], "cup"),
    # About a quarter of the cup is decoction, counted as espresso-strength coffee.
    ("filter-coffee", "Coffee with milk and sugar", ["filter coffee", "kaapi", "coffee"], {"espresso": 25, "milk": 115, "sugar": 8}, [("cup", "cup", 150)], "cup"),
    ("lassi", "Sweet lassi", ["lassi"], {"curd": 150, "water": 50, "sugar": 15}, [("glass", "glass", 250)], "glass"),
    ("chaas", "Buttermilk (chaas)", ["chaas", "majjige", "moru", "mattha", "chhachh"], {"curd": 60, "water": 140, "salt": 1}, [("glass", "glass", 200)], "glass"),
]
DEEP_FRIED = {"medu-vada", "puri", "samosa"}
# Dishes are category "dish" unless they belong with other foods (naan with breads).
# Drinks made from a recipe are judged by the drink thresholds (per 100 ml) and kept out of
# "good sources" suggestions, like other drinks.
DISH_CATEGORY = {"naan": "bread", "chai": "drink", "filter-coffee": "drink", "lassi": "drink", "chaas": "drink"}
# A dish's nutrient is reported only when the ingredients with no value for it weigh under this
# share of the dish: the same rule as the food Lambda (food/catalog.py).
UNKNOWN_SHARE = 0.05

for fid, name, aliases, recipe, units, default in DISHES:
    total = sum(recipe.values())
    parts = [(per100[i], g) for i, g in recipe.items() if i != "water"]
    values = {}
    for key in DECIMALS:
        missing = sum(g for n, g in parts if key not in n)
        if missing / total >= UNKNOWN_SHARE:
            continue
        values[key] = sum(n[key] * g / 100 for n, g in parts if key in n) / total * 100
    per100[fid] = values
    foods.append({"id": fid, "name": name, "aliases": aliases, "category": DISH_CATEGORY.get(fid, "dish"),
                  "per100g": rounded(values),
                  "units": units, "defaultUnit": default, "source": "Estimated from a typical home recipe",
                  "flags": ["deep-fried"] if fid in DEEP_FRIED else [], "cooked": True})

if gi_missing:
    raise SystemExit("no GI for foods with carbs, add them to GI: " + ", ".join(gi_missing))
unused = set(GI) - {f["id"] for f in foods}
if unused:
    raise SystemExit("GI for unknown ids: " + ", ".join(sorted(unused)))

out = [
    "// Generated by build_catalog.py from USDA FoodData Central (SR Legacy, public domain)",
    "// and rough home recipes. Values are per 100 g. Regenerate rather than hand-edit.",
    "import type { FoodItem } from './types';",
    "",
    "export const FOODS: FoodItem[] = [",
]
for f in foods:
    units = ", ".join(f"{{ key: '{k}', label: '{lbl}', grams: {g} }}" for k, lbl, g in f["units"])
    if not any(k == "g" for k, _, _ in f["units"]):
        units += ", { key: 'g', label: 'grams', grams: 1 }"
    # Optional fields only when set, so plain foods stay short.
    extra = ""
    if f.get("flags"):
        extra += f", flags: [{', '.join(repr(x) for x in f['flags'])}]"
    if f.get("ingredientOnly"):
        extra += ", ingredientOnly: true"
    if f.get("cooked"):
        extra += ", cooked: true"
    out.append(
        "  {"
        f" id: {json.dumps(f['id'])}, name: {json.dumps(f['name'])}, aliases: {json.dumps(f['aliases'])},"
        f" category: '{f['category']}', per100g: {json.dumps(f['per100g']).replace('\"', '')},"
        f" units: [{units}], defaultUnit: '{f['defaultUnit']}', source: {json.dumps(f['source'])}{extra}"
        " },"
    )
out.append("];")
open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(len(foods), "foods,", sum(1 for f in foods if f.get("ingredientOnly")), "ingredient-only")

# Spot check per usual portion: these should look like real food.
by_id = {f["id"]: f for f in foods}
CHECKS = [("dal", "bowl", ["kcal", "sodium", "potassium", "gl"]), ("chapati", "piece", ["kcal", "gl"]),
          ("rice", "bowl", ["kcal", "gl"]), ("chai", "cup", ["caffeine", "addedSugar"]),
          ("filter-coffee", "cup", ["caffeine", "addedSugar"]), ("lassi", "glass", ["addedSugar"]),
          ("samosa", "piece", ["kcal", "fat", "satFat", "transFat", "sodium"]), ("banana", "piece", ["vitB6", "potassium"]),
          ("naan", "piece", ["kcal", "thiamin", "iron", "sodium", "addedSugar"]), ("pasta", "cup", ["folate", "iron"]),
          ("honey", "tbsp", ["kcal", "addedSugar"]), ("ragi-mudde", "piece", ["kcal", "calcium", "iron", "sodium", "gl"]),
          ("butter-chicken", "bowl", ["kcal", "fat", "satFat", "sodium"]), ("sarson-ka-saag", "bowl", ["kcal", "fat", "sodium"]),
          ("sundal", "bowl", ["kcal", "sodium"]), ("oil", "tsp", ["omega3"])]
for fid, unit, keys in CHECKS:
    f = by_id[fid]
    grams = next(g for k, _, g in f["units"] if k == unit)
    n = per100[fid]
    gi = n["gl"] / (n["carbs"] - n["fiber"]) * 100 if n.get("carbs", 0) - n.get("fiber", 0) >= 5 else None
    shown = ", ".join(f"{k} {n[k] * grams / 100:.2f}" if k in n else f"{k} unknown" for k in keys)
    print(f"  {fid} 1 {unit} ({grams} g): {shown}" + (f", GI {gi:.0f}" if gi is not None else ""))
