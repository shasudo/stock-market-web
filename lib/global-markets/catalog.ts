/**
 * Instruments on the Global Markets page, grouped the way the page shows
 * them. `symbol` is the provider's ticker: Yahoo Finance for indices,
 * commodities, currencies, ADRs and US stocks; CNBC for government bond
 * yields (Yahoo only carries US Treasuries). MCX futures come from the app's
 * own Dhan instrument quotes and are not listed here.
 */

export type GlobalSectionId =
  | "indices"
  | "commodities"
  | "currencies"
  | "bonds"
  | "indianAdr"
  | "us";

export type InstrumentKind = "index" | "commodity" | "currency" | "bond" | "stock";
export type QuoteSource = "yahoo" | "cnbc";

export interface CatalogInstrument {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly source: QuoteSource;
  readonly kind: InstrumentKind;
  /** ISO 3166 alpha-2 for the flag, or null. */
  readonly country: string | null;
  readonly decimals: number;
  /** Daily history from a different provider/symbol when the quote source has none. */
  readonly history?: { readonly source: QuoteSource; readonly symbol: string };
}

export interface HistoryRef {
  readonly source: QuoteSource;
  readonly symbol: string;
}

export function historyRef(instrument: CatalogInstrument): HistoryRef {
  return instrument.history ?? { source: instrument.source, symbol: instrument.symbol };
}

/** Every distinct history series the page needs. */
export function catalogHistoryRefs(): HistoryRef[] {
  const refs = new Map<string, HistoryRef>();
  for (const section of GLOBAL_MARKETS_CATALOG) {
    for (const group of section.groups) {
      for (const instrument of group.instruments) {
        const ref = historyRef(instrument);
        refs.set(`${ref.source}:${ref.symbol}`, ref);
      }
    }
  }
  return [...refs.values()];
}

export interface CatalogGroup {
  readonly id: string;
  readonly label: string;
  readonly instruments: readonly CatalogInstrument[];
}

export interface CatalogSection {
  readonly id: GlobalSectionId;
  readonly label: string;
  readonly groups: readonly CatalogGroup[];
}

const y = (
  id: string,
  name: string,
  symbol: string,
  kind: InstrumentKind,
  country: string | null,
  decimals = 2,
): CatalogInstrument => ({ id, name, symbol, source: "yahoo", kind, country, decimals });

const bond = (id: string, name: string, symbol: string, country: string): CatalogInstrument => ({
  id,
  name,
  symbol,
  source: "cnbc",
  kind: "bond",
  country,
  decimals: 3,
});

export const MCX_GROUP_ID = "mcx";

