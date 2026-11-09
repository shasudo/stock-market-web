export interface EarningsData {
  id: string;
  date: string;
  stockName: string;
  resultType: string;
  ltp: number;
  change: number;
  tentativeTime: string;
}

export interface CorporateActionData {
  id: string;
  stockName: string;
  eventType:
    | "AGM-EGM"
    | "Board Meeting"
    | "Announcement"
    | "Dividends"
    | "Bonus"
    | "Rights"
    | "Splits";
  announcedDate: string;
  exDate: string;
  dividend: string | null;
  ratio: string | null;
}

export type IPOType = "Mainline" | "SME";
export type IPOStatus = "Open" | "Upcoming" | "Closed" | "Listed";

export interface SubscriptionData {
  qib: string;
  rii: string;
  nii: string;
  others: string;
  total: string;
}

export interface IPODates {
  basisOfAllotment: string;
  initiationOfRefunds: string;
  creditOfShares: string;
  listingDate: string;
}

export interface OpenIPOData {
  id: string;
  companyName: string;
  type: IPOType;
  status: "Open";
  openDate: string;
  closeDate: string;
  issuePrice: string;
  lotSize: number;
  issueSize: string;
  subscription: SubscriptionData;
  ipoDates: IPODates;
  rhpLink?: string;
  description: string;
}

export interface UpcomingIPOData {
  id: string;
  companyName: string;
  type: IPOType;
  status: "Upcoming";
  openDate: string;
  closeDate: string;
  issuePrice: string;
  lotSize: number;
  issueSize: string;
  subscription: SubscriptionData;
  ipoDates: IPODates;
  rhpLink?: string;
  description: string;
}

export interface ClosedIPOData {
  id: string;
  companyName: string;
  type: IPOType;
  issuePrice: string;
  qib: string;
  nii: string;
  retail: string;
  totalSubs: string;
  allotmentDate: string;
  refundDate: string;
  dematCreditDate: string;
  listingDate: string;
}

export interface ListedIPOData {
  id: string;
  companyName: string;
  type: IPOType;
  listingDate: string;
  issuePrice: string;
  totalSubs: string;
  listingOpen: string;
  listingClose: string;
  listingGain: string;
  ltp: string;
  todaysGain: string;
  issueSize: string;
}

export interface DraftIssueData {
  id: string;
  companyName: string;
  drhpFilingDate: string;
  drhpLink?: string;
}

export interface IPOData {
  id: string;
  equity: string;
  category: "upcoming" | "recently-listed" | "nfos" | "draft-issues";
  dateOfFiling: string;
  issueSize?: string;
  priceRange?: string;
  status?: string;
}

export const earningsData: EarningsData[] = [
  {
    id: "e1",
    date: "7 Jan",
    stockName: "Premier Energy and Infrastructure",
    resultType: "Q3-2025",
    ltp: 12.1,
    change: 4.76,
    tentativeTime: "Time Not Available",
  },
  {
    id: "e2",
    date: "7 Jan",
    stockName: "Galaxy Agrico Exports",
    resultType: "Q3-2025",
    ltp: 55.89,
    change: -0.29,
    tentativeTime: "Time Not Available",
  },
  {
    id: "e3",
    date: "7 Jan",
    stockName: "Reliance Industries",
    resultType: "Q3-2025",
    ltp: 2456.5,
    change: 1.25,
    tentativeTime: "4:00 PM",
  },
  {
    id: "e4",
    date: "7 Jan",
    stockName: "Tata Consultancy Services",
    resultType: "Q3-2025",
    ltp: 3850.75,
    change: 0.85,
    tentativeTime: "5:30 PM",
  },
  {
    id: "e5",
    date: "8 Jan",
    stockName: "HDFC Bank",
    resultType: "Q3-2025",
    ltp: 1678.3,
    change: -0.45,
    tentativeTime: "3:00 PM",
  },
  {
    id: "e6",
    date: "8 Jan",
    stockName: "Infosys",
    resultType: "Q3-2025",
    ltp: 1542.6,
    change: 2.1,
    tentativeTime: "4:30 PM",
  },
  {
    id: "e7",
    date: "9 Jan",
    stockName: "ICICI Bank",
    resultType: "Q3-2025",
    ltp: 1089.25,
    change: 0.32,
    tentativeTime: "Time Not Available",
  },
  {
    id: "e8",
    date: "9 Jan",
    stockName: "Bharti Airtel",
    resultType: "Q3-2025",
    ltp: 1245.8,
    change: -1.15,
    tentativeTime: "6:00 PM",
  },
  {
    id: "e9",
    date: "6 Jan",
    stockName: "Wipro",
    resultType: "Q3-2025",
    ltp: 456.3,
    change: 0.75,
    tentativeTime: "5:00 PM",
  },
  {
    id: "e10",
    date: "6 Jan",
    stockName: "HCL Technologies",
    resultType: "Q3-2025",
    ltp: 1678.45,
    change: 1.85,
    tentativeTime: "4:00 PM",
  },
];

