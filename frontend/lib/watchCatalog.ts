/**
 * Miyaris lüks saat kataloğu — marka ve popüler modeller.
 *
 * Bu liste backend'in REFERENCE_PRICES sözlüğüyle uyumludur — burada seçilen
 * model string'i AI valuation lookup'ında brand+model_keyword fuzzy match için
 * kullanılır. Yeni model eklenirse worker/llm.py'deki sözlüğe de eklenmeli.
 */
export interface BrandCatalogEntry {
  brand: string;
  models: string[];
}

export const WATCH_CATALOG: BrandCatalogEntry[] = [
  {
    brand: "Rolex",
    models: [
      "Submariner Date",
      "Submariner",
      "GMT-Master II",
      "Daytona",
      "Datejust 41",
      "Datejust 36",
      "Day-Date 40",
      "Day-Date 36",
      "Explorer",
      "Explorer II",
      "Sea-Dweller",
      "Yacht-Master 42",
      "Yacht-Master 40",
      "Sky-Dweller",
      "Air-King",
      "Oyster Perpetual",
      "Cellini",
    ],
  },
  {
    brand: "Patek Philippe",
    models: [
      "Nautilus 5711",
      "Nautilus 5712",
      "Aquanaut 5167",
      "Aquanaut 5168",
      "Calatrava",
      "Grand Complications",
      "Twenty-4",
      "Annual Calendar",
      "Perpetual Calendar",
    ],
  },
  {
    brand: "Audemars Piguet",
    models: [
      "Royal Oak",
      "Royal Oak Chronograph",
      "Royal Oak Offshore",
      "Royal Oak Concept",
      "Code 11.59",
      "Millenary",
    ],
  },
  {
    brand: "Vacheron Constantin",
    models: [
      "Overseas",
      "Patrimony",
      "Traditionnelle",
      "Historiques",
      "FiftySix",
      "Métiers d'Art",
    ],
  },
  {
    brand: "Richard Mille",
    models: [
      "RM 11",
      "RM 35",
      "RM 27",
      "RM 67",
      "RM 055",
      "RM 030",
      "RM 010",
    ],
  },
  {
    brand: "A. Lange & Söhne",
    models: ["Lange 1", "Datograph", "Saxonia", "Odysseus", "Zeitwerk", "1815"],
  },
  {
    brand: "Omega",
    models: [
      "Speedmaster Professional",
      "Speedmaster",
      "Seamaster Diver",
      "Seamaster Aqua Terra",
      "Seamaster",
      "Constellation",
      "De Ville",
    ],
  },
  {
    brand: "Cartier",
    models: ["Tank", "Santos", "Ballon Bleu", "Pasha", "Roadster", "Drive"],
  },
  {
    brand: "IWC",
    models: [
      "Big Pilot",
      "Portuguese",
      "Pilot",
      "Aquatimer",
      "Da Vinci",
      "Ingenieur",
    ],
  },
  {
    brand: "Jaeger-LeCoultre",
    models: [
      "Reverso",
      "Master Ultra Thin",
      "Master",
      "Polaris",
      "Rendez-Vous",
      "Duomètre",
    ],
  },
  {
    brand: "Breitling",
    models: [
      "Navitimer",
      "Chronomat",
      "Premier",
      "Avenger",
      "Superocean",
      "Top Time",
    ],
  },
  {
    brand: "TAG Heuer",
    models: ["Carrera", "Monaco", "Aquaracer", "Formula 1", "Heuer 02", "Link"],
  },
  {
    brand: "Tudor",
    models: ["Black Bay", "Pelagos", "Heritage", "Royal", "Ranger", "1926"],
  },
  {
    brand: "Panerai",
    models: ["Luminor", "Radiomir", "Submersible", "Due"],
  },
  {
    brand: "Hublot",
    models: [
      "Big Bang",
      "Classic Fusion",
      "Spirit of Big Bang",
      "MP Collection",
    ],
  },
];

export const WATCH_BRANDS: string[] = WATCH_CATALOG.map((b) => b.brand);

export function modelsForBrand(brand: string): string[] {
  return WATCH_CATALOG.find((b) => b.brand === brand)?.models ?? [];
}
