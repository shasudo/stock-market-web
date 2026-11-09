/**
 * NSE Indices Ltd. Industry Classification Structure (July 2023).
 * "Sector" here is NSE's "Industry" tier; "industries" below are NSE's
 * "Basic Industry" tier. Source: nsearchives.nseindia.com industry
 * classification structure PDF.
 */
export const NSE_SECTORS = [
  "Aerospace & Defense",
  "Agricultural Food & other Products",
  "Agricultural, Commercial & Construction Vehicles",
  "Auto Components",
  "Automobiles",
  "Banks",
  "Beverages",
  "Capital Markets",
  "Cement & Cement Products",
  "Chemicals & Petrochemicals",
  "Cigarettes & Tobacco Products",
  "Commercial Services & Supplies",
  "Construction",
  "Consumable Fuels",
  "Consumer Durables",
  "Diversified",
  "Diversified FMCG",
  "Diversified Metals",
  "Electrical Equipment",
  "Engineering Services",
  "Entertainment",
  "Ferrous Metals",
  "Fertilizers & Agrochemicals",
  "Finance",
  "Financial Technology (Fintech)",
  "Food Products",
  "Gas",
  "Healthcare Equipment & Supplies",
  "Healthcare Services",
  "Household Products",
  "Industrial Manufacturing",
  "Industrial Products",
  "Insurance",
  "IT - Hardware",
  "IT - Services",
  "IT - Software",
  "Leisure Services",
  "Media",
  "Metals & Minerals Trading",
  "Minerals & Mining",
  "Non - Ferrous Metals",
  "Oil",
  "Other Construction Materials",
  "Other Consumer Services",
  "Other Utilities",
  "Paper, Forest & Jute Products",
  "Personal Products",
  "Petroleum Products",
  "Pharmaceuticals & Biotechnology",
  "Power",
  "Printing & Publication",
  "Realty",
  "Retailing",
  "Telecom - Equipment & Accessories",
  "Telecom - Services",
  "Textiles & Apparels",
  "Transport Infrastructure",
  "Transport Services",
] as const;

export type NseSector = (typeof NSE_SECTORS)[number];

export const SECTOR_INDUSTRIES: Readonly<Record<NseSector, readonly string[]>> =
  {
    "Aerospace & Defense": ["Aerospace & Defense"],
    "Agricultural Food & other Products": [
      "Edible Oil",
      "Sugar",
      "Tea & Coffee",
      "Other Agricultural Products",
    ],
    "Agricultural, Commercial & Construction Vehicles": [
      "Tractors",
      "Commercial Vehicles",
      "Construction Vehicles",
      "Dealers – Commercial Vehicles, Tractors, Construction Vehicles",
    ],
    "Auto Components": [
      "Auto Components & Equipments",
      "Tyres & Rubber Products",
      "Trading - Auto Components",
    ],
    Automobiles: [
      "Passenger Cars & Utility Vehicles",
      "2/3 Wheelers",
      "Auto Dealer",
    ],
    Banks: ["Public Sector Bank", "Private Sector Bank", "Other Bank"],
    Beverages: ["Breweries & Distilleries", "Other Beverages"],
    "Capital Markets": [
      "Asset Management Company",
      "Depositories, Clearing Houses and Other Intermediaries",
      "Financial Products Distributor",
      "Ratings",
      "Exchange and Data Platform",
      "Stockbroking & Allied",
      "Other Capital Market related Services",
    ],
    "Cement & Cement Products": ["Cement & Cement Products"],
    "Chemicals & Petrochemicals": [
      "Commodity Chemicals",
      "Specialty Chemicals",
      "Carbon Black",
      "Dyes And Pigments",
      "Explosives",
      "Petrochemicals",
      "Printing Inks",
      "Trading - Chemicals",
      "Industrial Gases",
    ],
    "Cigarettes & Tobacco Products": ["Cigarettes & Tobacco Products"],
    "Commercial Services & Supplies": [
      "Trading & Distributors",
      "Consulting Services",
      "Data Processing Services",
      "Diversified Commercial Services",
      "Business Process Outsourcing (BPO)/ Knowledge Process Outsourcing (KPO)",
    ],
    Construction: ["Civil Construction"],
    "Consumable Fuels": ["Coal", "Trading - Coal"],
    "Consumer Durables": [
      "Cycles",
      "Consumer Electronics",
      "Furniture, Home Furnishing",
      "Ceramics",
      "Granites & Marbles",
      "Gems, Jewellery And Watches",
      "Glass - Consumer",
      "Household Appliances",
      "Houseware",
      "Leather And Leather Products",
      "Leisure Products",
      "Plastic Products - Consumer",
      "Plywood Boards/Laminates",
      "Sanitary Ware",
      "Paints",
      "Diversified consumer products",
      "Footwear",
    ],
    Diversified: ["Diversified"],
    "Diversified FMCG": ["Diversified FMCG"],
    "Diversified Metals": ["Diversified Metals"],
    "Electrical Equipment": [
      "Heavy Electrical Equipment",
      "Other Electrical Equipment",
    ],
    "Engineering Services": ["Engineering & Designing Related Services"],
    Entertainment: [
      "Film Production, Distribution & Exhibition",
      "Gaming",
      "Digital Entertainment",
      "Other Media & Entertainment",
    ],
    "Ferrous Metals": [
      "Pig Iron",
      "Sponge Iron",
      "Iron & Steel Products",
      "Ferro & Silica Manganese",
      "Seamless Pipes",
      "Steel Pipes & Tubes",
      "Castings & Forgings",
      "Fasteners",
    ],
    "Fertilizers & Agrochemicals": [
      "Fertilizers",
      "Pesticides & Agrochemicals",
    ],
    Finance: [
      "Investment Company",
      "Non Banking Financial Company (NBFC)",
      "Housing Finance Company",
      "Financial Institution",
      "Holding Company",
      "Microfinance Institutions",
      "Infrastructure Finance Company",
      "Core Investment Company",
      "Other Financial Services",
    ],
    "Financial Technology (Fintech)": ["Financial Technology (Fintech)"],
    "Food Products": [
      "Dairy Products",
      "Packaged Foods",
      "Meat Products including Poultry",
      "Seafood",
      "Other Food Products",
    ],
    Gas: ["LPG/CNG/PNG/LNG Supplier", "City Gas Distribution", "Trading - Gas"],
    "Healthcare Equipment & Supplies": ["Medical Equipment & Supplies"],
    "Healthcare Services": [
      "Hospital",
      "Healthcare Service Provider",
      "Pharmacy Retail",
      "Diagnostic Services",
    ],
    "Household Products": ["Detergents & Soaps", "Other Household Products"],
    "Industrial Manufacturing": [
      "Plastic Products - Industrial",
      "Industrial Products",
      "Abrasives",
      "Packaging",
      "Glass - Industrial",
      "Industrial Minerals",
      "Trading - Minerals",
      "Stationery",
      "Rubber Products",
      "Refractories",
      "Other Industrial Products",
    ],
    "Industrial Products": [
      "Castings & Forgings - Industrial",
      "Pumps & Compressors",
      "Bearings",
      "Gears",
      "Boilers & Turbines",
      "Pollution Control Equipment",
      "Cutting Tools",
      "Welding Machinery",
      "Electrical Components & Equipments",
      "Industrial Machinery",
      "Other Industrial Machinery",
    ],
    Insurance: [
      "Life Insurance",
      "General Insurance",
      "Insurance Brokers",
      "Other Insurance",
    ],
    "IT - Hardware": ["Computer Hardware & Equipments"],
    "IT - Services": [
      "IT Enabled Services",
      "Internet & Web Application Services",
      "E-Commerce",
      "Other IT Services",
    ],
    "IT - Software": [
      "Computers - Software & Consulting",
      "Fintech Software",
      "Enterprise Software",
      "SaaS / Cloud Software",
    ],
    "Leisure Services": [
      "Hotels & Resorts",
      "Restaurants",
      "Tour, Travel Related Services",
      "Casinos & Gaming",
      "Amusement Parks/ Other Recreation",
      "Cruise Lines",
    ],
    Media: ["Electronic Media", "Print Media", "Media Content Distribution"],
    "Metals & Minerals Trading": ["Trading - Metals", "Trading - Minerals"],
    "Minerals & Mining": [
      "Iron Ore",
      "Precious Metals",
      "Industrial Minerals",
      "Copper Ore",
      "Other Minerals",
    ],
    "Non - Ferrous Metals": [
      "Aluminium",
      "Aluminium, Copper & Zinc Products",
      "Zinc",
      "Copper",
      "Lead",
      "Other Non Ferrous Metals",
    ],
    Oil: ["Oil Exploration & Production", "Integrated Oil & Gas"],
    "Other Construction Materials": [
      "Aggregates",
      "Bricks",
      "Cement Products",
      "Ready Mix Concrete",
      "Other Construction Material",
    ],
    "Other Consumer Services": [
      "Education",
      "Beauty & Wellness",
      "Funeral Services",
      "Laundry & Drycleaning",
      "Other Consumer Services",
    ],
    "Other Utilities": ["Water Supply & Management", "Waste Management"],
    "Paper, Forest & Jute Products": [
      "Paper & Paper Products",
      "Forest Products",
      "Jute & Jute Products",
    ],
    "Personal Products": ["Personal Care", "Cosmetics & Toiletries"],
    "Petroleum Products": [
      "Refineries & Marketing",
      "Lubricants",
      "Petrochemicals Trading",
    ],
    "Pharmaceuticals & Biotechnology": [
      "Pharmaceuticals",
      "Biotechnology",
      "Active Pharmaceutical Ingredients (API)",
      "Formulations",
    ],
    Power: [
      "Power Generation",
      "Power Transmission",
      "Power Distribution",
      "Power Trading",
      "Renewable Energy",
    ],
    "Printing & Publication": ["Commercial Printing", "Publication"],
    Realty: [
      "Real Estate Developer",
      "Residential, Commercial Projects",
      "Real Estate Services",
    ],
    Retailing: [
      "Department Stores",
      "Discount Stores",
      "Specialty Retail",
      "Online Marketplace",
      "Apparel Retail",
      "Food & Grocery Retail",
    ],
    "Telecom - Equipment & Accessories": [
      "Telecom Equipment & Accessories",
      "Cables - Optical Fiber",
    ],
    "Telecom - Services": [
      "Telecom - Cellular & Fixed line services",
      "Telecom - Infrastructure",
      "Tower Companies",
    ],
    "Textiles & Apparels": [
      "Garments & Apparels",
      "Other Textile Products",
      "Trading - Textile Products",
      "Spinning & Weaving",
    ],
    "Transport Infrastructure": [
      "Airport & Airport services",
      "Port & Port services",
      "Road Assets–Toll, Annuity, Hybrid-Annuity",
    ],
    "Transport Services": [
      "Airline",
      "Logistic Solution Provider",
      "Railways",
      "Road Transport",
      "Shipping",
      "Transport Related Services",
    ],
  };

