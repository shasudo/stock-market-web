/** Plain-language F&O reference shown under the snapshot. */

export const FNO_GLOSSARY: readonly { term: string; meaning: string }[] = [
  { term: "At-the-Money Option", meaning: "An option whose strike price is at, or closest to, the underlying's current price." },
  { term: "In-the-Money Option", meaning: "A call with a strike below the underlying price, or a put with a strike above it: it has intrinsic value." },
  { term: "Out-of-the-Money Option", meaning: "A call with a strike above the underlying price, or a put with a strike below it: its premium is all time value." },
  { term: "Basis", meaning: "Futures price minus the cash (spot) price. Positive basis is a premium; negative basis is a discount." },
  { term: "Bull Spread", meaning: "Buying an option and selling another of the same type at a higher strike, to profit from a moderate rise at lower cost." },
  { term: "Bear Spread", meaning: "Buying an option and selling another of the same type at a lower strike, to profit from a moderate fall at lower cost." },
  { term: "Call", meaning: "An option giving the buyer the right, but not the obligation, to buy the underlying at the strike price." },
  { term: "Put", meaning: "An option giving the buyer the right, but not the obligation, to sell the underlying at the strike price." },
  { term: "European-Style Options", meaning: "Options that can be exercised only on the expiry date. All NSE index and stock options are European style." },
  { term: "Expiration Date", meaning: "The last day a futures or options contract trades; after it the contract is settled and ceases to exist." },
  { term: "Forward (Cash) Contract", meaning: "A private agreement to buy or sell at a set price on a future date, without an exchange or daily settlement." },
  { term: "Futures Contract", meaning: "An exchange-traded, standardised agreement to buy or sell the underlying at a set price on expiry, marked to market daily." },
  { term: "Hedging", meaning: "Taking an offsetting derivatives position to reduce the risk of an existing holding." },
  { term: "Mark-to-Market", meaning: "Settling gains and losses on open futures every day against that day's settlement price." },
  { term: "Open Interest", meaning: "The number of contracts (shown here in shares) that are open — traded but not yet closed or settled." },
  { term: "Rollover", meaning: "Closing a position in the expiring month and opening the same position in the next month. Rollover % is the share of open interest already in later months." },
  { term: "Put-Call Ratio (PCR)", meaning: "Total put open interest divided by total call open interest for an expiry. Above 1, more puts are open than calls." },
  { term: "Max Pain", meaning: "The strike at which the open calls and puts of an expiry would be worth least to their buyers if the underlying settled there." },
  { term: "Long Build-up", meaning: "Price up with open interest up: new buying positions are being added." },
  { term: "Short Build-up", meaning: "Price down with open interest up: new selling positions are being added." },
  { term: "Short Covering", meaning: "Price up with open interest down: sellers are closing their positions." },
  { term: "Long Unwinding", meaning: "Price down with open interest down: buyers are closing their positions." },
  { term: "Market-Wide Position Limit (Ban)", meaning: "When open interest in a stock's derivatives crosses 95% of the exchange limit, the stock enters the ban period: positions may only be reduced until it falls below 80%." },
];

export const FNO_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "What are derivatives?",
    answer:
      "A derivative is a contract whose value comes from something else — a share, an index, a commodity or a currency. Futures and options are the most common derivatives traded on Indian exchanges, and they are regulated as securities.",
  },
  {
    question: "What is a futures contract?",
    answer:
      "A futures contract binds both sides to buy or sell the underlying at an agreed price on the expiry date. The exchange fixes the lot size and expiry dates, and every open position is marked to market each day, so gains and losses are settled daily rather than all at expiry. Index and stock futures on NSE are cash-settled monthly contracts, with three months open at any time (near, next and far).",
  },
  {
    question: "What is an options contract?",
    answer:
      "An option gives its buyer a right without an obligation: a call is the right to buy, a put the right to sell, at the strike price on expiry. The buyer pays a premium for that right; the seller (writer) receives the premium and must honour the contract if it is exercised. NSE options are European style and cash-settled.",
  },
  {
    question: "What are index futures and index options?",
    answer:
      "They are futures and options whose underlying is a stock market index, such as Nifty 50 or Nifty Bank, rather than a single share. They let traders take a view on, or hedge against, the market or a sector as a whole and are settled in cash because an index cannot be delivered.",
  },
  {
    question: "How is open interest different from volume?",
    answer:
      "Volume counts every contract traded during the session; open interest counts the contracts still open at the end of it. Rising open interest means new positions are being created, falling open interest means positions are being closed — read together with the price move, it shows whether buyers or sellers are driving it.",
  },
  {
    question: "What does the arbitrage table show?",
    answer:
      "It compares each stock's near-month futures price with its cash-market price. The difference (basis) normally reflects the cost of carry until expiry; an unusually wide or negative basis can signal an arbitrage opportunity or strong positioning in the futures.",
  },
  {
    question: "Where does this data come from?",
    answer:
      "Futures prices and open interest are live exchange quotes; option chains, most active options and the ban list come from NSE; open interest and volume changes are measured against NSE's official bhavcopy for the previous session. Everything on this page is free.",
  },
];
