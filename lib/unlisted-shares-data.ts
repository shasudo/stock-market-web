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