export const ALL_NSE_INDUSTRIES: readonly string[] = Array.from(
  new Set(Object.values(SECTOR_INDUSTRIES).flat()),
).sort((a, b) => a.localeCompare(b));

export function getIndustriesForSectors(sectors: readonly string[]): string[] {
  if (sectors.length === 0) {
    return [...ALL_NSE_INDUSTRIES];
  }

  const industries = new Set<string>();
  for (const sector of sectors) {
    for (const industry of SECTOR_INDUSTRIES[sector as NseSector] ?? []) {
      industries.add(industry);
    }
  }

  return [...industries].sort((a, b) => a.localeCompare(b));
}

/**
 * Mapping from underlying provider/database industries to canonical NSE Sector and NSE Industry.
 */
export const YAHOO_INDUSTRY_TO_NSE: Record<
  string,
  { readonly sector: NseSector; readonly industry: string }
> = {
  "Aerospace & Defense": { sector: "Aerospace & Defense", industry: "Aerospace & Defense" },
  "Agricultural Inputs": { sector: "Fertilizers & Agrochemicals", industry: "Pesticides & Agrochemicals" },
  "Airlines": { sector: "Transport Services", industry: "Airline" },
  "Airports & Air Services": { sector: "Transport Infrastructure", industry: "Airport & Airport services" },
  "Aluminum": { sector: "Non - Ferrous Metals", industry: "Aluminium" },
  "Apparel Manufacturing": { sector: "Textiles & Apparels", industry: "Garments & Apparels" },
  "Apparel Retail": { sector: "Retailing", industry: "Apparel Retail" },
  "Asset Management": { sector: "Capital Markets", industry: "Asset Management Company" },
  "Auto & Truck Dealerships": { sector: "Automobiles", industry: "Auto Dealer" },
  "Auto Manufacturers": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "Auto Parts": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "Banks - Regional": { sector: "Banks", industry: "Private Sector Bank" },
  "Beverages - Brewers": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "Beverages - Non-Alcoholic": { sector: "Beverages", industry: "Other Beverages" },
  "Beverages - Wineries & Distilleries": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "Biotechnology": { sector: "Pharmaceuticals & Biotechnology", industry: "Biotechnology" },
  "Broadcasting": { sector: "Media", industry: "Electronic Media" },
  "Building Materials": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "Building Products & Equipment": { sector: "Other Construction Materials", industry: "Other Construction Material" },
  "Business Equipment & Supplies": { sector: "Commercial Services & Supplies", industry: "Diversified Commercial Services" },
  "Capital Markets": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "Chemicals": { sector: "Chemicals & Petrochemicals", industry: "Commodity Chemicals" },
  "Coking Coal": { sector: "Consumable Fuels", industry: "Coal" },
  "Communication Equipment": { sector: "Telecom - Equipment & Accessories", industry: "Telecom Equipment & Accessories" },
  "Computer Hardware": { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" },
  "Confectioners": { sector: "Food Products", industry: "Packaged Foods" },
  "Conglomerates": { sector: "Diversified", industry: "Diversified" },
  "Consulting Services": { sector: "Commercial Services & Supplies", industry: "Consulting Services" },
  "Consumer Electronics": { sector: "Consumer Durables", industry: "Consumer Electronics" },
  "Copper": { sector: "Non - Ferrous Metals", industry: "Copper" },
  "Credit Services": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "Department Stores": { sector: "Retailing", industry: "Department Stores" },
  "Diagnostics & Research": { sector: "Healthcare Services", industry: "Diagnostic Services" },
  "Discount Stores": { sector: "Retailing", industry: "Discount Stores" },
  "Drug Manufacturers - General": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "Drug Manufacturers - Specialty & Generic": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "Education & Training Services": { sector: "Other Consumer Services", industry: "Education" },
  "Electrical Equipment & Parts": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "Electronic Components": { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" },
  "Electronic Gaming & Multimedia": { sector: "Entertainment", industry: "Gaming" },
  "Electronics & Computer Distribution": { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" },
  "Engineering & Construction": { sector: "Construction", industry: "Civil Construction" },
  "Entertainment": { sector: "Entertainment", industry: "Other Media & Entertainment" },
  "Farm & Heavy Construction Machinery": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Tractors" },
  "Farm Products": { sector: "Agricultural Food & other Products", industry: "Other Agricultural Products" },
  "Financial Conglomerates": { sector: "Finance", industry: "Financial Institution" },
  "Financial Data & Stock Exchanges": { sector: "Capital Markets", industry: "Exchange and Data Platform" },
  "Food Distribution": { sector: "Food Products", industry: "Packaged Foods" },
  "Footwear & Accessories": { sector: "Consumer Durables", industry: "Footwear" },
  "Furnishings, Fixtures & Appliances": { sector: "Consumer Durables", industry: "Household Appliances" },
  "Gold": { sector: "Minerals & Mining", industry: "Precious Metals" },
  "Grocery Stores": { sector: "Retailing", industry: "Food & Grocery Retail" },
  "Health Information Services": { sector: "Healthcare Services", industry: "Healthcare Service Provider" },
  "Healthcare Plans": { sector: "Insurance", industry: "General Insurance" },
  "Home Improvement Retail": { sector: "Retailing", industry: "Specialty Retail" },
  "Household & Personal Products": { sector: "Household Products", industry: "Other Household Products" },
  "Industrial Distribution": { sector: "Commercial Services & Supplies", industry: "Trading & Distributors" },
  "Information Technology Services": { sector: "IT - Services", industry: "IT Enabled Services" },
  "Infrastructure Operations": { sector: "Transport Infrastructure", industry: "Road Assets–Toll, Annuity, Hybrid-Annuity" },
  "Insurance - Diversified": { sector: "Insurance", industry: "Other Insurance" },
  "Insurance - Life": { sector: "Insurance", industry: "Life Insurance" },
  "Insurance - Property & Casualty": { sector: "Insurance", industry: "General Insurance" },
  "Insurance - Reinsurance": { sector: "Insurance", industry: "Other Insurance" },
  "Insurance Brokers": { sector: "Insurance", industry: "Insurance Brokers" },
  "Integrated Freight & Logistics": { sector: "Transport Services", industry: "Logistic Solution Provider" },
  "Internet Content & Information": { sector: "Media", industry: "Electronic Media" },
  "Internet Retail": { sector: "Retailing", industry: "Online Marketplace" },
  "Leisure": { sector: "Leisure Services", industry: "Amusement Parks/ Other Recreation" },
  "Lodging": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "Lumber & Wood Production": { sector: "Paper, Forest & Jute Products", industry: "Forest Products" },
  "Luxury Goods": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "Marine Shipping": { sector: "Transport Services", industry: "Shipping" },
  "Medical Care Facilities": { sector: "Healthcare Services", industry: "Hospital" },
  "Medical Devices": { sector: "Healthcare Equipment & Supplies", industry: "Medical Equipment & Supplies" },
  "Medical Distribution": { sector: "Healthcare Services", industry: "Healthcare Service Provider" },
  "Medical Instruments & Supplies": { sector: "Healthcare Equipment & Supplies", industry: "Medical Equipment & Supplies" },
  "Metal Fabrication": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "Mortgage Finance": { sector: "Finance", industry: "Housing Finance Company" },
  "Oil & Gas Drilling": { sector: "Oil", industry: "Oil Exploration & Production" },
  "Oil & Gas E&P": { sector: "Oil", industry: "Oil Exploration & Production" },
  "Oil & Gas Equipment & Services": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "Oil & Gas Integrated": { sector: "Oil", industry: "Integrated Oil & Gas" },
  "Oil & Gas Refining & Marketing": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "Other Industrial Metals & Mining": { sector: "Non - Ferrous Metals", industry: "Other Non Ferrous Metals" },
  "Other Precious Metals & Mining": { sector: "Minerals & Mining", industry: "Precious Metals" },
  "Packaged Foods": { sector: "Food Products", industry: "Packaged Foods" },
  "Packaging & Containers": { sector: "Industrial Manufacturing", industry: "Packaging" },
  "Paper & Paper Products": { sector: "Paper, Forest & Jute Products", industry: "Paper & Paper Products" },
  "Personal Services": { sector: "Other Consumer Services", industry: "Other Consumer Services" },
  "Pharmaceutical Retailers": { sector: "Healthcare Services", industry: "Pharmacy Retail" },
  "Pollution & Treatment Controls": { sector: "Industrial Products", industry: "Pollution Control Equipment" },
  "Publishing": { sector: "Printing & Publication", industry: "Publication" },
  "Railroads": { sector: "Transport Services", industry: "Railways" },
  "Real Estate - Development": { sector: "Realty", industry: "Real Estate Developer" },
  "Real Estate - Diversified": { sector: "Realty", industry: "Residential, Commercial Projects" },
  "Real Estate Services": { sector: "Realty", industry: "Real Estate Services" },
  "Rental & Leasing Services": { sector: "Commercial Services & Supplies", industry: "Diversified Commercial Services" },
  "Residential Construction": { sector: "Construction", industry: "Civil Construction" },
  "Resorts & Casinos": { sector: "Leisure Services", industry: "Casinos & Gaming" },
  "Restaurants": { sector: "Leisure Services", industry: "Restaurants" },
  "Scientific & Technical Instruments": { sector: "Industrial Products", industry: "Cutting Tools" },
  "Security & Protection Services": { sector: "Commercial Services & Supplies", industry: "Diversified Commercial Services" },
  "Semiconductor Equipment & Materials": { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" },
  "Semiconductors": { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" },
  "Shell Companies": { sector: "Finance", industry: "Holding Company" },
  "Software - Application": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "Software - Infrastructure": { sector: "IT - Software", industry: "Enterprise Software" },
  "Solar": { sector: "Power", industry: "Renewable Energy" },
  "Specialty Business Services": { sector: "Commercial Services & Supplies", industry: "Business Process Outsourcing (BPO)/ Knowledge Process Outsourcing (KPO)" },
  "Specialty Chemicals": { sector: "Chemicals & Petrochemicals", industry: "Specialty Chemicals" },
  "Specialty Industrial Machinery": { sector: "Industrial Products", industry: "Industrial Machinery" },
  "Specialty Retail": { sector: "Retailing", industry: "Specialty Retail" },
  "Staffing & Employment Services": { sector: "Commercial Services & Supplies", industry: "Diversified Commercial Services" },
  "Steel": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "Telecom Services": { sector: "Telecom - Services", industry: "Telecom - Cellular & Fixed line services" },
  "Textile Manufacturing": { sector: "Textiles & Apparels", industry: "Other Textile Products" },
  "Thermal Coal": { sector: "Consumable Fuels", industry: "Coal" },
  "Tobacco": { sector: "Cigarettes & Tobacco Products", industry: "Cigarettes & Tobacco Products" },
  "Tools & Accessories": { sector: "Industrial Products", industry: "Cutting Tools" },
  "Travel Services": { sector: "Leisure Services", industry: "Tour, Travel Related Services" },
  "Trucking": { sector: "Transport Services", industry: "Road Transport" },
  "Utilities - Independent Power Producers": { sector: "Power", industry: "Power Generation" },
  "Utilities - Regulated Electric": { sector: "Power", industry: "Power Distribution" },
  "Utilities - Regulated Gas": { sector: "Gas", industry: "City Gas Distribution" },
  "Utilities - Regulated Water": { sector: "Other Utilities", industry: "Water Supply & Management" },
  "Utilities - Renewable": { sector: "Power", industry: "Renewable Energy" },
  "Waste Management": { sector: "Other Utilities", industry: "Waste Management" },
};

/**
 * Known specific high-precision stock classifications (Indian major stocks).
 */
export const KNOWN_STOCK_NSE_CLASSIFICATION: Record<
  string,
  { readonly sector: NseSector; readonly industry: string }
> = {
  // Automobiles - 2/3 Wheelers
  "BAJAJ-AUTO": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "HEROMOTOCO": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "TVSMOTOR": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "EICHERMOT": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "ATULAUTO": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "WARDWIZARD": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "OLAELEC": { sector: "Automobiles", industry: "2/3 Wheelers" },
  "SCOOTERS": { sector: "Automobiles", industry: "2/3 Wheelers" },

  // Automobiles - Passenger Cars
  "MARUTI": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "TMPV": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "TATAMOTORS": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "HYUNDAI": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "M&M": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "FORCEIND": { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" },
  "CARTRADE": { sector: "Automobiles", industry: "Auto Dealer" },

  // Commercial Vehicles & Tractors
  "ASHOKLEY": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" },
  "SMLISUZU": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" },
  "SMLMAH": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" },
  "OLECTRA": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" },
  "JBMMA": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" },
  "ESCORTS": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Tractors" },
  "VSTTILLERS": { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Tractors" },

  // Tyres & Auto Components
  "MRF": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "APOLLOTYRE": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "BALKRISIND": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "CEATLTD": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "JKTYRE": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "TVSSRICHAK": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "GOODYEAR": { sector: "Auto Components", industry: "Tyres & Rubber Products" },
  "BOSCHLTD": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "MOTHERSON": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "BHARATFORG": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "UNOMINDA": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "SONACOMS": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "ENDURANCE": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "SUNDRMFAST": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "CIEINDIA": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "SCHAEFFLER": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "SKFINDIA": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "TIMKEN": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "SUPRAJIT": { sector: "Auto Components", industry: "Auto Components & Equipments" },
  "LUMAXTECH": { sector: "Auto Components", industry: "Auto Components & Equipments" },

  // Public Sector Banks
  "SBIN": { sector: "Banks", industry: "Public Sector Bank" },
  "PNB": { sector: "Banks", industry: "Public Sector Bank" },
  "BANKBARODA": { sector: "Banks", industry: "Public Sector Bank" },
  "CANBK": { sector: "Banks", industry: "Public Sector Bank" },
  "UNIONBANK": { sector: "Banks", industry: "Public Sector Bank" },
  "INDIANB": { sector: "Banks", industry: "Public Sector Bank" },
  "BANKINDIA": { sector: "Banks", industry: "Public Sector Bank" },
  "IOB": { sector: "Banks", industry: "Public Sector Bank" },
  "CENTRALBK": { sector: "Banks", industry: "Public Sector Bank" },
  "MAHABANK": { sector: "Banks", industry: "Public Sector Bank" },
  "UCOBANK": { sector: "Banks", industry: "Public Sector Bank" },
  "PSB": { sector: "Banks", industry: "Public Sector Bank" },

  // Private Sector Banks
  "HDFCBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "ICICIBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "KOTAKBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "AXISBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "INDUSINDBK": { sector: "Banks", industry: "Private Sector Bank" },
  "FEDERALBNK": { sector: "Banks", industry: "Private Sector Bank" },
  "IDFCFIRSTB": { sector: "Banks", industry: "Private Sector Bank" },
  "BANDHANBNK": { sector: "Banks", industry: "Private Sector Bank" },
  "RBLBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "AUBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "CSBBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "DCBBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "SOUTHBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "KARURVYSYA": { sector: "Banks", industry: "Private Sector Bank" },
  "J&KBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "CITYUNIONB": { sector: "Banks", industry: "Private Sector Bank" },
  "TMB": { sector: "Banks", industry: "Private Sector Bank" },
  "CAPITALSFB": { sector: "Banks", industry: "Private Sector Bank" },
  "DHANBANK": { sector: "Banks", industry: "Private Sector Bank" },
  "UTKARSHBNK": { sector: "Banks", industry: "Private Sector Bank" },
  "UJJIVANSFB": { sector: "Banks", industry: "Private Sector Bank" },
  "ESAFSFB": { sector: "Banks", industry: "Private Sector Bank" },
  "SURYODAY": { sector: "Banks", industry: "Private Sector Bank" },

  // Finance & Housing Finance
  "HUDCO": { sector: "Finance", industry: "Housing Finance Company" },
  "LICHSGFIN": { sector: "Finance", industry: "Housing Finance Company" },
  "PNBHOUSING": { sector: "Finance", industry: "Housing Finance Company" },
  "CANFINHOME": { sector: "Finance", industry: "Housing Finance Company" },
  "HOMEFIRST": { sector: "Finance", industry: "Housing Finance Company" },
  "AAVAS": { sector: "Finance", industry: "Housing Finance Company" },
  "REPCOHOME": { sector: "Finance", industry: "Housing Finance Company" },
  "GICHSGFIN": { sector: "Finance", industry: "Housing Finance Company" },
  "APTUS": { sector: "Finance", industry: "Housing Finance Company" },
  "BAJFINANCE": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "BAJAJFINSV": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "CHOLAFIN": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "SHRIRAMFIN": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "MUTHOOTFIN": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "MANAPPURAM": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "M&MFIN": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "POONAWALLA": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "SUNDARMFIN": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "L&TFH": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "EDELWEISS": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "IIFL": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "PIRAMAL": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "SBICARD": { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" },
  "CREDITACC": { sector: "Finance", industry: "Microfinance Institutions" },
  "FUSION": { sector: "Finance", industry: "Microfinance Institutions" },
  "SPANDANA": { sector: "Finance", industry: "Microfinance Institutions" },
  "IREDA": { sector: "Finance", industry: "Infrastructure Finance Company" },
  "REC": { sector: "Finance", industry: "Infrastructure Finance Company" },
  "PFC": { sector: "Finance", industry: "Infrastructure Finance Company" },
  "IRFC": { sector: "Finance", industry: "Infrastructure Finance Company" },

  // Insurance
  "HDFCLIFE": { sector: "Insurance", industry: "Life Insurance" },
  "SBILIFE": { sector: "Insurance", industry: "Life Insurance" },
  "ICICIPRULI": { sector: "Insurance", industry: "Life Insurance" },
  "LICI": { sector: "Insurance", industry: "Life Insurance" },
  "MAXHEALTH": { sector: "Healthcare Services", industry: "Hospital" },
  "ICICIGI": { sector: "Insurance", industry: "General Insurance" },
  "NIACL": { sector: "Insurance", industry: "General Insurance" },
  "GICRE": { sector: "Insurance", industry: "General Insurance" },
  "STARHEALTH": { sector: "Insurance", industry: "General Insurance" },
  "POLICYBZR": { sector: "Insurance", industry: "Insurance Brokers" },

  // Capital Markets
  "BSE": { sector: "Capital Markets", industry: "Exchange and Data Platform" },
  "MCX": { sector: "Capital Markets", industry: "Exchange and Data Platform" },
  "IEX": { sector: "Capital Markets", industry: "Exchange and Data Platform" },
  "CDSL": { sector: "Capital Markets", industry: "Depositories, Clearing Houses and Other Intermediaries" },
  "CAMS": { sector: "Capital Markets", industry: "Depositories, Clearing Houses and Other Intermediaries" },
  "KFINTECH": { sector: "Capital Markets", industry: "Depositories, Clearing Houses and Other Intermediaries" },
  "ANGELONE": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "MOTILALOFS": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "ICICISECU": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "5PAISA": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "GEOJITFSL": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "SMCGLOBAL": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "SHAREINDIA": { sector: "Capital Markets", industry: "Stockbroking & Allied" },
  "HDFCAMC": { sector: "Capital Markets", industry: "Asset Management Company" },
  "NAM-INDIA": { sector: "Capital Markets", industry: "Asset Management Company" },
  "UTIAMC": { sector: "Capital Markets", industry: "Asset Management Company" },
  "ABSLAMC": { sector: "Capital Markets", industry: "Asset Management Company" },
  "CRISIL": { sector: "Capital Markets", industry: "Ratings" },
  "ICRA": { sector: "Capital Markets", industry: "Ratings" },
  "CAREERP": { sector: "Capital Markets", industry: "Ratings" },

  // Consumer Durables (Paints, Jewellery, Footwear, Electronics)
  "ASIANPAINT": { sector: "Consumer Durables", industry: "Paints" },
  "BERGEPAINT": { sector: "Consumer Durables", industry: "Paints" },
  "KANSAINER": { sector: "Consumer Durables", industry: "Paints" },
  "AKZOINDIA": { sector: "Consumer Durables", industry: "Paints" },
  "SHALPAINTS": { sector: "Consumer Durables", industry: "Paints" },
  "INDIGOPNTS": { sector: "Consumer Durables", industry: "Paints" },
  "SIRCA": { sector: "Consumer Durables", industry: "Paints" },
  "TITAN": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "KALYANKJIL": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "SENCO": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "PCJEWELLER": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "RAJESHEXPO": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "THANGAMAYL": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "GOLDIAM": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "VAIBHAVGBL": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "TBZ": { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" },
  "BATAINDIA": { sector: "Consumer Durables", industry: "Footwear" },
  "RELAXO": { sector: "Consumer Durables", industry: "Footwear" },
  "CAMPUS": { sector: "Consumer Durables", industry: "Footwear" },
  "METRO": { sector: "Consumer Durables", industry: "Footwear" },
  "MIRZAINT": { sector: "Consumer Durables", industry: "Footwear" },
  "LIBERTSHOE": { sector: "Consumer Durables", industry: "Footwear" },
  "KHADIM": { sector: "Consumer Durables", industry: "Footwear" },
  "HAVELLS": { sector: "Consumer Durables", industry: "Household Appliances" },
  "VOLTAS": { sector: "Consumer Durables", industry: "Household Appliances" },
  "BLUESTARCO": { sector: "Consumer Durables", industry: "Household Appliances" },
  "CROMPTON": { sector: "Consumer Durables", industry: "Household Appliances" },
  "WHIRLPOOL": { sector: "Consumer Durables", industry: "Household Appliances" },
  "SYMPHONY": { sector: "Consumer Durables", industry: "Household Appliances" },
  "ORIENTELEC": { sector: "Consumer Durables", industry: "Household Appliances" },
  "BAJAJELEC": { sector: "Consumer Durables", industry: "Household Appliances" },
  "TTKPRESTIG": { sector: "Consumer Durables", industry: "Household Appliances" },
  "BUTTERFLY": { sector: "Consumer Durables", industry: "Household Appliances" },
  "KAJARIACER": { sector: "Consumer Durables", industry: "Ceramics" },
  "CERA": { sector: "Consumer Durables", industry: "Sanitary Ware" },
  "SOMANYCERA": { sector: "Consumer Durables", industry: "Ceramics" },
  "CENTURYPLY": { sector: "Consumer Durables", industry: "Plywood Boards/Laminates" },
  "GREENPANEL": { sector: "Consumer Durables", industry: "Plywood Boards/Laminates" },
  "GREENLAM": { sector: "Consumer Durables", industry: "Plywood Boards/Laminates" },

  // Food Products, Sugar, Tea & Edible Oil
  "BALRAMCHIN": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "TRIVENI": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "RENUKA": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "EIDPARRY": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "DHAMPURSUG": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "DWARIKESH": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "AVADHSUGAR": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "UTTAMSUGAR": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "MAGADSUGAR": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "KMCSUGAR": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "BANARISUG": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "DALMIASUG": { sector: "Agricultural Food & other Products", industry: "Sugar" },
  "TATACONSUM": { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" },
  "CCL": { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" },
  "ROSSELLIND": { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" },
  "MCLEODRUSS": { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" },
  "JAYAGRO": { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" },
  "AWL": { sector: "Agricultural Food & other Products", industry: "Edible Oil" },
  "PATANJALI": { sector: "Agricultural Food & other Products", industry: "Edible Oil" },
  "MARICO": { sector: "Personal Products", industry: "Personal Care" },
  "GOKULAGRO": { sector: "Agricultural Food & other Products", industry: "Edible Oil" },
  "KRBL": { sector: "Food Products", industry: "Other Food Products" },
  "NESTLEIND": { sector: "Food Products", industry: "Packaged Foods" },
  "BRITANNIA": { sector: "Food Products", industry: "Packaged Foods" },
  "HATSUN": { sector: "Food Products", industry: "Dairy Products" },
  "DODLA": { sector: "Food Products", industry: "Dairy Products" },
  "HERITGFOOD": { sector: "Food Products", industry: "Dairy Products" },
  "PARAGMILK": { sector: "Food Products", industry: "Dairy Products" },
  "BIKAJI": { sector: "Food Products", industry: "Packaged Foods" },
  "PRATAAP": { sector: "Food Products", industry: "Packaged Foods" },
  "ITC": { sector: "Cigarettes & Tobacco Products", industry: "Cigarettes & Tobacco Products" },
  "GODFRYPHLP": { sector: "Cigarettes & Tobacco Products", industry: "Cigarettes & Tobacco Products" },
  "VSTIND": { sector: "Cigarettes & Tobacco Products", industry: "Cigarettes & Tobacco Products" },

  // Beverages
  "UBL": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "MCDOWELL-N": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "RADICO": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "TI": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "SULA": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "GLOBUSSPR": { sector: "Beverages", industry: "Breweries & Distilleries" },
  "VBL": { sector: "Beverages", industry: "Other Beverages" },

  // Cement
  "ULTRACEMCO": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "AMBUJACEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "ACC": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "SHREECEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "DALBHARAT": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "JKCEMENT": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "RAMCOCEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "BIRLACORPN": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "PRISMJOHN": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "STARCEMENT": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "INDIACEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "HEIDELBERG": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "SAGCEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },
  "ORIENTCEM": { sector: "Cement & Cement Products", industry: "Cement & Cement Products" },

  // Steel & Metals
  "TATASTEEL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "JSWSTEEL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "JINDALSTEL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "SAIL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "JSL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "APLAPOLLO": { sector: "Ferrous Metals", industry: "Steel Pipes & Tubes" },
  "RATNAMANI": { sector: "Ferrous Metals", industry: "Steel Pipes & Tubes" },
  "WELCORP": { sector: "Ferrous Metals", industry: "Steel Pipes & Tubes" },
  "JINDALSAW": { sector: "Ferrous Metals", industry: "Steel Pipes & Tubes" },
  "KALYANISTEELS": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "SHYAMMETL": { sector: "Ferrous Metals", industry: "Iron & Steel Products" },
  "HINDALCO": { sector: "Non - Ferrous Metals", industry: "Aluminium" },
  "NATIONALUM": { sector: "Non - Ferrous Metals", industry: "Aluminium" },
  "VEDL": { sector: "Diversified Metals", industry: "Diversified Metals" },
  "HINDZINC": { sector: "Non - Ferrous Metals", industry: "Zinc" },
  "HINDCOPPER": { sector: "Non - Ferrous Metals", industry: "Copper" },
  "NMDC": { sector: "Minerals & Mining", industry: "Iron Ore" },
  "COALINDIA": { sector: "Consumable Fuels", industry: "Coal" },
  "MOIL": { sector: "Minerals & Mining", industry: "Other Minerals" },

  // Cables & Electrical
  "POLYCAB": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "KEI": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "RRKABEL": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "FINCABLES": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "APARINDS": { sector: "Electrical Equipment", industry: "Other Electrical Equipment" },
  "BHEL": { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" },
  "SIEMENS": { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" },
  "ABB": { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" },
  "SUZLON": { sector: "Power", industry: "Renewable Energy" },
  "INOXWIND": { sector: "Power", industry: "Renewable Energy" },
  "THERMAX": { sector: "Industrial Products", industry: "Boilers & Turbines" },
  "TRITURBINE": { sector: "Industrial Products", industry: "Boilers & Turbines" },
  "POWERINDIA": { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" },
  "SCHNEIDER": { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" },

  // IT - Software & Services
  "TCS": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "INFY": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "WIPRO": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "HCLTECH": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "TECHM": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "LTIM": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "PERSISTENT": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "COFORGE": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "LTTS": { sector: "Engineering Services", industry: "Engineering & Designing Related Services" },
  "MPHASIS": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "KPITTECH": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "TATAELXSI": { sector: "Engineering Services", industry: "Engineering & Designing Related Services" },
  "CYIENT": { sector: "Engineering Services", industry: "Engineering & Designing Related Services" },
  "ZENSARTECH": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "SONATSOFTW": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "BIRLASOFT": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "HAPPSTMNDS": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "INTELLECT": { sector: "IT - Software", industry: "Fintech Software" },
  "BSOFT": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "ECLERX": { sector: "IT - Services", industry: "IT Enabled Services" },
  "FIRSTSOURC": { sector: "IT - Services", industry: "IT Enabled Services" },
  "MASTEK": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "NEWGEN": { sector: "IT - Software", industry: "Enterprise Software" },
  "SUBEXLTD": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "FRACTAL": { sector: "IT - Software", industry: "Enterprise Software" },
  "EMUDHRA": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "CALSOFT": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "XTGLOBAL": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "NAZARA": { sector: "Entertainment", industry: "Gaming" },
  "TANLA": { sector: "Telecom - Services", industry: "Telecom - Cellular & Fixed line services" },
  "ROUTE": { sector: "Telecom - Services", industry: "Telecom - Cellular & Fixed line services" },
  "AFFLE": { sector: "IT - Services", industry: "Internet & Web Application Services" },
  "MAPMYINDIA": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "CEINFO": { sector: "IT - Software", industry: "Computers - Software & Consulting" },
  "ZOMATO": { sector: "Retailing", industry: "Online Marketplace" },
  "SWIGGY": { sector: "Retailing", industry: "Online Marketplace" },
  "NYKAA": { sector: "Retailing", industry: "Online Marketplace" },
  "DELHIVERY": { sector: "Transport Services", industry: "Logistic Solution Provider" },

  // Oil, Gas & Petrochemicals
  "RELIANCE": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "ONGC": { sector: "Oil", industry: "Oil Exploration & Production" },
  "IOC": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "BPCL": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "HPCL": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "MRPL": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "CHENNPETRO": { sector: "Petroleum Products", industry: "Refineries & Marketing" },
  "GAIL": { sector: "Gas", industry: "City Gas Distribution" },
  "OIL": { sector: "Oil", industry: "Oil Exploration & Production" },
  "PETRONET": { sector: "Gas", industry: "LPG/CNG/PNG/LNG Supplier" },
  "GSPL": { sector: "Gas", industry: "City Gas Distribution" },
  "GUJGASLTD": { sector: "Gas", industry: "City Gas Distribution" },
  "IGL": { sector: "Gas", industry: "City Gas Distribution" },
  "MGL": { sector: "Gas", industry: "City Gas Distribution" },
  "ATGL": { sector: "Gas", industry: "City Gas Distribution" },

  // Pharma & Healthcare
  "SUNPHARMA": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "DRREDDY": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "CIPLA": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "DIVISLAB": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "LUPIN": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "TORNTPHARM": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "AUROPHARMA": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "ALKEM": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "ZYDUSLIFE": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "MANKIND": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "GLENMARK": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "BIOCON": { sector: "Pharmaceuticals & Biotechnology", industry: "Biotechnology" },
  "ABBOTINDIA": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "SANOFI": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "PFIZER": { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" },
  "IPCALAB": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "AJANTPHARM": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "NATCOPHARM": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "ERIS": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "GRANULES": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "JBCHEPHARM": { sector: "Pharmaceuticals & Biotechnology", industry: "Formulations" },
  "LAURUSLABS": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "SUVENPHAR": { sector: "Pharmaceuticals & Biotechnology", industry: "Active Pharmaceutical Ingredients (API)" },
  "APOLLOHOSP": { sector: "Healthcare Services", industry: "Hospital" },
  "FORTIS": { sector: "Healthcare Services", industry: "Hospital" },
  "MEDANTA": { sector: "Healthcare Services", industry: "Hospital" },
  "NH": { sector: "Healthcare Services", industry: "Hospital" },
  "RAINBOW": { sector: "Healthcare Services", industry: "Hospital" },
  "ASTERDM": { sector: "Healthcare Services", industry: "Hospital" },
  "YATHARTH": { sector: "Healthcare Services", industry: "Hospital" },
  "KIMS": { sector: "Healthcare Services", industry: "Hospital" },
  "JUPITER": { sector: "Healthcare Services", industry: "Hospital" },
  "ARTEMISMED": { sector: "Healthcare Services", industry: "Hospital" },
  "SHALBY": { sector: "Healthcare Services", industry: "Hospital" },
  "LALPATHLAB": { sector: "Healthcare Services", industry: "Diagnostic Services" },
  "METROPOLIS": { sector: "Healthcare Services", industry: "Diagnostic Services" },
  "THYROCARE": { sector: "Healthcare Services", industry: "Diagnostic Services" },
  "VIJAYA": { sector: "Healthcare Services", industry: "Diagnostic Services" },
  "KRSNAA": { sector: "Healthcare Services", industry: "Diagnostic Services" },

  // Realty & Infrastructure
  "DLF": { sector: "Realty", industry: "Real Estate Developer" },
  "GODREJPROP": { sector: "Realty", industry: "Real Estate Developer" },
  "OBEROIRLTY": { sector: "Realty", industry: "Real Estate Developer" },
  "LODHA": { sector: "Realty", industry: "Real Estate Developer" },
  "MACROTECH": { sector: "Realty", industry: "Real Estate Developer" },
  "PHOENIXLTD": { sector: "Realty", industry: "Real Estate Developer" },
  "PRESTIGE": { sector: "Realty", industry: "Real Estate Developer" },
  "BRIGADE": { sector: "Realty", industry: "Real Estate Developer" },
  "SOBHA": { sector: "Realty", industry: "Real Estate Developer" },
  "SIGNATURE": { sector: "Realty", industry: "Real Estate Developer" },
  "KOLTEPATIL": { sector: "Realty", industry: "Real Estate Developer" },
  "SUNTECK": { sector: "Realty", industry: "Real Estate Developer" },
  "AJMERA": { sector: "Realty", industry: "Real Estate Developer" },
  "PURVA": { sector: "Realty", industry: "Real Estate Developer" },
  "ASHIANA": { sector: "Realty", industry: "Real Estate Developer" },
  "NBCC": { sector: "Construction", industry: "Civil Construction" },
  "LT": { sector: "Construction", industry: "Civil Construction" },
  "GMRINFRA": { sector: "Transport Infrastructure", industry: "Airport & Airport services" },
  "ADANIENT": { sector: "Diversified", industry: "Diversified" },
  "ADANIPORTS": { sector: "Transport Infrastructure", industry: "Port & Port services" },

  // Hotels & Leisure
  "INDHOTEL": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "EIHOTEL": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "CHALET": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "LEMONTREE": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "TAJGVK": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "ROYALORCH": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "SAMHI": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "PRAVEG": { sector: "Leisure Services", industry: "Hotels & Resorts" },
  "JUBLFOOD": { sector: "Leisure Services", industry: "Restaurants" },
  "DEVYANI": { sector: "Leisure Services", industry: "Restaurants" },
  "WESTLIFE": { sector: "Leisure Services", industry: "Restaurants" },
  "SAPPHIRE": { sector: "Leisure Services", industry: "Restaurants" },
  "RBA": { sector: "Leisure Services", industry: "Restaurants" },
  "BARBEQUE": { sector: "Leisure Services", industry: "Restaurants" },
  "DELTA": { sector: "Leisure Services", industry: "Casinos & Gaming" },
  "DELTACORP": { sector: "Leisure Services", industry: "Casinos & Gaming" },

  // Power
  "NTPC": { sector: "Power", industry: "Power Generation" },
  "POWERGRID": { sector: "Power", industry: "Power Transmission" },
  "TATAPOWER": { sector: "Power", industry: "Power Generation" },
  "ADANIGREEN": { sector: "Power", industry: "Renewable Energy" },
  "ADANIPOWER": { sector: "Power", industry: "Power Generation" },
  "JSWENERGY": { sector: "Power", industry: "Power Generation" },
  "TORNTPOWER": { sector: "Power", industry: "Power Generation" },
  "NHPC": { sector: "Power", industry: "Power Generation" },
  "SJVN": { sector: "Power", industry: "Power Generation" },
  "CESC": { sector: "Power", industry: "Power Generation" },
  "WAAREEENER": { sector: "Power", industry: "Renewable Energy" },
  "PREMIERENE": { sector: "Power", industry: "Renewable Energy" },
  "BORORENEW": { sector: "Power", industry: "Renewable Energy" },
};

/**
 * Intelligent classifier that resolves any stock (symbol, name, existing DB tags) to canonical NSE Sector and NSE Industry.
 */
export function classifyStockToNse(stock: {
  readonly symbol: string;
  readonly name?: string | null;
  readonly industry?: string | null;
  readonly sector?: string | null;
}): { sector: string; industry: string } {
  const sym = stock.symbol ? stock.symbol.trim().toUpperCase() : "";
  const name = stock.name ? stock.name.trim().toLowerCase() : "";
  const dbInd = stock.industry && stock.industry !== "-" ? stock.industry.trim() : "";
  const dbSec = stock.sector && stock.sector !== "-" ? stock.sector.trim() : "";

  // ETFs are stored with sector "ETF"; the company-name keywords below would
  // otherwise file a gold ETF under jewellery and an IT ETF under software.
  if (dbSec === "ETF") {
    return { sector: "ETF", industry: "ETF" };
  }

  // 1. Direct symbol lookup
  if (sym && KNOWN_STOCK_NSE_CLASSIFICATION[sym]) {
    return KNOWN_STOCK_NSE_CLASSIFICATION[sym];
  }

  // 2. High-precision keyword analysis on company name
  if (name.includes("sugar") || name.includes("chini") || name.includes("renuka sugars")) {
    return { sector: "Agricultural Food & other Products", industry: "Sugar" };
  }
  if (name.includes("tea ") || name.includes("coffee") || name.includes("plantations") || name.includes(" tea")) {
    return { sector: "Agricultural Food & other Products", industry: "Tea & Coffee" };
  }
  if (name.includes("edible oil") || name.includes("vanaspati") || name.includes("solvent") || name.includes("soya")) {
    return { sector: "Agricultural Food & other Products", industry: "Edible Oil" };
  }

  // Auto & Vehicles
  if (
    name.includes("2 wheeler") ||
    name.includes("two wheeler") ||
    name.includes("scooter") ||
    name.includes("motorcycle") ||
    name.includes("bike") ||
    name.includes("bajaj auto") ||
    name.includes("hero moto") ||
    name.includes("tvs motor") ||
    name.includes("eicher") ||
    name.includes("ola electric") ||
    name.includes("wardwizard")
  ) {
    return { sector: "Automobiles", industry: "2/3 Wheelers" };
  }
  if (
    name.includes("ashok leyland") ||
    name.includes("commercial vehicle") ||
    name.includes("truck") ||
    name.includes("bus") ||
    name.includes("olectra") ||
    name.includes("sml isuzu")
  ) {
    return { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Commercial Vehicles" };
  }
  if (name.includes("tractor") || name.includes("tillers") || name.includes("escorts kubota")) {
    return { sector: "Agricultural, Commercial & Construction Vehicles", industry: "Tractors" };
  }
  if (name.includes("tyre") || name.includes("tyres") || name.includes("rubber") || name.includes("tubes")) {
    return { sector: "Auto Components", industry: "Tyres & Rubber Products" };
  }
  if (name.includes("auto parts") || name.includes("auto ancillary") || name.includes("ancillaries") || name.includes("axles") || name.includes("clutch") || name.includes("piston")) {
    return { sector: "Auto Components", industry: "Auto Components & Equipments" };
  }
  if (name.includes("motors") || name.includes("automobile") || name.includes("automotive")) {
    return { sector: "Automobiles", industry: "Passenger Cars & Utility Vehicles" };
  }

  // Banks
  if (
    name.includes("state bank") ||
    name.includes("punjab national") ||
    name.includes("bank of baroda") ||
    name.includes("canara bank") ||
    name.includes("union bank") ||
    name.includes("indian bank") ||
    name.includes("bank of india") ||
    name.includes("central bank") ||
    name.includes("uco bank") ||
    name.includes("maharashtra bank") ||
    name.includes("punjab & sind") ||
    name.includes("overseas bank")
  ) {
    return { sector: "Banks", industry: "Public Sector Bank" };
  }
  if (name.includes("bank") || name.includes("small finance")) {
    return { sector: "Banks", industry: "Private Sector Bank" };
  }

  // Finance
  if (name.includes("housing finance") || name.includes("home finance") || name.includes("grih")) {
    return { sector: "Finance", industry: "Housing Finance Company" };
  }
  if (name.includes("microfinance") || name.includes("micro finance")) {
    return { sector: "Finance", industry: "Microfinance Institutions" };
  }
  if (name.includes("insurance") || name.includes("life assurance")) {
    return { sector: "Insurance", industry: name.includes("life") ? "Life Insurance" : "General Insurance" };
  }
  if (name.includes("broking") || name.includes("securities") || name.includes("stock broking") || name.includes("share and stock")) {
    return { sector: "Capital Markets", industry: "Stockbroking & Allied" };
  }
  if (name.includes("finance") || name.includes("finvest") || name.includes("finlease") || name.includes("capital") || name.includes("credit") || name.includes("fincorp") || name.includes("leasing")) {
    return { sector: "Finance", industry: "Non Banking Financial Company (NBFC)" };
  }

  // Consumer Durables
  if (name.includes("paint") || name.includes("paints") || name.includes("coatings") || name.includes("varnish")) {
    return { sector: "Consumer Durables", industry: "Paints" };
  }
  if (name.includes("jewel") || name.includes("jewellers") || name.includes("jewellery") || name.includes("gold") || name.includes("gems") || name.includes("diamond") || name.includes("diamonds") || name.includes("watches") || name.includes("watch")) {
    return { sector: "Consumer Durables", industry: "Gems, Jewellery And Watches" };
  }
  if (name.includes("footwear") || name.includes("shoes") || name.includes("leather products")) {
    return { sector: "Consumer Durables", industry: "Footwear" };
  }
  if (name.includes("appliances") || name.includes("home appliances") || name.includes("kitchenware") || name.includes("cookware")) {
    return { sector: "Consumer Durables", industry: "Household Appliances" };
  }
  if (name.includes("ceramic") || name.includes("ceramics") || name.includes("tiles")) {
    return { sector: "Consumer Durables", industry: "Ceramics" };
  }
  if (name.includes("sanitary") || name.includes("sanitaryware")) {
    return { sector: "Consumer Durables", industry: "Sanitary Ware" };
  }
  if (name.includes("plywood") || name.includes("laminates") || name.includes("boards")) {
    return { sector: "Consumer Durables", industry: "Plywood Boards/Laminates" };
  }

  // Cement, Steel & Metals
  if (name.includes("cement") || name.includes("cements") || name.includes("concrete") || name.includes("rmc")) {
    return { sector: "Cement & Cement Products", industry: "Cement & Cement Products" };
  }
  if (name.includes("steel") || name.includes("iron") || name.includes("sponge iron") || name.includes("tmt") || name.includes("seamless pipes") || name.includes("tubes") || name.includes("pipes")) {
    return { sector: "Ferrous Metals", industry: "Iron & Steel Products" };
  }
  if (name.includes("aluminium") || name.includes("aluminum")) {
    return { sector: "Non - Ferrous Metals", industry: "Aluminium" };
  }
  if (name.includes("copper")) {
    return { sector: "Non - Ferrous Metals", industry: "Copper" };
  }
  if (name.includes("zinc")) {
    return { sector: "Non - Ferrous Metals", industry: "Zinc" };
  }

  // Cables & Electrical
  if (name.includes("cable") || name.includes("cables") || name.includes("wires") || name.includes("conductor") || name.includes("conductors") || name.includes("optical fiber")) {
    return { sector: "Electrical Equipment", industry: "Other Electrical Equipment" };
  }
  if (name.includes("transformer") || name.includes("switchgear") || name.includes("electrical")) {
    return { sector: "Electrical Equipment", industry: "Heavy Electrical Equipment" };
  }

  // Pharma & Healthcare
  if (name.includes("hospital") || name.includes("hospitals") || name.includes("medicare") || name.includes("healthcare services")) {
    return { sector: "Healthcare Services", industry: "Hospital" };
  }
  if (name.includes("diagnostic") || name.includes("pathology") || name.includes("diagnostics") || name.includes("lab ") || name.includes("labs")) {
    return { sector: "Healthcare Services", industry: "Diagnostic Services" };
  }
  if (name.includes("pharma") || name.includes("pharmaceutical") || name.includes("drugs") || name.includes("remedies") || name.includes("life sciences") || name.includes("lifesciences")) {
    return { sector: "Pharmaceuticals & Biotechnology", industry: "Pharmaceuticals" };
  }
  if (name.includes("biotech") || name.includes("biotechnology") || name.includes("biologicals")) {
    return { sector: "Pharmaceuticals & Biotechnology", industry: "Biotechnology" };
  }

  // Software & IT
  if (name.includes("software") || name.includes("infotech") || name.includes("technologies") || name.includes("technology") || name.includes("systems") || name.includes("digital") || name.includes("cloud") || name.includes("cyber") || name.includes("solutions") || name.includes("data ")) {
    return { sector: "IT - Software", industry: "Computers - Software & Consulting" };
  }
  if (name.includes("hardware") || name.includes("semiconductor") || name.includes("electronic")) {
    return { sector: "IT - Hardware", industry: "Computer Hardware & Equipments" };
  }

  // Real Estate & Construction
  if (name.includes("realty") || name.includes("real estate") || name.includes("developers") || name.includes("properties") || name.includes("housing projects") || name.includes("estates")) {
    return { sector: "Realty", industry: "Real Estate Developer" };
  }
  if (name.includes("construction") || name.includes("infra") || name.includes("infrastructure") || name.includes("buildcon") || name.includes("engineers") || name.includes("engineering")) {
    return { sector: "Construction", industry: "Civil Construction" };
  }

  // Hospitality & Food
  if (name.includes("hotel") || name.includes("hotels") || name.includes("resort") || name.includes("resorts") || name.includes("hospitality") || name.includes("inns")) {
    return { sector: "Leisure Services", industry: "Hotels & Resorts" };
  }
  if (name.includes("restaurant") || name.includes("restaurants") || name.includes("foodworks") || name.includes("dining") || name.includes("beverages") || name.includes("brewery") || name.includes("distilleries")) {
    return { sector: "Leisure Services", industry: "Restaurants" };
  }

  // Power & Energy
  if (name.includes("solar") || name.includes("wind") || name.includes("renewable") || name.includes("green energy")) {
    return { sector: "Power", industry: "Renewable Energy" };
  }
  if (name.includes("power") || name.includes("energy") || name.includes("electricity") || name.includes("generation") || name.includes("transmission") || name.includes("distribution")) {
    return { sector: "Power", industry: "Power Generation" };
  }

  // Textiles
  if (name.includes("textile") || name.includes("textiles") || name.includes("cotton") || name.includes("spinning") || name.includes("weaving") || name.includes("yarn") || name.includes("denim") || name.includes("garment") || name.includes("garments") || name.includes("apparel") || name.includes("apparels") || name.includes("fabrics") || name.includes("fashions") || name.includes("synthetics") || name.includes("woollen") || name.includes("silk")) {
    return { sector: "Textiles & Apparels", industry: "Garments & Apparels" };
  }

  // Chemicals & Fertilizers
  if (name.includes("fertilizer") || name.includes("fertilizers") || name.includes("pesticide") || name.includes("pesticides") || name.includes("agrochem") || name.includes("nutrients") || name.includes("crop")) {
    return { sector: "Fertilizers & Agrochemicals", industry: "Fertilizers" };
  }
  if (name.includes("chemical") || name.includes("chemicals") || name.includes("organics") || name.includes("petrochem") || name.includes("polymers") || name.includes("resins") || name.includes("dyes") || name.includes("pigments") || name.includes("specialities")) {
    return { sector: "Chemicals & Petrochemicals", industry: "Specialty Chemicals" };
  }

  // Paper & Packaging
  if (name.includes("paper") || name.includes("packaging") || name.includes("cartons") || name.includes("containers") || name.includes("corrugat") || name.includes("kraft")) {
    return { sector: "Paper, Forest & Jute Products", industry: "Paper & Paper Products" };
  }

  // Logistics & Transport
  if (name.includes("logistics") || name.includes("transport") || name.includes("freight") || name.includes("cargo") || name.includes("courier") || name.includes("express")) {
    return { sector: "Transport Services", industry: "Logistic Solution Provider" };
  }
  if (name.includes("shipping") || name.includes("maritime") || name.includes("shipyard")) {
    return { sector: "Transport Services", industry: "Shipping" };
  }
  if (name.includes("airways") || name.includes("aviation") || name.includes("airline")) {
    return { sector: "Transport Services", industry: "Airline" };
  }

  // 3. Fallback to underlying DB industry mapping
  if (dbInd && YAHOO_INDUSTRY_TO_NSE[dbInd]) {
    return YAHOO_INDUSTRY_TO_NSE[dbInd];
  }

  // 4. Fallback to existing valid NSE sector
  if (dbSec && NSE_SECTORS.includes(dbSec as NseSector)) {
    const validIndustries = SECTOR_INDUSTRIES[dbSec as NseSector];
    return {
      sector: dbSec,
      industry: validIndustries && validIndustries.length > 0 ? validIndustries[0] : "-",
    };
  }

  return {
    sector: dbSec && dbSec !== "-" ? dbSec : "Diversified",
    industry: dbInd && dbInd !== "-" ? dbInd : "Diversified",
  };
}

/**
 * Returns all underlying DB industries that correspond to a set of selected NSE Sectors.
 */
export function getDbIndustriesForNseSectors(
  nseSectors: readonly string[],
): string[] {
  if (nseSectors.length === 0) return [];
  const result = new Set<string>();
  for (const [dbIndustry, mapping] of Object.entries(YAHOO_INDUSTRY_TO_NSE)) {
    if (nseSectors.includes(mapping.sector)) {
      result.add(dbIndustry);
    }
  }
  return [...result];
}

/**
 * Returns all underlying DB industries that correspond to a set of selected NSE Industries.
 */
export function getDbIndustriesForNseIndustries(
  nseIndustries: readonly string[],
): string[] {
  if (nseIndustries.length === 0) return [];
  const result = new Set<string>();
  for (const [dbIndustry, mapping] of Object.entries(YAHOO_INDUSTRY_TO_NSE)) {
    if (nseIndustries.includes(mapping.industry)) {
      result.add(dbIndustry);
    }
  }
  return [...result];
}

/**
 * Maps any DB industry and sector to its canonical NSE Sector & Industry.
 */
export function mapToCanonicalNse(
  dbIndustry: string | null | undefined,
  dbSector?: string | null | undefined,
  symbol?: string,
  name?: string,
): { sector: string; industry: string } {
  return classifyStockToNse({
    symbol: symbol ?? "",
    name: name ?? "",
    industry: dbIndustry,
    sector: dbSector,
  });
}
