"""Builds src/nutrition/foods.generated.ts from the fetched USDA SR Legacy data plus recipes.

Usage: python -I build_catalog.py FDC_DIR OUT_TS
"""
import json
import sys

FDC_DIR, OUT = sys.argv[1], sys.argv[2]

NUTRIENT_NUMBERS = {
    "kcal": "208", "protein": "203", "carbs": "205", "fat": "204", "fiber": "291",
    "vitA": "320", "vitC": "401", "vitD": "328", "vitB12": "418", "folate": "435",
    "calcium": "301", "iron": "303", "potassium": "306", "magnesium": "304", "zinc": "309",
}
DECIMALS = {"kcal": 0, "protein": 1, "carbs": 1, "fat": 1, "fiber": 1, "vitA": 0, "vitC": 1, "vitD": 1,
            "vitB12": 2, "folate": 0, "calcium": 0, "iron": 2, "potassium": 0, "magnesium": 0, "zinc": 2}

usda = {}
for batch in ["fruit", "veg", "grain", "animal"]:
    for f in json.load(open(f"{FDC_DIR}/{batch}.json", encoding="utf-8"))["foods"]:
        values = {}
        for n in f["foodNutrients"]:
            for key, num in NUTRIENT_NUMBERS.items():
                if n.get("nutrientNumber") == num and n.get("value") is not None:
                    values[key] = float(n["value"])
        usda[f["description"].lower()] = {"fdcId": f["fdcId"], "description": f["description"], "n": values}


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
    ("peanuts", "Peanuts (roasted)", ["moongphali", "groundnut", "verkadalai", "palli", "shengdana"], "nut", "Peanuts, all types, dry-roasted, without salt", [HANDFUL, TBSP], "handful"),
    ("peanut-butter", "Peanut butter", [], "nut", "Peanut butter, smooth style, without salt", [("tbsp", "tablespoon", 16)], "tbsp"),
    # Vegetables
    ("potato", "Potato (boiled)", ["aloo", "batata", "urulaikizhangu", "bangaladumpa"], "vegetable", "Potatoes, boiled, cooked without skin, flesh, without salt", [("piece", "medium potato", 135), ("cup", "cup, diced", 156)], "piece"),
    ("onion", "Onion", ["pyaz", "pyaaz", "kanda", "vengayam", "ullipaya"], "vegetable", "Onions, raw", [("piece", "medium onion", 110)], "piece"),
    ("tomato", "Tomato", ["tamatar", "thakkali"], "vegetable", "Tomatoes, red, ripe, raw, year round average", [("piece", "medium tomato", 123)], "piece"),
    ("spinach", "Spinach (cooked)", ["palak", "keerai", "palakura"], "vegetable", "Spinach, cooked, boiled, drained, without salt", [BOWL, ("cup", "cup", 180)], "bowl"),
    ("spinach-raw", "Spinach (raw)", ["palak"], "vegetable", "Spinach, raw", [("cup", "cup", 30)], "cup"),
    ("carrot", "Carrot", ["gajar", "gajjar"], "vegetable", "Carrots, raw", [("piece", "medium carrot", 61)], "piece"),
    ("cabbage", "Cabbage", ["patta gobhi", "band gobhi", "muttaikose", "kosu"], "vegetable", "Cabbage, raw", [("cup", "cup, chopped", 89)], "cup"),
    ("cauliflower", "Cauliflower (cooked)", ["gobi", "phool gobhi"], "vegetable", "Cauliflower, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("brinjal", "Brinjal (cooked)", ["baingan", "eggplant", "kathirikai", "vankaya", "vangi"], "vegetable", "Eggplant, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("okra", "Okra / bhindi (cooked)", ["bhindi", "ladies finger", "vendakkai", "bendakaya"], "vegetable", "Okra, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    ("peas", "Green peas (cooked)", ["matar", "pattani", "batani"], "vegetable", "Peas, green, cooked, boiled, drained, without salt", [BOWL, ("cup", "cup", 160)], "bowl"),
    ("beans", "Green beans (cooked)", ["french beans", "beans poriyal"], "vegetable", "Beans, snap, green, cooked, boiled, drained, without salt", [BOWL], "bowl"),
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
    ("coriander", "Coriander leaves", ["dhania", "kothamalli", "cilantro"], "vegetable", "Coriander (cilantro) leaves, raw", [TBSP], "tbsp"),
    ("mustard-greens", "Mustard greens (cooked)", ["sarson ka saag", "sarson"], "vegetable", "Mustard greens, cooked, boiled, drained, without salt", [BOWL], "bowl"),
    # Grains and breads
    ("rice", "Rice (white, cooked)", ["chawal", "bhat", "sadam", "annam", "choru", "plain rice"], "grain", "Rice, white, long-grain, regular, enriched, cooked", [BOWL, ("cup", "cup", 158), ("plate", "plate", 250)], "bowl"),
    ("brown-rice", "Rice (brown, cooked)", ["brown rice"], "grain", "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", [BOWL], "bowl"),
    ("chapati", "Chapati / roti", ["roti", "phulka", "chapathi", "rotli", "fulka"], "bread", "Bread, chapati or roti, whole wheat, commercially prepared, frozen", [("piece", "roti", 40)], "piece"),
    ("naan", "Naan", ["nan"], "bread", "Bread, naan, plain, commercially prepared, refrigerated", [("piece", "naan", 90)], "piece"),
    ("bread", "Bread (white)", ["pav", "sandwich bread"], "bread", "Bread, white, commercially prepared (includes soft bread crumbs)", [("slice", "slice", 25)], "slice"),
    ("bread-brown", "Bread (whole wheat)", ["brown bread", "atta bread"], "bread", "Bread, whole-wheat, commercially prepared", [("slice", "slice", 28)], "slice"),
    ("oats", "Oats (cooked)", ["oatmeal", "porridge"], "grain", "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt", [BOWL, ("cup", "cup", 234)], "bowl"),
    ("millet", "Millet (cooked)", ["bajra", "jowar", "ragi", "siridhanya"], "grain", "Millet, cooked", [BOWL], "bowl"),
    ("pasta", "Pasta (cooked)", ["macaroni", "spaghetti"], "grain", "Pasta, cooked, enriched, without added salt", [("cup", "cup", 140)], "cup"),
    ("atta", "Wheat flour (atta)", ["atta", "whole wheat flour"], "grain", "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)", [("cup", "cup", 120), TBSP], "cup"),
    # Legumes
    ("toor-dal", "Toor dal (cooked, plain)", ["arhar", "tuvar", "pigeon peas", "kandi pappu", "thuvaram paruppu"], "legume", "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("masoor-dal", "Masoor dal (cooked, plain)", ["lentils", "red lentils"], "legume", "Lentils, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("moong-dal", "Moong dal (cooked, plain)", ["mung", "green gram", "pesarapappu", "pasi paruppu"], "legume", "Mung beans, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("urad-dal", "Urad dal (cooked, plain)", ["black gram", "minapappu", "ulundhu"], "legume", "Mungo beans, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("chickpeas", "Chickpeas (boiled)", ["chana", "kabuli chana", "chole", "kondakadalai", "sundal"], "legume", "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
    ("kidney-beans", "Kidney beans (boiled)", ["rajma"], "legume", "Beans, kidney, all types, mature seeds, cooked, boiled, without salt", [BOWL], "bowl"),
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
    ("buttermilk-plain", "Buttermilk (cultured)", [], "dairy", "Milk, buttermilk, fluid, cultured, lowfat", [("glass", "glass", 245)], "glass"),
    ("cheese", "Cheese (cheddar)", ["cheese slice"], "dairy", "Cheese, cheddar, sharp, sliced", [("slice", "slice", 21)], "slice"),
    ("mozzarella", "Mozzarella", ["pizza cheese"], "dairy", "Cheese, mozzarella, whole milk", [("cup", "cup, shredded", 112)], "cup"),
    ("cream", "Cream (fresh)", ["malai"], "dairy", "Cream, fluid, heavy whipping", [TBSP], "tbsp"),
    ("ice-cream", "Ice cream (vanilla)", ["kulfi"], "sweet", "Ice creams, vanilla", [("scoop", "scoop", 66)], "scoop"),
    ("tea-black", "Tea (black, no milk)", ["black tea", "kattan chai"], "drink", "Beverages, tea, black, brewed, prepared with tap water", [("cup", "cup", 150)], "cup"),
    ("coffee-black", "Coffee (black, no milk)", ["black coffee"], "drink", "Beverages, coffee, brewed, prepared with tap water", [("cup", "cup", 150)], "cup"),
    # Fats and sweeteners
    ("ghee", "Ghee", ["clarified butter", "neyyi", "nei", "tuppa"], "fat", "Butter oil, anhydrous", [TSP, TBSP], "tsp"),
    ("butter", "Butter", ["makhan", "venna"], "fat", "Butter, salted", [TSP, TBSP], "tsp"),
    ("oil", "Cooking oil", ["sunflower oil", "groundnut oil", "refined oil", "tel", "ennai"], "fat", "Oil, canola", [TSP, TBSP], "tsp"),
    ("coconut-oil", "Coconut oil", ["thengai ennai", "velichenna"], "fat", "Oil, coconut", [TSP, TBSP], "tsp"),
    ("mustard-oil", "Mustard oil", ["sarson ka tel"], "fat", "Oil, mustard", [TSP, TBSP], "tsp"),
    ("sugar", "Sugar", ["cheeni", "sakkarai", "chakkera"], "sweet", "Sugars, granulated", [("tsp", "teaspoon", 4)], "tsp"),
    ("honey", "Honey", ["shahad", "madhu", "then"], "sweet", "Honey", [("tsp", "teaspoon", 7), TBSP], "tsp"),
]

# Dishes: grams of each ingredient (catalog ids above, or "water") for one batch.
# Rough home-style recipes; per-100 g values follow from the batch's total weight.
DISHES = [
    ("dal", "Dal (toor, home-style)", ["dal tadka", "dal fry", "paruppu", "pappu", "varan"], {"toor-dal": 100, "tomato": 20, "onion": 15, "oil": 5, "water": 50}, [BOWL], "bowl"),
    ("sambar", "Sambar", ["sambhar", "kuzhambu"], {"toor-dal": 50, "drumstick": 20, "pumpkin": 30, "tomato": 20, "onion": 20, "oil": 5, "water": 100}, [BOWL], "bowl"),
    ("rasam", "Rasam", ["saaru", "charu"], {"toor-dal": 15, "tomato": 40, "oil": 3, "lemon": 5, "water": 150}, [BOWL], "bowl"),
    ("idli", "Idli", ["idly", "iddli"], {"rice": 65, "urad-dal": 35}, [("piece", "idli", 40)], "piece"),
    ("dosa", "Dosa (plain)", ["dosai", "dose", "plain dosa"], {"rice": 60, "urad-dal": 30, "oil": 5}, [("piece", "dosa", 90)], "piece"),
    ("masala-dosa", "Masala dosa", ["masala dosai"], {"rice": 60, "urad-dal": 30, "oil": 8, "potato": 70, "onion": 10}, [("piece", "masala dosa", 175)], "piece"),
    ("uttapam", "Uttapam", ["uthappam", "oothappam"], {"rice": 60, "urad-dal": 30, "oil": 6, "onion": 15, "tomato": 10}, [("piece", "uttapam", 120)], "piece"),
    ("medu-vada", "Medu vada", ["vada", "vadai", "garelu", "uddina vada"], {"urad-dal": 60, "oil": 12, "onion": 5}, [("piece", "vada", 45)], "piece"),
    ("upma", "Upma", ["uppittu", "rava upma"], {"semolina": 30, "water": 80, "oil": 5, "onion": 10, "peas": 10}, [BOWL], "bowl"),
    ("poha", "Poha", ["aval", "avalakki", "atukulu", "chivda"], {"rice-raw": 40, "water": 40, "oil": 5, "onion": 15, "peanuts": 5, "potato": 15}, [BOWL, ("plate", "plate", 200)], "plate"),
    ("khichdi", "Khichdi", ["kichdi", "pongal"], {"rice": 60, "moong-dal": 40, "ghee": 3, "water": 30}, [BOWL], "bowl"),
    ("curd-rice", "Curd rice", ["thayir sadam", "daddojanam", "mosaranna"], {"rice": 60, "curd": 40, "oil": 1}, [BOWL], "bowl"),
    ("lemon-rice", "Lemon rice", ["chitranna", "pulihora", "tamarind rice"], {"rice": 85, "oil": 5, "peanuts": 5, "lemon": 5}, [BOWL], "bowl"),
    ("chicken-curry", "Chicken curry", ["murgh curry", "kozhi kuzhambu", "chicken masala", "butter chicken"], {"chicken-thigh": 50, "onion": 20, "tomato": 20, "oil": 6, "curd": 5, "water": 30}, [BOWL], "bowl"),
    ("fish-curry", "Fish curry", ["meen kuzhambu", "machher jhol", "chepala pulusu"], {"fish-seer": 50, "coconut": 10, "tomato": 15, "onion": 10, "oil": 5, "water": 40}, [BOWL], "bowl"),
    ("egg-curry", "Egg curry", ["anda curry", "muttai kuzhambu"], {"egg-boiled": 50, "onion": 20, "tomato": 20, "oil": 6, "water": 30}, [BOWL], "bowl"),
    ("mutton-curry", "Mutton curry", ["gosht curry", "rogan josh", "mutton kuzhambu"], {"mutton": 50, "onion": 20, "tomato": 15, "oil": 8, "curd": 5, "water": 30}, [BOWL], "bowl"),
    ("paneer-curry", "Paneer butter masala", ["paneer makhani", "shahi paneer", "paneer curry"], {"paneer": 35, "tomato": 35, "butter": 5, "cream": 8, "onion": 10, "cashews": 4, "water": 20}, [BOWL], "bowl"),
    ("palak-paneer", "Palak paneer", ["saag paneer"], {"spinach": 60, "paneer": 25, "oil": 4, "onion": 10, "cream": 3}, [BOWL], "bowl"),
    ("rajma", "Rajma curry", ["rajma masala", "rajma chawal"], {"kidney-beans": 80, "onion": 15, "tomato": 20, "oil": 5, "water": 40}, [BOWL], "bowl"),
    ("chole", "Chole / chana masala", ["chana masala", "chole masala", "chana curry"], {"chickpeas": 80, "onion": 15, "tomato": 20, "oil": 6, "water": 40}, [BOWL], "bowl"),
    ("aloo-sabzi", "Aloo sabzi", ["potato curry", "aloo bhaji", "urulai roast", "batata bhaji"], {"potato": 85, "oil": 6, "onion": 10, "tomato": 10}, [BOWL], "bowl"),
    ("mixed-veg", "Mixed vegetable sabzi", ["veg curry", "sabzi", "poriyal", "kurma", "avial"], {"carrot": 20, "beans": 20, "peas": 20, "cauliflower": 20, "potato": 15, "oil": 5, "onion": 10, "tomato": 10}, [BOWL], "bowl"),
    ("bhindi-sabzi", "Bhindi sabzi", ["bhindi fry", "vendakkai poriyal"], {"okra": 85, "onion": 10, "oil": 6}, [BOWL], "bowl"),
    ("chicken-biryani", "Chicken biryani", ["biryani", "biriyani", "dum biryani"], {"rice": 55, "chicken-thigh": 25, "onion": 8, "curd": 5, "ghee": 5, "tomato": 5}, [("plate", "plate", 300), BOWL], "plate"),
    ("veg-biryani", "Veg biryani / pulao", ["pulao", "pulav", "veg pulao"], {"rice": 70, "peas": 10, "carrot": 8, "ghee": 4, "onion": 8}, [("plate", "plate", 250), BOWL], "plate"),
    ("paratha", "Paratha (plain)", ["parotta", "parantha"], {"atta": 40, "ghee": 7, "water": 13}, [("piece", "paratha", 80)], "piece"),
    ("aloo-paratha", "Aloo paratha", ["alu paratha"], {"atta": 35, "potato": 35, "ghee": 7, "water": 10, "onion": 3}, [("piece", "aloo paratha", 120)], "piece"),
    ("puri", "Puri", ["poori"], {"atta": 25, "oil": 8, "water": 8}, [("piece", "puri", 25)], "piece"),
    ("samosa", "Samosa", ["samsa"], {"atta": 20, "oil": 15, "potato": 35, "peas": 5, "onion": 5}, [("piece", "samosa", 70)], "piece"),
    ("chai", "Tea with milk and sugar", ["chai", "masala chai", "tea"], {"tea-black": 90, "milk": 50, "sugar": 8}, [("cup", "cup", 150)], "cup"),
    ("filter-coffee", "Coffee with milk and sugar", ["filter coffee", "kaapi", "coffee"], {"coffee-black": 60, "milk": 90, "sugar": 8}, [("cup", "cup", 150)], "cup"),
    ("lassi", "Sweet lassi", ["lassi"], {"curd": 150, "water": 50, "sugar": 15}, [("glass", "glass", 250)], "glass"),
    ("chaas", "Buttermilk (chaas)", ["chaas", "majjige", "moru", "mattha", "chhachh"], {"curd": 60, "water": 140}, [("glass", "glass", 200)], "glass"),
]

# Not in USDA SR Legacy; rough values from typical packaged paneer labels (per 100 g).
PANEER = {"kcal": 290, "protein": 18, "carbs": 4, "fat": 22, "calcium": 400}
EXTRA_RAW = {"semolina": "Semolina, enriched", "rice-raw": "Rice, white, long-grain, regular, raw, enriched"}

per100 = {}
foods = []


def rounded(values):
    return {k: round(values[k], DECIMALS[k]) if DECIMALS[k] else int(round(values[k])) for k in NUTRIENT_NUMBERS if k in values}


for fid, name, aliases, category, desc, units, default in RAW:
    hit = u(desc)
    per100[fid] = hit["n"]
    foods.append({"id": fid, "name": name, "aliases": aliases, "category": category, "per100g": rounded(hit["n"]),
                  "units": units, "defaultUnit": default, "source": f"USDA FoodData Central #{hit['fdcId']}"})
for fid, desc in EXTRA_RAW.items():
    per100[fid] = u(desc)["n"]
per100["paneer"] = PANEER
per100["water"] = {}
foods.append({"id": "paneer", "name": "Paneer", "aliases": ["cottage cheese", "chhena"], "category": "dairy",
              "per100g": PANEER, "units": [("piece", "cube (20 g)", 20), ("bowl", "bowl (100 g)", 100)], "defaultUnit": "bowl",
              "source": "Estimate from typical paneer labels"})

for fid, name, aliases, recipe, units, default in DISHES:
    total = sum(recipe.values())
    values = {}
    for key in NUTRIENT_NUMBERS:
        # A nutrient counts only when every ingredient that matters reports it.
        parts = [(per100[i].get(key), g) for i, g in recipe.items() if i != "water"]
        known = [(v, g) for v, g in parts if v is not None]
        if not known or any(v is None for v, g in parts if g >= total * 0.1):
            continue
        values[key] = sum(v * g / 100 for v, g in known) / total * 100
    foods.append({"id": fid, "name": name, "aliases": aliases, "category": "dish", "per100g": rounded(values),
                  "units": units, "defaultUnit": default, "source": "Estimated from a typical home recipe"})

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
    out.append(
        "  {"
        f" id: {json.dumps(f['id'])}, name: {json.dumps(f['name'])}, aliases: {json.dumps(f['aliases'])},"
        f" category: '{f['category']}', per100g: {json.dumps(f['per100g']).replace('\"', '')},"
        f" units: [{units}], defaultUnit: '{f['defaultUnit']}', source: {json.dumps(f['source'])}"
        " },"
    )
out.append("];")
open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(len(foods), "foods")
for f in foods:
    if f["category"] == "dish" or f["id"] in ("rice", "chapati", "banana", "paneer"):
        print(f["id"], f["per100g"])