export const GLOBAL_MARKETS_CATALOG: readonly CatalogSection[] = [
  {
    id: "indices",
    label: "Global Indices",
    groups: [
      {
        id: "us",
        label: "US Markets",
        instruments: [
          y("dow", "Dow Jones", "^DJI", "index", "US"),
          y("sp500", "S&P 500", "^GSPC", "index", "US"),
          y("nasdaq", "Nasdaq", "^IXIC", "index", "US"),
        ],
      },
      {
        id: "europe",
        label: "European Markets",
        instruments: [
          y("ftse", "FTSE 100", "^FTSE", "index", "GB"),
          y("cac", "CAC 40", "^FCHI", "index", "FR"),
          y("dax", "DAX", "^GDAXI", "index", "DE"),
          y("stoxx50", "Euro Stoxx 50", "^STOXX50E", "index", "EU"),
        ],
      },
      {
        id: "asia",
        label: "Asian Markets",
        instruments: [
          y("nifty", "NIFTY 50", "^NSEI", "index", "IN"),
          y("sensex", "SENSEX", "^BSESN", "index", "IN"),
          y("nikkei", "Nikkei 225", "^N225", "index", "JP"),
          y("sti", "Straits Times", "^STI", "index", "SG"),
          y("hangseng", "Hang Seng", "^HSI", "index", "HK"),
          y("taiwan", "Taiwan Weighted", "^TWII", "index", "TW"),
          y("kospi", "KOSPI", "^KS11", "index", "KR"),
          // Yahoo keeps only the latest day for ^SET.BK; CNBC has the history.
          { ...y("set", "SET Composite", "^SET.BK", "index", "TH"), history: { source: "cnbc", symbol: ".SETI" } },
          y("jakarta", "Jakarta Composite", "^JKSE", "index", "ID"),
          y("shanghai", "Shanghai Composite", "000001.SS", "index", "CN"),
          y("asx200", "S&P/ASX 200", "^AXJO", "index", "AU"),
        ],
      },
    ],
  },
  {
    id: "commodities",
    label: "Commodities",
    groups: [
      {
        id: "international",
        label: "International (USD)",
        instruments: [
          y("brent", "Brent Crude", "BZ=F", "commodity", null),
          y("wti", "Crude Oil (WTI)", "CL=F", "commodity", null),
          y("gold", "Gold", "GC=F", "commodity", null),
          y("silver", "Silver", "SI=F", "commodity", null, 3),
          y("natgas", "Natural Gas", "NG=F", "commodity", null, 3),
          y("copper", "Copper", "HG=F", "commodity", null, 4),
        ],
      },
    ],
  },
  {
    id: "currencies",
    label: "Currencies",
    groups: [
      {
        id: "fx",
        label: "Currencies",
        instruments: [
          y("dxy", "Dollar Index", "DX-Y.NYB", "currency", "US", 3),
          y("usdinr", "USD/INR", "INR=X", "currency", "IN", 4),
          y("gbpinr", "GBP/INR", "GBPINR=X", "currency", "IN", 4),
          y("eurinr", "EUR/INR", "EURINR=X", "currency", "IN", 4),
          y("jpyinr", "JPY/INR", "JPYINR=X", "currency", "IN", 4),
          // Same: Yahoo has no CNY/INR history, CNBC does.
          { ...y("cnyinr", "CNY/INR", "CNYINR=X", "currency", "IN", 4), history: { source: "cnbc", symbol: "CNYINR=" } },
          y("usdjpy", "USD/JPY", "JPY=X", "currency", "JP", 3),
          y("eurusd", "EUR/USD", "EURUSD=X", "currency", "EU", 4),
          y("gbpusd", "GBP/USD", "GBPUSD=X", "currency", "GB", 4),
          y("usdcny", "USD/CNY", "CNY=X", "currency", "CN", 4),
        ],
      },
    ],
  },
  {
    id: "bonds",
    label: "Bonds",
    groups: [
      {
        id: "yields",
        label: "Government Bond Yields (%)",
        instruments: [
          bond("in10y", "India 10Y", "IN10Y", "IN"),
          bond("in30y", "India 30Y", "IN30Y", "IN"),
          bond("us2y", "United States 2Y", "US2Y", "US"),
          bond("us10y", "United States 10Y", "US10Y", "US"),
          bond("us30y", "United States 30Y", "US30Y", "US"),
          bond("cn10y", "China 10Y", "CN10Y", "CN"),
          bond("jp10y", "Japan 10Y", "JP10Y", "JP"),
          bond("gb10y", "United Kingdom 10Y", "GB10Y", "GB"),
          bond("de10y", "Germany 10Y", "DE10Y", "DE"),
          bond("fr10y", "France 10Y", "FR10Y", "FR"),
          bond("it10y", "Italy 10Y", "IT10Y", "IT"),
          bond("za10y", "South Africa 10Y", "ZA10Y", "ZA"),
          bond("ca10y", "Canada 10Y", "CA10Y", "CA"),
          bond("br10y", "Brazil 10Y", "BR10Y", "BR"),
          bond("au10y", "Australia 10Y", "AU10Y", "AU"),
          bond("kr10y", "South Korea 10Y", "KR10Y", "KR"),
          bond("mx10y", "Mexico 10Y", "MX10Y", "MX"),
          bond("id10y", "Indonesia 10Y", "ID10Y", "ID"),
        ],
      },
    ],
  },
  {
    id: "indianAdr",
    label: "Indian ADR",
    groups: [
      {
        id: "adr",
        label: "Indian ADRs & GDRs (USD)",
        instruments: [
          y("ibn", "ICICI Bank ADR", "IBN", "stock", "IN"),
          y("hdb", "HDFC Bank ADR", "HDB", "stock", "IN"),
          y("infy", "Infosys ADR", "INFY", "stock", "IN"),
          y("wit", "Wipro ADR", "WIT", "stock", "IN"),
          y("rdy", "Dr Reddy's ADR", "RDY", "stock", "IN"),
          y("axis", "Axis Bank GDR", "AXB.IL", "stock", "IN"),
          y("mmyt", "MakeMyTrip", "MMYT", "stock", "IN"),
          y("genpact", "Genpact", "G", "stock", "IN"),
          y("sify", "Sify Technologies", "SIFY", "stock", "IN"),
          y("yatra", "Yatra Online", "YTRA", "stock", "IN", 3),
        ],
      },
    ],
  },
  {
    id: "us",
    label: "US Stocks & Indices",
    groups: [
      {
        id: "us-indices",
        label: "US Indices",
        instruments: [
          y("us-dow", "Dow Jones", "^DJI", "index", "US"),
          y("us-sp500", "S&P 500", "^GSPC", "index", "US"),
          y("us-nasdaq", "Nasdaq Composite", "^IXIC", "index", "US"),
          y("us-ndx", "Nasdaq 100", "^NDX", "index", "US"),
          y("us-rut", "Russell 2000", "^RUT", "index", "US"),
          y("us-vix", "CBOE VIX", "^VIX", "index", "US"),
        ],
      },
      {
        id: "us-stocks",
        label: "US Stocks",
        instruments: [
          y("aapl", "Apple", "AAPL", "stock", "US"),
          y("msft", "Microsoft", "MSFT", "stock", "US"),
          y("nvda", "NVIDIA", "NVDA", "stock", "US"),
          y("amzn", "Amazon", "AMZN", "stock", "US"),
          y("googl", "Alphabet", "GOOGL", "stock", "US"),
          y("meta", "Meta Platforms", "META", "stock", "US"),
          y("tsla", "Tesla", "TSLA", "stock", "US"),
          y("avgo", "Broadcom", "AVGO", "stock", "US"),
          y("brk", "Berkshire Hathaway B", "BRK-B", "stock", "US"),
          y("jpm", "JPMorgan Chase", "JPM", "stock", "US"),
          y("v", "Visa", "V", "stock", "US"),
          y("lly", "Eli Lilly", "LLY", "stock", "US"),
          y("nflx", "Netflix", "NFLX", "stock", "US"),
          y("amd", "AMD", "AMD", "stock", "US"),
          y("orcl", "Oracle", "ORCL", "stock", "US"),
          y("wmt", "Walmart", "WMT", "stock", "US"),
          y("xom", "Exxon Mobil", "XOM", "stock", "US"),
          y("cost", "Costco", "COST", "stock", "US"),
        ],
      },
    ],
  },
];

/** Every provider symbol the page needs, de-duplicated (US indices appear twice). */
export function catalogSymbols(source: QuoteSource): string[] {
  const symbols = new Set<string>();
  for (const section of GLOBAL_MARKETS_CATALOG) {
    for (const group of section.groups) {
      for (const instrument of group.instruments) {
        if (instrument.source === source) symbols.add(instrument.symbol);
      }
    }
  }
  return [...symbols];
}