export const corporateActionsData: CorporateActionData[] = [
  {
    id: "c1",
    stockName: "Cummins",
    eventType: "AGM-EGM",
    announcedDate: "05/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c2",
    stockName: "Senores Pharm",
    eventType: "Board Meeting",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c3",
    stockName: "Ravindra Energ",
    eventType: "AGM-EGM",
    announcedDate: "08/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c4",
    stockName: "KCP",
    eventType: "AGM-EGM",
    announcedDate: "04/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c5",
    stockName: "Asian Energy",
    eventType: "AGM-EGM",
    announcedDate: "03/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c6",
    stockName: "ILandFS Engg",
    eventType: "AGM-EGM",
    announcedDate: "02/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c7",
    stockName: "Sheetal Cool Pr",
    eventType: "Board Meeting",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c8",
    stockName: "Pioneer",
    eventType: "AGM-EGM",
    announcedDate: "01/12/2025",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c9",
    stockName: "Kalyan Jeweller",
    eventType: "Announcement",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c10",
    stockName: "Honeywell Autom",
    eventType: "Announcement",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c11",
    stockName: "V2 Retail",
    eventType: "Announcement",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c12",
    stockName: "Welspun Corp",
    eventType: "Announcement",
    announcedDate: "07/01/2026",
    exDate: "07/01/2026",
    dividend: null,
    ratio: null,
  },
  {
    id: "c13",
    stockName: "Tata Steel",
    eventType: "Dividends",
    announcedDate: "15/12/2025",
    exDate: "10/01/2026",
    dividend: "3.50",
    ratio: null,
  },
  {
    id: "c14",
    stockName: "Infosys",
    eventType: "Dividends",
    announcedDate: "20/12/2025",
    exDate: "15/01/2026",
    dividend: "18.00",
    ratio: null,
  },
  {
    id: "c15",
    stockName: "Reliance",
    eventType: "Bonus",
    announcedDate: "01/12/2025",
    exDate: "20/01/2026",
    dividend: null,
    ratio: "1:1",
  },
  {
    id: "c16",
    stockName: "HDFC Bank",
    eventType: "Rights",
    announcedDate: "10/12/2025",
    exDate: "25/01/2026",
    dividend: null,
    ratio: "1:5",
  },
  {
    id: "c17",
    stockName: "Wipro",
    eventType: "Splits",
    announcedDate: "05/12/2025",
    exDate: "30/01/2026",
    dividend: null,
    ratio: "1:2",
  },
];

