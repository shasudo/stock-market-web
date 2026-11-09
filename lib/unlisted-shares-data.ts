export interface UnlistedShare {
  id: string;
  symbol: string;
  name: string;
  logo?: string;
  logoColor?: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  weekHigh52?: number;
  weekLow52?: number;
}

export interface Partner {
  id: string;
  name: string;
  logo?: string;
  isPreferred?: boolean;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export const topUnlistedShareCompanies: UnlistedShare[] = [
  {
    id: "1",
    symbol: "PPFAS",
    name: "Parag Parikh Fi",
    logoColor: "#8B4513",
    price: 17344.0,
    change: -156.0,
    changePercent: -0.89,
    previousClose: 17500.0,
  },
  {
    id: "2",
    symbol: "ORBIS",
    name: "Orbis Financial",
    logoColor: "#1E90FF",
    price: 426.0,
    change: -4.0,
    changePercent: -0.93,
    previousClose: 430.0,
  },
  {
    id: "3",
    symbol: "CAREHI",
    name: "Care Health Ins",
    logoColor: "#FF6B6B",
    price: 148.5,
    change: -1.5,
    changePercent: -1.0,
    previousClose: 150.0,
  },
  {
    id: "4",
    symbol: "NSE",
    name: "National Stock",
    logoColor: "#4A90D9",
    price: 2020.0,
    change: -25.0,
    changePercent: -1.22,
    previousClose: 2045.0,
  },
  {
    id: "5",
    symbol: "SBIFM",
    name: "SBI Funds Manag",
    logoColor: "#2E7D32",
    price: 760.0,
    change: -10.0,
    changePercent: -1.3,
    previousClose: 770.0,
  },
  {
    id: "6",
    symbol: "CSK",
    name: "Chennai Super K",
    logoColor: "#FFD700",
    price: 212.0,
    change: -3.0,
    changePercent: -1.4,
    previousClose: 215.0,
  },
  {
    id: "7",
    symbol: "PHARM",
    name: "PharmEasy (API)",
    logoColor: "#26A69A",
    price: 6.5,
    change: -0.1,
    changePercent: -1.52,
    previousClose: 6.6,
  },
  {
    id: "8",
    symbol: "NCDEX",
    name: "NCDEX Ltd",
    logoColor: "#FF5722",
    price: 470.0,
    change: -10.0,
    changePercent: -2.08,
    previousClose: 480.0,
  },
  {
    id: "9",
    symbol: "SIGNIF",
    name: "Signify Innovat",
    logoColor: "#9C27B0",
    price: 1150.0,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 1150.0,
  },
  {
    id: "10",
    symbol: "METRO",
    name: "Metropolitan St",
    logoColor: "#E91E63",
    price: 4.5,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 4.5,
  },
  {
    id: "11",
    symbol: "JUPITER",
    name: "Jupiter Interna",
    logoColor: "#673AB7",
    price: 315.0,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 315.0,
  },
  {
    id: "12",
    symbol: "MERINO",
    name: "Merino Industri",
    logoColor: "#3F51B5",
    price: 3180.0,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 3180.0,
  },
  {
    id: "13",
    symbol: "HOK",
    name: "House of Kieray",
    logoColor: "#00BCD4",
    price: 185.0,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 185.0,
  },
  {
    id: "14",
    symbol: "ASKINV",
    name: "ASK Investment",
    logoColor: "#607D8B",
    price: 1075.0,
    change: 0.0,
    changePercent: 0.0,
    previousClose: 1075.0,
  },
];

export const topGainersShares: UnlistedShare[] = [
  {
    id: "1",
    symbol: "METRO",
    name: "Metropolitan St",
    logoColor: "#E91E63",
    price: 3.96,
    change: 0.28,
    changePercent: 7.68,
    previousClose: 3.68,
  },
  {
    id: "2",
    symbol: "IKFFI",
    name: "IKF Finance Ltd",
    logoColor: "#2196F3",
    price: 466.0,
    change: 3.33,
    changePercent: 0.72,
    previousClose: 462.67,
  },
  {
    id: "3",
    symbol: "PARRY",
    name: "Parry Agro Indu",
    logoColor: "#4CAF50",
    price: 1277.0,
    change: 77.0,
    changePercent: 6.42,
    previousClose: 1200.0,
  },
  {
    id: "4",
    symbol: "SBIFM",
    name: "SBI Fund Manage",
    logoColor: "#F44336",
    price: 709.75,
    change: 20.0,
    changePercent: 2.9,
    previousClose: 689.75,
  },
  {
    id: "5",
    symbol: "MOHAN",
    name: "Mohan Meakin Lt",
    logoColor: "#FF9800",
    price: 2203.5,
    change: 94.25,
    changePercent: 4.47,
    previousClose: 2109.25,
  },
  {
    id: "6",
    symbol: "GARUDA",
    name: "Garuda Aerospac",
    logoColor: "#9C27B0",
    price: 182940.0,
    change: 4182.0,
    changePercent: 2.34,
    previousClose: 178758.0,
  },
  {
    id: "7",
    symbol: "INKEL",
    name: "Inkel Ltd.",
    logoColor: "#00BCD4",
    price: 19.5,
    change: 0.6,
    changePercent: 3.17,
    previousClose: 18.9,
  },
  {
    id: "8",
    symbol: "SUNDAY",
    name: "Sunday Proptech",
    logoColor: "#607D8B",
    price: 21.35,
    change: 0.1,
    changePercent: 0.47,
    previousClose: 21.25,
  },
  {
    id: "9",
    symbol: "AONE",
    name: "AOne Steels Ind",
    logoColor: "#FF5722",
    price: 246.0,
    change: 1.0,
    changePercent: 0.41,
    previousClose: 245.0,
  },
  {
    id: "10",
    symbol: "BINANI",
    name: "Binani Industri",
    logoColor: "#795548",
    price: 1.43,
    change: 0.01,
    changePercent: 0.35,
    previousClose: 1.42,
  },
];

export const topLosersShares: UnlistedShare[] = [
  {
    id: "1",
    symbol: "RDC",
    name: "RDC Concrete (I",
    logoColor: "#4CAF50",
    price: 184.0,
    change: -62.5,
    changePercent: -25.35,
    previousClose: 246.5,
  },
  {
    id: "2",
    symbol: "BOOTES",
    name: "Bootes Impex Te",
    logoColor: "#2196F3",
    price: 1192.0,
    change: -13.0,
    changePercent: -1.08,
    previousClose: 1205.0,
  },
  {
    id: "3",
    symbol: "ONIX",
    name: "ONIX Renewable",
    logoColor: "#4CAF50",
    price: 59.63,
    change: -0.12,
    changePercent: -0.21,
    previousClose: 59.75,
  },
  {
    id: "4",
    symbol: "BIRA91",
    name: "Bira91 (B9 Beve",
    logoColor: "#FF9800",
    price: 155.0,
    change: -0.75,
    changePercent: -0.48,
    previousClose: 155.75,
  },
  {
    id: "5",
    symbol: "SNAMILK",
    name: "SNA Milk and Mi",
    logoColor: "#9C27B0",
    price: 45999.0,
    change: -667.0,
    changePercent: -1.43,
    previousClose: 46666.0,
  },
  {
    id: "6",
    symbol: "INDIAN",
    name: "Indian Commodit",
    logoColor: "#607D8B",
    price: 3.51,
    change: -0.05,
    changePercent: -1.33,
    previousClose: 3.56,
  },
  {
    id: "7",
    symbol: "APOLLO",
    name: "Apollo Green En",
    logoColor: "#00BCD4",
    price: 86.88,
    change: -1.12,
    changePercent: -1.28,
    previousClose: 88.0,
  },
  {
    id: "8",
    symbol: "MATRIX",
    name: "Matrix Gas And",
    logoColor: "#FF5722",
    price: 24.98,
    change: -0.25,
    changePercent: -1.01,
    previousClose: 25.23,
  },
  {
    id: "9",
    symbol: "HELLA",
    name: "Hella Infra Mar",
    logoColor: "#E91E63",
    price: 129000.0,
    change: -31000.0,
    changePercent: -19.37,
    previousClose: 160000.0,
  },
  {
    id: "10",
    symbol: "MAVERICK",
    name: "Maverick Simula",
    logoColor: "#3F51B5",
    price: 1875.0,
    change: -40.0,
    changePercent: -2.09,
    previousClose: 1915.0,
  },
];

export const weekHigh52Shares: UnlistedShare[] = [];

export const weekLow52Shares: UnlistedShare[] = [];

export const preferredPartner: Partner = {
  id: "1",
  name: "Incred Money",
  logo: "/partners/incred-money.png",
  isPreferred: true,
};

export const partners: Partner[] = [
  { id: "1", name: "Altius Investech", logo: "/partners/altius.png" },
  { id: "2", name: "Wealth Wisdom", logo: "/partners/wealth-wisdom.png" },
  { id: "3", name: "Planify", logo: "/partners/planify.png" },
  { id: "4", name: "Unlisted Zone", logo: "/partners/unlisted-zone.png" },
];

export const unlistedSharesFAQs: FAQ[] = [
  {
    id: "1",
    question: "What are unlisted equity shares?",
    answer:
      "Unlisted shares are equity shares of companies that are not listed on any recognized stock exchange (like the NSE or BSE). These companies operate privately and their shares are not traded publicly.",
  },
  {
    id: "2",
    question: "How can I buy unlisted shares?",
    answer:
      "Unlisted shares can be purchased through intermediaries, specialized platforms, or directly from existing shareholders. The transaction typically involves legal agreements and proper documentation.",
  },
  {
    id: "3",
    question: "What are the risks of investing in unlisted shares?",
    answer:
      "The main risks include liquidity risk (difficulty in selling), valuation uncertainty, limited information availability, and regulatory risks. Always conduct thorough due diligence before investing.",
  },
  {
    id: "4",
    question: "How are unlisted shares valued?",
    answer:
      "Unlisted shares are typically valued based on the company's financials, previous funding rounds, peer comparison, and discounted cash flow analysis. Prices are derived from private market transactions.",
  },
  {
    id: "5",
    question: "What happens when an unlisted company gets listed?",
    answer:
      "When an unlisted company goes public through an IPO, shareholders can sell their shares on the stock exchange. This often results in better liquidity and potentially higher valuations.",
  },
];

export const unlistedSharesTabs = [
  "Top Unlisted Share Companies",
  "Top Gainers",
  "Top Losers",
  "52 Week High",
  "52 Week Low",
] as const;

export type UnlistedSharesTabType = (typeof unlistedSharesTabs)[number];

export const timePeriods = ["1W", "1M", "3M", "6M", "1Y"] as const;
export type TimePeriodType = (typeof timePeriods)[number];
