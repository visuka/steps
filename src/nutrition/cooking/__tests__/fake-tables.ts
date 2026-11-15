/**
 * INVENTED cooking tables and ingredient profiles for jest only. None of these numbers is real
 * or comes from the server's data; they only have the same shape. fake-golden.json was worked from
 * them with the server's own maths.
 */
import type { CookingTables, IngredientProfile } from '../types';

export const FAKE_TABLES: CookingTables = {
  "calc": "c1",
  "methods": {
    "raw": {
      "sameAs": [],
      "liquidEaten": false
    },
    "soaked": {
      "sameAs": [],
      "liquidEaten": false
    },
    "sprouted": {
      "sameAs": [],
      "liquidEaten": false
    },
    "boiled": {
      "sameAs": [],
      "liquidEaten": false
    },
    "boiled-drained": {
      "sameAs": [
        "boiled"
      ],
      "liquidEaten": false
    },
    "pressure-cooked": {
      "sameAs": [
        "boiled"
      ],
      "liquidEaten": true
    },
    "steamed": {
      "sameAs": [
        "boiled"
      ],
      "liquidEaten": false
    },
    "simmered": {
      "sameAs": [
        "boiled"
      ],
      "liquidEaten": true
    },
    "stir-fried": {
      "sameAs": [],
      "liquidEaten": false
    },
    "shallow-fried": {
      "sameAs": [
        "stir-fried"
      ],
      "liquidEaten": false
    },
    "deep-fried": {
      "sameAs": [
        "shallow-fried"
      ],
      "liquidEaten": false
    },
    "roasted": {
      "sameAs": [],
      "liquidEaten": false
    },
    "grilled": {
      "sameAs": [
        "roasted"
      ],
      "liquidEaten": false
    }
  },
  "retentionMap": {
    "tuber": {
      "boiled": "R1",
      "steamed": "R1",
      "pressure-cooked": "R1",
      "shallow-fried": "R2",
      "deep-fried": "R2",
      "deep-fried+coated": "R3",
      "roasted": "R2"
    },
    "leafy": {
      "boiled": "R4",
      "steamed": "R4",
      "stir-fried": "R5"
    },
    "drink": {
      "simmered": "R6",
      "boiled": "R6"
    },
    "grain": {
      "boiled": "R7",
      "pressure-cooked": "R7"
    },
    "grain-flour": {
      "deep-fried": "R2",
      "deep-fried+coated": "R3"
    },
    "meat": {
      "roasted": "R2"
    }
  },
  "retention": {
    "proxies": {
      "vitK": "vitA"
    },
    "codes": {
      "R1": {
        "vitC": 60,
        "thiamin": 80,
        "folate": 70
      },
      "R2": {
        "vitC": 60,
        "thiamin": 90
      },
      "R3": {
        "vitC": 50,
        "thiamin": 85,
        "folate": 60,
        "folicAcid": 90
      },
      "R4": {
        "vitC": 50,
        "folate": 70,
        "vitA": 90
      },
      "R5": {
        "vitC": 70,
        "folate": 80
      },
      "R6": {
        "alcohol": 20
      },
      "R7": {
        "thiamin": 70,
        "folate": 75,
        "sodium": 40
      }
    }
  },
  "yields": {
    "limits": [
      0.3,
      4.0
    ],
    "classes": {
      "tuber": {
        "shallow-fried": 0.6,
        "deep-fried": 0.55,
        "roasted": 0.8
      },
      "grain": {
        "boiled": 2.5
      },
      "pulse": {
        "boiled": 2.2,
        "pressure-cooked": 2.3
      },
      "leafy": {
        "boiled": 0.8,
        "stir-fried": 0.7
      },
      "meat": {
        "roasted": 0.75,
        "grilled": 0.7,
        "boiled": 0.6,
        "simmered": 0.65
      },
      "fish@dried": {
        "boiled": {
          "protein": 20
        }
      },
      "grain-flour": {
        "deep-fried": 1.0
      }
    },
    "methods": {
      "deep-fried": 0.65,
      "stir-fried": 0.8,
      "steamed": 0.97,
      "shallow-fried": 0.75
    },
    "gravyWater": {
      "simmered": 0.5,
      "pressure-cooked": 0.6
    }
  },
  "fatDrip": {
    "meat": {
      "roasted": 0.8,
      "grilled": 0.7,
      "stir-fried": 0.9
    }
  },
  "oilUptake": [
    {
      "method": "deep-fried",
      "classes": [
        "tuber"
      ],
      "names": "chips|fries",
      "u": 12,
      "y": 0.4
    },
    {
      "method": "deep-fried",
      "classes": [
        "grain-flour"
      ],
      "coating": [
        "none"
      ],
      "u": 15,
      "withWater": true,
      "waterLeft": 0.4
    },
    {
      "method": "deep-fried",
      "coating": [
        "batter",
        "breaded"
      ],
      "u": 20
    },
    {
      "method": "deep-fried",
      "u": 8
    },
    {
      "method": "shallow-fried",
      "classes": [
        "tuber"
      ],
      "u": 5
    },
    {
      "method": "shallow-fried",
      "u": 4
    },
    {
      "method": "stir-fried",
      "u": 2
    }
  ],
  "oils": {
    "byCountry": {
      "IN": "fake-oil",
      "*": "fake-oil-b"
    },
    "foods": {
      "fake-oil": {
        "name": "Test oil",
        "per100g": {
          "kcal": 900,
          "protein": 0,
          "carbs": 0,
          "fiber": 0,
          "fat": 100,
          "satFat": 14
        },
        "missing": []
      },
      "fake-oil-b": {
        "name": "Other test oil",
        "per100g": {
          "kcal": 880,
          "protein": 0,
          "carbs": 0,
          "fiber": 0,
          "fat": 98,
          "satFat": 20,
          "vitE": 14
        },
        "missing": []
      }
    }
  }
};