export const ipoData: IPOData[] = [
  {
    id: "i1",
    equity: "Horizon Industrial Parks Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "05-Jan-2026",
  },
  {
    id: "i2",
    equity: "Deepa Jewellers Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "02-Jan-2026",
  },
  {
    id: "i3",
    equity: "Mehta Hitech Industries Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "02-Jan-2026",
  },
  {
    id: "i4",
    equity: "Travelstack Tech Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "02-Jan-2026",
  },
  {
    id: "i5",
    equity: "Krishna Buildspace Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "02-Jan-2026",
  },
  {
    id: "i6",
    equity: "Neolite ZKW lightings Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "02-Jan-2026",
  },
  {
    id: "i7",
    equity: "Casagrand Premier Builder Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "31-Dec-2025",
  },
  {
    id: "i8",
    equity: "Tonbo Imaging India Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "30-Dec-2025",
  },
  {
    id: "i9",
    equity: "WOG Technologies Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "29-Dec-2025",
  },
  {
    id: "i10",
    equity: "Yatayat Corporation India Limited(DRHP)",
    category: "draft-issues",
    dateOfFiling: "29-Dec-2025",
  },
  {
    id: "i11",
    equity: "Stallion India Fluorochemicals Ltd",
    category: "upcoming",
    dateOfFiling: "16-Jan-2026",
    issueSize: "₹199.45 Cr",
    priceRange: "₹85-90",
  },
  {
    id: "i12",
    equity: "Indo Farm Equipment Ltd",
    category: "upcoming",
    dateOfFiling: "15-Jan-2026",
    issueSize: "₹244.68 Cr",
    priceRange: "₹204-215",
  },
  {
    id: "i13",
    equity: "Standard Glass Lining Tech Ltd",
    category: "upcoming",
    dateOfFiling: "14-Jan-2026",
    issueSize: "₹410.05 Cr",
    priceRange: "₹133-140",
  },
  {
    id: "i14",
    equity: "Mobikwik Systems Ltd",
    category: "recently-listed",
    dateOfFiling: "18-Dec-2025",
    status: "Listed at ₹442.25",
  },
  {
    id: "i15",
    equity: "Vishal Mega Mart Ltd",
    category: "recently-listed",
    dateOfFiling: "13-Dec-2025",
    status: "Listed at ₹110",
  },
  {
    id: "i16",
    equity: "Sai Life Sciences Ltd",
    category: "recently-listed",
    dateOfFiling: "11-Dec-2025",
    status: "Listed at ₹755",
  },
  {
    id: "i17",
    equity: "ICICI Pru BSE Infra Index Fund",
    category: "nfos",
    dateOfFiling: "10-Jan-2026",
  },
  {
    id: "i18",
    equity: "Nippon India Nifty 500 Equal Weight Index Fund",
    category: "nfos",
    dateOfFiling: "08-Jan-2026",
  },
  {
    id: "i19",
    equity: "Aditya Birla SL Multi Sector Rotation Fund",
    category: "nfos",
    dateOfFiling: "06-Jan-2026",
  },
];

export const openIPOData: OpenIPOData[] = [
  {
    id: "open1",
    companyName: "Bharat Coking Coal Ltd IPO",
    type: "Mainline",
    status: "Open",
    openDate: "09 Jan, 2026",
    closeDate: "13 Jan, 2026",
    issuePrice: "₹21 - ₹23",
    lotSize: 600,
    issueSize: "₹ 1,071.11 Cr",
    subscription: {
      qib: "0.01x",
      rii: "2.08x",
      nii: "3.36x",
      others: "0x",
      total: "1.72x",
    },
    ipoDates: {
      basisOfAllotment: "2026-01-14",
      initiationOfRefunds: "2026-01-15",
      creditOfShares: "2026-01-15",
      listingDate: "2026-01-16",
    },
    rhpLink: "#",
    description:
      "IPO opens for subscription on 2026-01-09 and closes on 2026-01-13. Bharat Coking Coal Ltd IPO price band is set at 21 to 23.",
  },
  {
    id: "open2",
    companyName: "Defrail Technologies Ltd IPO",
    type: "SME",
    status: "Open",
    openDate: "09 Jan, 2026",
    closeDate: "13 Jan, 2026",
    issuePrice: "₹70 - ₹74",
    lotSize: 1600,
    issueSize: "₹ 13.77 Cr",
    subscription: {
      qib: "0x",
      rii: "1.22x",
      nii: "0.65x",
      others: "0x",
      total: "0.74x",
    },
    ipoDates: {
      basisOfAllotment: "2026-01-14",
      initiationOfRefunds: "2026-01-15",
      creditOfShares: "2026-01-15",
      listingDate: "2026-01-16",
    },
    rhpLink: "#",
    description:
      "IPO opens for subscription on 2026-01-09 and closes on 2026-01-13. Defrail Technologies Ltd IPO price band is set at 70 to 74.",
  },
];

