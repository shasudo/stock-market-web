export interface ETFFAQ {
  id: string;
  question: string;
  answer: string;
}

export const etfFAQs: ETFFAQ[] = [
  {
    id: "1",
    question: "What are ETFs",
    answer:
      "ETFs or Exchange Traded Funds are investment vehicles which trade on the stock exchange like other instruments such as stocks, REITs, InVITs etc. A fund house comes out with an offering in form of a fund of fund that invests into a portfolio of securities and then an ETF linked to this fund of fund is issued for purposes of liquidity. These ETFs are backed by a portfolio of securities such as stocks, bonds and/or commodities that track a specific index or strategy.",
  },
  {
    id: "2",
    question: "ETFs compared with MFs",
    answer:
      "ETFs trade on exchanges like stocks with real-time pricing, while mutual funds are priced once daily. ETFs typically have lower expense ratios and offer more tax efficiency. Mutual funds may have minimum investment requirements, while ETFs can be bought in single shares.",
  },
  {
    id: "3",
    question: "Price discovery of ETFs",
    answer:
      "ETF prices are discovered through real-time trading on stock exchanges. The price closely tracks the Net Asset Value (NAV) of underlying securities. Authorized participants help maintain price efficiency through arbitrage mechanisms.",
  },
  {
    id: "4",
    question: "Passive Investing vs Active Investing",
    answer:
      "Passive investing through ETFs tracks market indices with lower costs and minimal trading. Active investing seeks to outperform the market through stock selection and market timing. ETFs are predominantly passive, offering diversification at lower expense ratios.",
  },
  {
    id: "5",
    question: "Benefits of ETFs",
    answer:
      "ETFs offer diversification, lower expense ratios, tax efficiency, transparency, and intraday trading flexibility. They provide access to various asset classes and strategies in a single instrument.",
  },
];

export const sortOptions = [
  { value: "name", label: "Name" },
  { value: "price", label: "Price" },
  { value: "change", label: "% Change" },
];