export const FAKE_PROFILES: Record<string, IngredientProfile> = {
  "potato": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-potato",
    "recName": "Potato, raw",
    "per100g": {
      "kcal": 80,
      "protein": 2,
      "carbs": 17,
      "fiber": 2,
      "fat": 0.1,
      "vitC": 20,
      "thiamin": 0.1,
      "folate": 15
    },
    "missing": [],
    "cookClass": "tuber",
    "yieldClass": "tuber",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {
      "boiled": {
        "y": 0.95
      },
      "shallow-fried": {
        "y": 0.5,
        "oilU": 5
      },
      "deep-fried": {
        "y": 0.45,
        "oilU": 10
      }
    },
    "cooked": {
      "boiled": {
        "id": "fake-potato-boiled",
        "per100g": {
          "kcal": 87,
          "protein": 1.9,
          "carbs": 20,
          "fiber": 1.8,
          "fat": 0.1,
          "vitC": 13
        },
        "missing": []
      },
      "boiled-drained": {
        "id": "fake-potato-boiled",
        "per100g": {
          "kcal": 87,
          "protein": 1.9,
          "carbs": 20,
          "fiber": 1.8,
          "fat": 0.1,
          "vitC": 13
        },
        "missing": []
      },
      "pressure-cooked": {
        "id": "fake-potato-boiled",
        "per100g": {
          "kcal": 87,
          "protein": 1.9,
          "carbs": 20,
          "fiber": 1.8,
          "fat": 0.1,
          "vitC": 13
        },
        "missing": []
      },
      "steamed": {
        "id": "fake-potato-boiled",
        "per100g": {
          "kcal": 87,
          "protein": 1.9,
          "carbs": 20,
          "fiber": 1.8,
          "fat": 0.1,
          "vitC": 13
        },
        "missing": []
      },
      "simmered": {
        "id": "fake-potato-boiled",
        "per100g": {
          "kcal": 87,
          "protein": 1.9,
          "carbs": 20,
          "fiber": 1.8,
          "fat": 0.1,
          "vitC": 13
        },
        "missing": []
      },
      "deep-fried": {
        "id": "fake-potato-fries",
        "per100g": {
          "kcal": 250,
          "protein": 3,
          "carbs": 35,
          "fat": 11,
          "fiber": 3,
          "vitC": 6
        },
        "missing": []
      }
    }
  },
  "rice": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-rice",
    "recName": "Rice, white, raw",
    "per100g": {
      "kcal": 350,
      "protein": 7,
      "carbs": 78,
      "fiber": 1,
      "fat": 0.6,
      "thiamin": 0.4,
      "folate": 20,
      "sodium": 5
    },
    "missing": [],
    "cookClass": "grain",
    "yieldClass": "grain",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {
      "boiled": {
        "id": "fake-rice-cooked",
        "per100g": {
          "kcal": 130,
          "protein": 2.7,
          "carbs": 28,
          "fiber": 0.4,
          "fat": 0.3,
          "thiamin": 0.16,
          "folate": 8,
          "sodium": 1
        },
        "missing": []
      },
      "boiled-drained": {
        "id": "fake-rice-cooked",
        "per100g": {
          "kcal": 130,
          "protein": 2.7,
          "carbs": 28,
          "fiber": 0.4,
          "fat": 0.3,
          "thiamin": 0.16,
          "folate": 8,
          "sodium": 1
        },
        "missing": []
      },
      "pressure-cooked": {
        "id": "fake-rice-cooked",
        "per100g": {
          "kcal": 130,
          "protein": 2.7,
          "carbs": 28,
          "fiber": 0.4,
          "fat": 0.3,
          "thiamin": 0.16,
          "folate": 8,
          "sodium": 1
        },
        "missing": []
      },
      "steamed": {
        "id": "fake-rice-cooked",
        "per100g": {
          "kcal": 130,
          "protein": 2.7,
          "carbs": 28,
          "fiber": 0.4,
          "fat": 0.3,
          "thiamin": 0.16,
          "folate": 8,
          "sodium": 1
        },
        "missing": []
      },
      "simmered": {
        "id": "fake-rice-cooked",
        "per100g": {
          "kcal": 130,
          "protein": 2.7,
          "carbs": 28,
          "fiber": 0.4,
          "fat": 0.3,
          "thiamin": 0.16,
          "folate": 8,
          "sodium": 1
        },
        "missing": []
      }
    }
  },
  "brown-rice": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-brown-rice",
    "recName": "Rice, brown, raw",
    "per100g": {
      "kcal": 360,
      "protein": 8,
      "carbs": 76,
      "fiber": 3.5,
      "fat": 2.7,
      "thiamin": 0.4,
      "folate": 20,
      "sodium": 6
    },
    "missing": [],
    "cookClass": "grain",
    "yieldClass": "grain",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "dal": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-dal",
    "recName": "Lentils, raw",
    "per100g": {
      "kcal": 340,
      "protein": 22,
      "carbs": 60,
      "fiber": 15,
      "fat": 1.5,
      "folate": 400,
      "thiamin": 0.5
    },
    "missing": [
      "folate"
    ],
    "cookClass": "pulse",
    "yieldClass": "pulse",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "chicken": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-chicken",
    "recName": "Chicken, raw",
    "per100g": {
      "kcal": 200,
      "protein": 20,
      "carbs": 0,
      "fat": 13,
      "satFat": 4,
      "sodium": 70,
      "thiamin": 0.1
    },
    "missing": [],
    "cookClass": "meat",
    "yieldClass": "meat",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "flour": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-flour",
    "recName": "Flour, raw",
    "per100g": {
      "kcal": 360,
      "protein": 10,
      "carbs": 76,
      "fiber": 3,
      "fat": 1,
      "thiamin": 0.3,
      "folate": 30
    },
    "missing": [],
    "cookClass": "grain-flour",
    "yieldClass": "grain-flour",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {},
    "folicAcid": true
  },
  "spinach": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-spinach",
    "recName": "Spinach, raw",
    "per100g": {
      "kcal": 23,
      "protein": 2.9,
      "carbs": 3.6,
      "fiber": 2.2,
      "fat": 0.4,
      "vitC": 28,
      "folate": 190,
      "vitA": 470,
      "vitK": 480
    },
    "missing": [],
    "cookClass": "leafy",
    "yieldClass": "leafy",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "wine": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-wine",
    "recName": "Wine, table",
    "per100g": {
      "kcal": 83,
      "protein": 0.1,
      "carbs": 2.6,
      "fat": 0,
      "alcohol": 10.5
    },
    "missing": [],
    "cookClass": "drink",
    "yieldClass": "drink",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "dried-fish": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-dried-fish",
    "recName": "Fish, dried",
    "per100g": {
      "kcal": 290,
      "protein": 60,
      "carbs": 0,
      "fat": 5,
      "sodium": 4000
    },
    "missing": [],
    "cookClass": "fish",
    "yieldClass": "fish@dried",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "boiled-potato": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-potato-boiled",
    "recName": "Potato, boiled",
    "per100g": {
      "kcal": 87,
      "protein": 1.9,
      "carbs": 20,
      "fiber": 1.8,
      "fat": 0.1,
      "vitC": 13
    },
    "missing": [],
    "cookClass": "tuber",
    "yieldClass": "tuber",
    "asEaten": true,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "salt": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-salt",
    "recName": "Salt",
    "per100g": {
      "kcal": 0,
      "sodium": 38000
    },
    "missing": [],
    "cookClass": "none",
    "yieldClass": "none",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": true,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "water": {
    "calc": "c1",
    "kind": "water",
    "id": "fake-water",
    "recName": "Water",
    "per100g": {
      "kcal": 0,
      "protein": 0,
      "carbs": 0,
      "fiber": 0,
      "fat": 0
    },
    "missing": [],
    "cookClass": "none",
    "yieldClass": "none",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": true,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "oil": {
    "calc": "c1",
    "kind": "oil",
    "id": "fake-oil",
    "recName": "Test oil",
    "per100g": {
      "kcal": 900,
      "protein": 0,
      "carbs": 0,
      "fiber": 0,
      "fat": 100,
      "satFat": 14
    },
    "missing": [],
    "cookClass": "none",
    "yieldClass": "none",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": true,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "oil-b": {
    "calc": "c1",
    "kind": "oil",
    "id": "fake-oil-b",
    "recName": "Other test oil",
    "per100g": {
      "kcal": 880,
      "protein": 0,
      "carbs": 0,
      "fiber": 0,
      "fat": 98,
      "satFat": 20,
      "vitE": 14
    },
    "missing": [],
    "cookClass": "none",
    "yieldClass": "none",
    "asEaten": false,
    "fryAgain": true,
    "noMethod": true,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "paste": {
    "calc": "c1",
    "kind": "food",
    "id": null,
    "recName": "Paste, mystery",
    "per100g": {
      "kcal": 150,
      "protein": 4,
      "carbs": 20,
      "fat": 6
    },
    "missing": [],
    "cookClass": "none",
    "yieldClass": "none",
    "asEaten": false,
    "fryAgain": false,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {},
    "pending": true
  },
  "fries": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-potato-fries",
    "recName": "Potato, fried",
    "per100g": {
      "kcal": 250,
      "protein": 3,
      "carbs": 35,
      "fat": 11,
      "fiber": 3,
      "vitC": 6
    },
    "missing": [],
    "cookClass": "tuber",
    "yieldClass": "tuber",
    "asEaten": true,
    "fryAgain": false,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  },
  "rice-cooked": {
    "calc": "c1",
    "kind": "food",
    "id": "fake-rice-cooked",
    "recName": "Rice, white, cooked",
    "per100g": {
      "kcal": 130,
      "protein": 2.7,
      "carbs": 28,
      "fiber": 0.4,
      "fat": 0.3,
      "thiamin": 0.16,
      "folate": 8,
      "sodium": 1
    },
    "missing": [],
    "cookClass": "grain",
    "yieldClass": "grain",
    "asEaten": true,
    "fryAgain": true,
    "noMethod": false,
    "basis": "raw",
    "rawGrams": 0,
    "yields": {},
    "cooked": {}
  }
};