export const upcomingIPOData: UpcomingIPOData[] = [
  {
    id: "upcoming1",
    companyName: "Amagi Media Labs Ltd IPO",
    type: "Mainline",
    status: "Upcoming",
    openDate: "13 Jan, 2026",
    closeDate: "16 Jan, 2026",
    issuePrice: "₹343 - ₹361",
    lotSize: 41,
    issueSize: "₹ 1,788.62 Cr",
    subscription: {
      qib: "Awaiting",
      rii: "Awaiting",
      nii: "Awaiting",
      others: "Awaiting",
      total: "Awaiting",
    },
    ipoDates: {
      basisOfAllotment: "2026-01-19",
      initiationOfRefunds: "2026-01-20",
      creditOfShares: "2026-01-20",
      listingDate: "2026-01-21",
    },
    rhpLink: "#",
    description:
      "IPO opens for subscription on 2026-01-13 and closes on 2026-01-16. Amagi Media Labs Ltd IPO price band is set at 343 to 361.",
  },
  {
    id: "upcoming2",
    companyName: "Avana Electrosystems Ltd IPO",
    type: "SME",
    status: "Upcoming",
    openDate: "12 Jan, 2026",
    closeDate: "14 Jan, 2026",
    issuePrice: "₹56 - ₹59",
    lotSize: 2000,
    issueSize: "₹ 35.22 Cr",
    subscription: {
      qib: "Awaiting",
      rii: "Awaiting",
      nii: "Awaiting",
      others: "Awaiting",
      total: "Awaiting",
    },
    ipoDates: {
      basisOfAllotment: "2026-01-15",
      initiationOfRefunds: "2026-01-16",
      creditOfShares: "2026-01-16",
      listingDate: "2026-01-19",
    },
    rhpLink: "#",
    description:
      "IPO opens for subscription on 2026-01-12 and closes on 2026-01-14. Avana Electrosystems Ltd IPO price band is set at 56 to 59.",
  },
  {
    id: "upcoming3",
    companyName: "INDO SMC Ltd IPO",
    type: "SME",
    status: "Upcoming",
    openDate: "15 Jan, 2026",
    closeDate: "17 Jan, 2026",
    issuePrice: "₹120 - ₹126",
    lotSize: 1200,
    issueSize: "₹ 42.15 Cr",
    subscription: {
      qib: "Awaiting",
      rii: "Awaiting",
      nii: "Awaiting",
      others: "Awaiting",
      total: "Awaiting",
    },
    ipoDates: {
      basisOfAllotment: "2026-01-20",
      initiationOfRefunds: "2026-01-21",
      creditOfShares: "2026-01-21",
      listingDate: "2026-01-22",
    },
    rhpLink: "#",
    description:
      "IPO opens for subscription on 2026-01-15 and closes on 2026-01-17. INDO SMC Ltd IPO price band is set at 120 to 126.",
  },
];

export const closedIPOData: ClosedIPOData[] = [
  {
    id: "closed1",
    companyName: "Gabion Technologies India Ltd IPO",
    type: "SME",
    issuePrice: "₹ 81",
    qib: "271.13x",
    nii: "1085.88x",
    retail: "867.23x",
    totalSubs: "768.13x",
    allotmentDate: "09 Jan 26",
    refundDate: "12 Jan 26",
    dematCreditDate: "12 Jan 26",
    listingDate: "13 Jan 26",
  },
  {
    id: "closed2",
    companyName: "Victory Electric Vehicles International IPO",
    type: "SME",
    issuePrice: "₹ 41",
    qib: "-",
    nii: "0.92x",
    retail: "1.01x",
    totalSubs: "0.97x",
    allotmentDate: "12 Jan 26",
    refundDate: "13 Jan 26",
    dematCreditDate: "13 Jan 26",
    listingDate: "14 Jan 26",
  },
  {
    id: "closed3",
    companyName: "Yajur Fibres Ltd IPO",
    type: "SME",
    issuePrice: "₹ 174",
    qib: "1.03x",
    nii: "0.93x",
    retail: "1.51x",
    totalSubs: "1.31x",
    allotmentDate: "12 Jan 26",
    refundDate: "13 Jan 26",
    dematCreditDate: "13 Jan 26",
    listingDate: "14 Jan 26",
  },
];

export const listedIPOData: ListedIPOData[] = [
  {
    id: "listed1",
    companyName: "Modern Diagnostic & Research Centre IPO",
    type: "SME",
    listingDate: "07 Jan 26",
    issuePrice: "₹ 90",
    totalSubs: "350.49x",
    listingOpen: "-",
    listingClose: "-",
    listingGain: "-",
    ltp: "₹ 94.00",
    todaysGain: "-",
    issueSize: "36.89 Cr",
  },
  {
    id: "listed2",
    companyName: "E to E Transportation Infrastructure IPO",
    type: "SME",
    listingDate: "02 Jan 26",
    issuePrice: "₹ 174",
    totalSubs: "490.57x",
    listingOpen: "330.6",
    listingClose: "327.8",
    listingGain: "90.00%",
    ltp: "₹ 303.85",
    todaysGain: "-8.09%",
    issueSize: "84.22 Cr",
  },
  {
    id: "listed3",
    companyName: "Bai-Kakaji Polymers IPO",
    type: "SME",
    listingDate: "31 Dec 25",
    issuePrice: "₹ 186",
    totalSubs: "5.38x",
    listingOpen: "-",
    listingClose: "-",
    listingGain: "-",
    ltp: "₹ 180.50",
    todaysGain: "-",
    issueSize: "105.17 Cr",
  },
  {
    id: "listed4",
    companyName: "Apollo Techno Industries IPO",
    type: "SME",
    listingDate: "31 Dec 25",
    issuePrice: "₹ 130",
    totalSubs: "47.15x",
    listingOpen: "-",
    listingClose: "-",
    listingGain: "-",
    ltp: "₹ 131.00",
    todaysGain: "-",
    issueSize: "47.96 Cr",
  },
  {
    id: "listed5",
    companyName: "Nanta Tech IPO",
    type: "SME",
    listingDate: "31 Dec 25",
    issuePrice: "₹ 220",
    totalSubs: "6x",
    listingOpen: "-",
    listingClose: "-",
    listingGain: "-",
    ltp: "₹ 303.50",
    todaysGain: "-",
    issueSize: "31.81 Cr",
  },
  {
    id: "listed6",
    companyName: "Admach Systems IPO",
    type: "SME",
    listingDate: "31 Dec 25",
    issuePrice: "₹ 239",
    totalSubs: "3.95x",
    listingOpen: "-",
    listingClose: "-",
    listingGain: "-",
    ltp: "₹ 225.65",
    todaysGain: "-",
    issueSize: "42.60 Cr",
  },
  {
    id: "listed7",
    companyName: "Dhara Rail Projects IPO",
    type: "SME",
    listingDate: "31 Dec 25",
    issuePrice: "₹ 126",
    totalSubs: "103.99x",
    listingOpen: "150",
    listingClose: "157.5",
    listingGain: "19.05%",
    ltp: "₹ 125.55",
    todaysGain: "-16.30%",
    issueSize: "50.20 Cr",
  },
  {
    id: "listed8",
    companyName: "Gujarat Kidney and Super Speciality IPO",
    type: "Mainline",
    listingDate: "30 Dec 25",
    issuePrice: "₹ 114",
    totalSubs: "5.21x",
    listingOpen: "120",
    listingClose: "104.54",
    listingGain: "5.26%",
    ltp: "₹ 102.17",
    todaysGain: "-14.86%",
    issueSize: "250.80 Cr",
  },
  {
    id: "listed9",
    companyName: "Shyam Dhani Industries IPO",
    type: "SME",
    listingDate: "30 Dec 25",
    issuePrice: "₹ 70",
    totalSubs: "918.12x",
    listingOpen: "133",
    listingClose: "139.65",
    listingGain: "90.00%",
    ltp: "₹ 99.60",
    todaysGain: "-25.11%",
    issueSize: "38.49 Cr",
  },
  {
    id: "listed10",
    companyName: "EPW India IPO",
    type: "SME",
    listingDate: "30 Dec 25",
    issuePrice: "₹ 97",
    totalSubs: "1.29x",
    listingOpen: "111",
    listingClose: "116.55",
    listingGain: "14.43%",
    ltp: "₹ 117.65",
    todaysGain: "5.99%",
    issueSize: "31.81 Cr",
  },
];

export const draftIssuesData: DraftIssueData[] = [
  {
    id: "draft1",
    companyName: "Horizon Industrial Parks Limited",
    drhpFilingDate: "05 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft2",
    companyName: "SS Retail Limited",
    drhpFilingDate: "05 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft3",
    companyName: "Neolite ZKW lightings Limited",
    drhpFilingDate: "02 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft4",
    companyName: "Deepa Jewellers Limited",
    drhpFilingDate: "02 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft5",
    companyName: "Krishna Buildspace Limited",
    drhpFilingDate: "02 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft6",
    companyName: "Travelstack Tech Limited",
    drhpFilingDate: "02 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft7",
    companyName: "Mehta Hitech Industries Limited",
    drhpFilingDate: "02 Jan 2026",
    drhpLink: "#",
  },
  {
    id: "draft8",
    companyName: "Casagrand Premier Builder Limited",
    drhpFilingDate: "31 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft9",
    companyName: "Tonbo Imaging India Limited",
    drhpFilingDate: "30 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft10",
    companyName: "Yatayat Corporation India Limited",
    drhpFilingDate: "29 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft11",
    companyName: "WOG Technologies Limited",
    drhpFilingDate: "29 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft12",
    companyName: "Symbiotec Pharmalab Limited",
    drhpFilingDate: "24 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft13",
    companyName: "Crystal Crop Protection Limited",
    drhpFilingDate: "22 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft14",
    companyName: "Shivganga Drillers Limited",
    drhpFilingDate: "19 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft15",
    companyName: "Renny Strips Limited",
    drhpFilingDate: "19 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft16",
    companyName: "ASPRI Spirits Limited",
    drhpFilingDate: "18 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft17",
    companyName: "Sonaselection India Limited",
    drhpFilingDate: "17 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft18",
    companyName: "Shiprocket Limited",
    drhpFilingDate: "15 Dec 2025",
    drhpLink: "#",
  },
  {
    id: "draft19",
    companyName: "Jindal Supreme India Limited",
    drhpFilingDate: "10 Dec 2025",
  },
  {
    id: "draft20",
    companyName: "MV Electrosystems Limited",
    drhpFilingDate: "10 Dec 2025",
  },
];

export const upcomingIPOLinks = [
  { name: "Amagi Media Labs Ltd IPO", link: "#" },
  { name: "Avana Electrosystems Ltd IPO", link: "#" },
  { name: "INDO SMC Ltd IPO", link: "#" },
  { name: "Narmadesh Brass Industries Ltd IPO", link: "#" },
  { name: "GRE Renew Enertech Ltd IPO", link: "#" },
  { name: "Armour Security India Ltd IPO", link: "#" },
];

export const dateFilters = [
  "Yesterday",
  "Today",
  "Tomorrow",
  "This Week",
  "Next Week",
];
export const eventTypes = ["All", "Dividends", "Bonus", "Rights", "Splits"];
export const ipoTabs = [
  "Open IPO",
  "Upcoming IPO",
  "Closed IPO",
  "Listed IPO",
  "Draft Issues",
];
export const ipoFilters = ["All IPO", "Mainline IPO", "SME IPO"];
