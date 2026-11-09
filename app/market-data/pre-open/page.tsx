"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  Search,
  X,
} from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";

const categories = [
  "NIFTY 50",
  "NIFTY NEXT 50",
  "NIFTY 100",
  "NIFTY 200",
  "NIFTY 500",
  "NIFTY MIDCAP 50",
  "NIFTY MIDCAP 100",
  "NIFTY SMALLCAP 50",
  "NIFTY SMALLCAP 100",
  "NIFTY BANK",
  "NIFTY AUTO",
  "NIFTY FINANCIAL SERVICES",
  "NIFTY FMCG",
  "NIFTY IT",
  "NIFTY MEDIA",
  "NIFTY METAL",
  "NIFTY PHARMA",
  "NIFTY REALTY",
  "NIFTY ENERGY",
  "NIFTY INFRA",
  "NIFTY PSU BANK",
  "NIFTY PRIVATE BANK",
];

interface PreOpenStock {
  symbol: string;
  prevClose: number;
  iep: number;
  change: number;
  changePercent: number;
  finalPrice: number;
  finalQuantity: number;
  valueCrores: number;
  ffmCapCrores: number;
  nm52wH: number;
  nm52wL: number;
}

const preOpenData: Record<string, PreOpenStock[]> = {
  "NIFTY 50": [
    {
      symbol: "INFY",
      prevClose: 1290.1,
      iep: 1305.5,
      change: 15.4,
      changePercent: 1.19,
      finalPrice: 1305.5,
      finalQuantity: 135695,
      valueCrores: 17.74,
      ffmCapCrores: 456028.53,
      nm52wH: 1778.45,
      nm52wL: 1284.1,
    },
    {
      symbol: "HCLTECH",
      prevClose: 1378.2,
      iep: 1391.0,
      change: 12.8,
      changePercent: 0.93,
      finalPrice: 1391.0,
      finalQuantity: 12934,
      valueCrores: 1.8,
      ffmCapCrores: 148364.12,
      nm52wH: 1780.1,
      nm52wL: 1302.75,
    },
    {
      symbol: "WIPRO",
      prevClose: 201.92,
      iep: 203.71,
      change: 1.79,
      changePercent: 0.89,
      finalPrice: 203.71,
      finalQuantity: 55056,
      valueCrores: 1.12,
      ffmCapCrores: 58008.58,
      nm52wH: 307.7,
      nm52wL: 109.12,
    },
    {
      symbol: "TCS",
      prevClose: 2629.3,
      iep: 2655.0,
      change: 20.7,
      changePercent: 0.79,
      finalPrice: 2655.0,
      finalQuantity: 5930,
      valueCrores: 3.76,
      ffmCapCrores: 228855.22,
      nm52wH: 4592.25,
      nm52wL: 2561.3,
    },
    {
      symbol: "TATASTEEL",
      prevClose: 214.64,
      iep: 215.95,
      change: 1.31,
      changePercent: 0.61,
      finalPrice: 215.95,
      finalQuantity: 41241,
      valueCrores: 0.89,
      ffmCapCrores: 177998.14,
      nm52wH: 184.9,
      nm52wL: 1038.05,
    },
    {
      symbol: "ADANIPORTS",
      prevClose: 1528.7,
      iep: 1537.0,
      change: 8.3,
      changePercent: 0.54,
      finalPrice: 1537.0,
      finalQuantity: 8045,
      valueCrores: 1.24,
      ffmCapCrores: 133115.6,
      nm52wH: 1636.9,
      nm52wL: 1036.05,
    },
    {
      symbol: "INDIGO",
      prevClose: 4947.4,
      iep: 4975.0,
      change: 27.6,
      changePercent: 0.56,
      finalPrice: 4975.0,
      finalQuantity: 4008,
      valueCrores: 1.99,
      ffmCapCrores: 196526.75,
      nm52wH: 6232.65,
      nm52wL: 4194.8,
    },
    {
      symbol: "ETERNAL",
      prevClose: 250.2,
      iep: 251.35,
      change: 1.15,
      changePercent: 0.46,
      finalPrice: 251.85,
      finalQuantity: 180873,
      valueCrores: 4.55,
      ffmCapCrores: 163828.25,
      nm52wH: 282.33,
      nm52wL: 194.8,
    },
    {
      symbol: "MARUTI",
      prevClose: 15070.0,
      iep: 15145.0,
      change: 75.0,
      changePercent: 0.5,
      finalPrice: 15145.0,
      finalQuantity: 3042,
      valueCrores: 4.61,
      ffmCapCrores: 198180.34,
      nm52wH: 17370.0,
      nm52wL: 10569.45,
    },
    {
      symbol: "CIPLA",
      prevClose: 1346.1,
      iep: 1352.8,
      change: 6.7,
      changePercent: 0.5,
      finalPrice: 1352.8,
      finalQuantity: 8001,
      valueCrores: 1.08,
      ffmCapCrores: 109291.55,
      nm52wH: 1702.0,
      nm52wL: 1281.7,
    },
    {
      symbol: "BAJAJ-AUTO",
      prevClose: 10097.0,
      iep: 10146.5,
      change: 49.5,
      changePercent: 0.49,
      finalPrice: 10146.5,
      finalQuantity: 758,
      valueCrores: 0.77,
      ffmCapCrores: 112277.67,
      nm52wH: 10897.0,
      nm52wL: 8315.25,
    },
    {
      symbol: "HINDALCO",
      prevClose: 937.4,
      iep: 942.0,
      change: 4.6,
      changePercent: 0.49,
      finalPrice: 942.0,
      finalQuantity: 10015,
      valueCrores: 0.94,
      ffmCapCrores: 135907.98,
      nm52wH: 772.65,
      nm52wL: 546.45,
    },
    {
      symbol: "HDFCBANK",
      prevClose: 907.8,
      iep: 911.4,
      change: 4.4,
      changePercent: 0.48,
      finalPrice: 912.0,
      finalQuantity: 478351,
      valueCrores: 43.63,
      ffmCapCrores: 1013682.82,
      nm52wH: 1880.0,
      nm52wL: 1605.5,
    },
    {
      symbol: "NESTLEIND",
      prevClose: 1323.4,
      iep: 1339.0,
      change: 5.8,
      changePercent: 0.44,
      finalPrice: 1329.2,
      finalQuantity: 2891,
      valueCrores: 0.38,
      ffmCapCrores: 95038.8,
      nm52wH: 1340.0,
      nm52wL: 1095.55,
    },
    {
      symbol: "RELIANCE",
      prevClose: 1243.8,
      iep: 1248.5,
      change: 4.7,
      changePercent: 0.38,
      finalPrice: 1248.5,
      finalQuantity: 125643,
      valueCrores: 15.69,
      ffmCapCrores: 843762.5,
      nm52wH: 1608.95,
      nm52wL: 1156.0,
    },
    {
      symbol: "SBIN",
      prevClose: 788.55,
      iep: 791.3,
      change: 2.75,
      changePercent: 0.35,
      finalPrice: 791.3,
      finalQuantity: 68421,
      valueCrores: 5.41,
      ffmCapCrores: 705231.45,
      nm52wH: 912.1,
      nm52wL: 680.2,
    },
    {
      symbol: "ICICIBANK",
      prevClose: 1285.4,
      iep: 1289.8,
      change: 4.4,
      changePercent: 0.34,
      finalPrice: 1289.8,
      finalQuantity: 32156,
      valueCrores: 4.15,
      ffmCapCrores: 905432.18,
      nm52wH: 1362.35,
      nm52wL: 1049.5,
    },
    {
      symbol: "LT",
      prevClose: 3542.7,
      iep: 3554.9,
      change: 12.2,
      changePercent: 0.34,
      finalPrice: 3554.9,
      finalQuantity: 4523,
      valueCrores: 1.61,
      ffmCapCrores: 487523.6,
      nm52wH: 3963.5,
      nm52wL: 3078.8,
    },
    {
      symbol: "KOTAKBANK",
      prevClose: 1956.3,
      iep: 1962.5,
      change: 6.2,
      changePercent: 0.32,
      finalPrice: 1962.5,
      finalQuantity: 8745,
      valueCrores: 1.72,
      ffmCapCrores: 389456.72,
      nm52wH: 2145.0,
      nm52wL: 1660.0,
    },
    {
      symbol: "AXISBANK",
      prevClose: 1178.9,
      iep: 1182.4,
      change: 3.5,
      changePercent: 0.3,
      finalPrice: 1182.4,
      finalQuantity: 15632,
      valueCrores: 1.85,
      ffmCapCrores: 365478.9,
      nm52wH: 1340.0,
      nm52wL: 995.4,
    },
    {
      symbol: "BHARTIARTL",
      prevClose: 1725.6,
      iep: 1729.8,
      change: 4.2,
      changePercent: 0.24,
      finalPrice: 1729.8,
      finalQuantity: 22345,
      valueCrores: 3.86,
      ffmCapCrores: 1042563.8,
      nm52wH: 1779.0,
      nm52wL: 1265.5,
    },
    {
      symbol: "TITAN",
      prevClose: 3456.2,
      iep: 3462.8,
      change: 6.6,
      changePercent: 0.19,
      finalPrice: 3462.8,
      finalQuantity: 3421,
      valueCrores: 1.18,
      ffmCapCrores: 307412.56,
      nm52wH: 3887.0,
      nm52wL: 3055.0,
    },
    {
      symbol: "ULTRACEMCO",
      prevClose: 11234.5,
      iep: 11245.7,
      change: 11.2,
      changePercent: 0.1,
      finalPrice: 11245.7,
      finalQuantity: 1245,
      valueCrores: 1.4,
      ffmCapCrores: 324567.89,
      nm52wH: 12098.0,
      nm52wL: 9340.0,
    },
    {
      symbol: "SUNPHARMA",
      prevClose: 1856.4,
      iep: 1857.9,
      change: 1.5,
      changePercent: 0.08,
      finalPrice: 1857.9,
      finalQuantity: 5632,
      valueCrores: 1.05,
      ffmCapCrores: 445678.3,
      nm52wH: 1960.0,
      nm52wL: 1478.0,
    },
    {
      symbol: "ASIANPAINT",
      prevClose: 2287.3,
      iep: 2285.6,
      change: -1.7,
      changePercent: -0.07,
      finalPrice: 2285.6,
      finalQuantity: 4521,
      valueCrores: 1.03,
      ffmCapCrores: 219345.67,
      nm52wH: 3395.0,
      nm52wL: 2185.0,
    },
    {
      symbol: "HINDUNILVR",
      prevClose: 2345.8,
      iep: 2342.1,
      change: -3.7,
      changePercent: -0.16,
      finalPrice: 2342.1,
      finalQuantity: 6234,
      valueCrores: 1.46,
      ffmCapCrores: 550234.56,
      nm52wH: 2770.0,
      nm52wL: 2172.05,
    },
    {
      symbol: "TECHM",
      prevClose: 1678.9,
      iep: 1674.3,
      change: -4.6,
      changePercent: -0.27,
      finalPrice: 1674.3,
      finalQuantity: 7856,
      valueCrores: 1.31,
      ffmCapCrores: 163456.78,
      nm52wH: 1808.0,
      nm52wL: 1262.0,
    },
    {
      symbol: "POWERGRID",
      prevClose: 312.5,
      iep: 311.4,
      change: -1.1,
      changePercent: -0.35,
      finalPrice: 311.4,
      finalQuantity: 34521,
      valueCrores: 1.07,
      ffmCapCrores: 217834.56,
      nm52wH: 366.2,
      nm52wL: 256.8,
    },
    {
      symbol: "NTPC",
      prevClose: 356.7,
      iep: 355.2,
      change: -1.5,
      changePercent: -0.42,
      finalPrice: 355.2,
      finalQuantity: 45632,
      valueCrores: 1.62,
      ffmCapCrores: 345123.9,
      nm52wH: 417.45,
      nm52wL: 310.0,
    },
    {
      symbol: "ONGC",
      prevClose: 245.8,
      iep: 244.3,
      change: -1.5,
      changePercent: -0.61,
      finalPrice: 244.3,
      finalQuantity: 52345,
      valueCrores: 1.28,
      ffmCapCrores: 308456.78,
      nm52wH: 345.0,
      nm52wL: 222.3,
    },
    {
      symbol: "COALINDIA",
      prevClose: 478.9,
      iep: 475.6,
      change: -3.3,
      changePercent: -0.69,
      finalPrice: 475.6,
      finalQuantity: 23456,
      valueCrores: 1.12,
      ffmCapCrores: 293567.8,
      nm52wH: 543.55,
      nm52wL: 390.0,
    },
    {
      symbol: "BPCL",
      prevClose: 612.4,
      iep: 607.1,
      change: -5.3,
      changePercent: -0.87,
      finalPrice: 607.1,
      finalQuantity: 18745,
      valueCrores: 1.14,
      ffmCapCrores: 132456.78,
      nm52wH: 726.0,
      nm52wL: 540.0,
    },
  ],
  "NIFTY BANK": [
    {
      symbol: "HDFCBANK",
      prevClose: 907.8,
      iep: 911.4,
      change: 4.4,
      changePercent: 0.48,
      finalPrice: 912.0,
      finalQuantity: 478351,
      valueCrores: 43.63,
      ffmCapCrores: 1013682.82,
      nm52wH: 1880.0,
      nm52wL: 1605.5,
    },
    {
      symbol: "ICICIBANK",
      prevClose: 1285.4,
      iep: 1289.8,
      change: 4.4,
      changePercent: 0.34,
      finalPrice: 1289.8,
      finalQuantity: 32156,
      valueCrores: 4.15,
      ffmCapCrores: 905432.18,
      nm52wH: 1362.35,
      nm52wL: 1049.5,
    },
    {
      symbol: "KOTAKBANK",
      prevClose: 1956.3,
      iep: 1962.5,
      change: 6.2,
      changePercent: 0.32,
      finalPrice: 1962.5,
      finalQuantity: 8745,
      valueCrores: 1.72,
      ffmCapCrores: 389456.72,
      nm52wH: 2145.0,
      nm52wL: 1660.0,
    },
    {
      symbol: "AXISBANK",
      prevClose: 1178.9,
      iep: 1182.4,
      change: 3.5,
      changePercent: 0.3,
      finalPrice: 1182.4,
      finalQuantity: 15632,
      valueCrores: 1.85,
      ffmCapCrores: 365478.9,
      nm52wH: 1340.0,
      nm52wL: 995.4,
    },
    {
      symbol: "SBIN",
      prevClose: 788.55,
      iep: 791.3,
      change: 2.75,
      changePercent: 0.35,
      finalPrice: 791.3,
      finalQuantity: 68421,
      valueCrores: 5.41,
      ffmCapCrores: 705231.45,
      nm52wH: 912.1,
      nm52wL: 680.2,
    },
    {
      symbol: "INDUSINDBK",
      prevClose: 1423.6,
      iep: 1428.9,
      change: 5.3,
      changePercent: 0.37,
      finalPrice: 1428.9,
      finalQuantity: 9876,
      valueCrores: 1.41,
      ffmCapCrores: 110234.56,
      nm52wH: 1694.5,
      nm52wL: 1180.0,
    },
    {
      symbol: "BANDHANBNK",
      prevClose: 198.4,
      iep: 197.6,
      change: -0.8,
      changePercent: -0.4,
      finalPrice: 197.6,
      finalQuantity: 34521,
      valueCrores: 0.68,
      ffmCapCrores: 31978.45,
      nm52wH: 263.1,
      nm52wL: 167.35,
    },
    {
      symbol: "FEDERALBNK",
      prevClose: 162.3,
      iep: 163.1,
      change: 0.8,
      changePercent: 0.49,
      finalPrice: 163.1,
      finalQuantity: 45231,
      valueCrores: 0.74,
      ffmCapCrores: 39856.78,
      nm52wH: 178.55,
      nm52wL: 138.6,
    },
    {
      symbol: "IDFCFIRSTB",
      prevClose: 78.9,
      iep: 78.45,
      change: -0.45,
      changePercent: -0.57,
      finalPrice: 78.45,
      finalQuantity: 123456,
      valueCrores: 0.97,
      ffmCapCrores: 52345.67,
      nm52wH: 98.0,
      nm52wL: 62.5,
    },
    {
      symbol: "PNB",
      prevClose: 105.6,
      iep: 106.2,
      change: 0.6,
      changePercent: 0.57,
      finalPrice: 106.2,
      finalQuantity: 87654,
      valueCrores: 0.93,
      ffmCapCrores: 116789.34,
      nm52wH: 142.9,
      nm52wL: 88.0,
    },
    {
      symbol: "AUBANK",
      prevClose: 645.8,
      iep: 648.3,
      change: 2.5,
      changePercent: 0.39,
      finalPrice: 648.3,
      finalQuantity: 5432,
      valueCrores: 0.35,
      ffmCapCrores: 48234.56,
      nm52wH: 782.0,
      nm52wL: 540.0,
    },
    {
      symbol: "BANKBARODA",
      prevClose: 245.3,
      iep: 246.8,
      change: 1.5,
      changePercent: 0.61,
      finalPrice: 246.8,
      finalQuantity: 56789,
      valueCrores: 1.4,
      ffmCapCrores: 127345.67,
      nm52wH: 299.7,
      nm52wL: 202.0,
    },
  ],
  "NIFTY IT": [
    {
      symbol: "INFY",
      prevClose: 1290.1,
      iep: 1305.5,
      change: 15.4,
      changePercent: 1.19,
      finalPrice: 1305.5,
      finalQuantity: 135695,
      valueCrores: 17.74,
      ffmCapCrores: 456028.53,
      nm52wH: 1778.45,
      nm52wL: 1284.1,
    },
    {
      symbol: "TCS",
      prevClose: 2629.3,
      iep: 2655.0,
      change: 20.7,
      changePercent: 0.79,
      finalPrice: 2655.0,
      finalQuantity: 5930,
      valueCrores: 3.76,
      ffmCapCrores: 228855.22,
      nm52wH: 4592.25,
      nm52wL: 2561.3,
    },
    {
      symbol: "HCLTECH",
      prevClose: 1378.2,
      iep: 1391.0,
      change: 12.8,
      changePercent: 0.93,
      finalPrice: 1391.0,
      finalQuantity: 12934,
      valueCrores: 1.8,
      ffmCapCrores: 148364.12,
      nm52wH: 1780.1,
      nm52wL: 1302.75,
    },
    {
      symbol: "WIPRO",
      prevClose: 201.92,
      iep: 203.71,
      change: 1.79,
      changePercent: 0.89,
      finalPrice: 203.71,
      finalQuantity: 55056,
      valueCrores: 1.12,
      ffmCapCrores: 58008.58,
      nm52wH: 307.7,
      nm52wL: 109.12,
    },
    {
      symbol: "TECHM",
      prevClose: 1678.9,
      iep: 1674.3,
      change: -4.6,
      changePercent: -0.27,
      finalPrice: 1674.3,
      finalQuantity: 7856,
      valueCrores: 1.31,
      ffmCapCrores: 163456.78,
      nm52wH: 1808.0,
      nm52wL: 1262.0,
    },
    {
      symbol: "LTIM",
      prevClose: 5634.5,
      iep: 5652.3,
      change: 17.8,
      changePercent: 0.32,
      finalPrice: 5652.3,
      finalQuantity: 2345,
      valueCrores: 1.33,
      ffmCapCrores: 167234.56,
      nm52wH: 6430.0,
      nm52wL: 4680.0,
    },
    {
      symbol: "PERSISTENT",
      prevClose: 5123.4,
      iep: 5098.7,
      change: -24.7,
      changePercent: -0.48,
      finalPrice: 5098.7,
      finalQuantity: 1234,
      valueCrores: 0.63,
      ffmCapCrores: 39234.56,
      nm52wH: 6250.0,
      nm52wL: 3920.0,
    },
    {
      symbol: "COFORGE",
      prevClose: 5678.9,
      iep: 5695.4,
      change: 16.5,
      changePercent: 0.29,
      finalPrice: 5695.4,
      finalQuantity: 876,
      valueCrores: 0.5,
      ffmCapCrores: 35456.78,
      nm52wH: 7200.0,
      nm52wL: 4580.0,
    },
    {
      symbol: "MPHASIS",
      prevClose: 2345.6,
      iep: 2338.9,
      change: -6.7,
      changePercent: -0.29,
      finalPrice: 2338.9,
      finalQuantity: 2345,
      valueCrores: 0.55,
      ffmCapCrores: 44123.45,
      nm52wH: 2910.0,
      nm52wL: 2050.0,
    },
    {
      symbol: "LTTS",
      prevClose: 4890.3,
      iep: 4905.6,
      change: 15.3,
      changePercent: 0.31,
      finalPrice: 4905.6,
      finalQuantity: 1567,
      valueCrores: 0.77,
      ffmCapCrores: 51678.9,
      nm52wH: 5430.0,
      nm52wL: 4120.0,
    },
  ],
};

type Denomination = "lakhs" | "crores" | "billions";

export default function PreOpenPage() {
  const [selectedCategory, setSelectedCategory] = useState("NIFTY 50");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [denomination, setDenomination] = useState<Denomination>("crores");

  const currentData = useMemo(() => {
    const data = preOpenData[selectedCategory] || preOpenData["NIFTY 50"];
    if (!symbolSearch.trim()) return data;
    return data.filter((s) =>
      s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()),
    );
  }, [selectedCategory, symbolSearch]);

  const formatValue = (valueCrores: number): string => {
    switch (denomination) {
      case "lakhs":
        return (valueCrores * 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "crores":
        return valueCrores.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "billions":
        return (valueCrores / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      default:
        return valueCrores.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    }
  };

  const denominationLabel =
    denomination === "lakhs"
      ? "Lakhs"
      : denomination === "crores"
        ? "Crores"
        : "Billions";

  const handleDownloadCSV = () => {
    const headers = [
      "Symbol",
      "Prev. Close",
      "IEP",
      "Chng",
      "%Chng",
      "Final",
      "Final Quantity",
      `Value (${denominationLabel})`,
      `FFM Cap (${denominationLabel})`,
      "NM 52W H",
      "NM 52W L",
    ];
    const rows = currentData.map((s) => [
      s.symbol,
      s.prevClose.toFixed(2),
      s.iep.toFixed(2),
      s.change.toFixed(2),
      s.changePercent.toFixed(2),
      s.finalPrice.toFixed(2),
      s.finalQuantity.toString(),
      formatValue(s.valueCrores),
      formatValue(s.ffmCapCrores),
      s.nm52wH.toFixed(2),
      s.nm52wL.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-open-${selectedCategory.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <UnofficialSourceBadge label="Demo data — not a live feed. Pre-open auction data (IEP) is only exposed live via NSE's protected API, which is blocked from this build's network." />
          {}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30">
              <Clock className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pre Open Market
              </h1>
              <p className="text-sm text-muted-foreground">
                Pre-market session data with indicative equilibrium prices
              </p>
            </div>
          </div>

          {}
          <div className="bg-background border border-border rounded-xl p-4 mb-4 shadow-luxury">
            <div className="flex flex-wrap items-center gap-4">
              {}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Symbol
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter symbol"
                    value={symbolSearch}
                    onChange={(e) => setSymbolSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
                  />
                </div>
                {symbolSearch && (
                  <button
                    onClick={() => setSymbolSearch("")}
                    className="px-3 py-1.5 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {}
              <button
                onClick={handleDownloadCSV}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download (.csv)
              </button>
            </div>

            {}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <span className="text-sm font-medium text-muted-foreground">
                Change denomination
              </span>
              {(["lakhs", "crores", "billions"] as Denomination[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDenomination(d)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    denomination === d
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="bg-background border border-border rounded-xl overflow-hidden shadow-luxury">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-primary">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Prev. Close
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      IEP
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Chng
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      %Chng
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                      Final
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      Final Quantity
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      Value ({denominationLabel})
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      FFM Cap ({denominationLabel})
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      NM 52W H
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-primary-foreground uppercase tracking-wider whitespace-nowrap">
                      NM 52W L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentData.map((stock, i) => (
                    <motion.tr
                      key={stock.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-secondary/50 transition-colors group"
                    >
                      <td className="px-3 py-2">
                        <span className="text-sm font-semibold text-primary group-hover:underline cursor-pointer">
                          {stock.symbol}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {stock.prevClose.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-foreground text-right font-mono">
                        {stock.iep.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono">
                        <span
                          className={`font-semibold ${stock.change >= 0 ? "text-success" : "text-error"}`}
                        >
                          {stock.change >= 0 ? "+" : ""}
                          {stock.change.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            stock.changePercent >= 0
                              ? "bg-success/10 text-success"
                              : "bg-error/10 text-error"
                          }`}
                        >
                          {stock.changePercent >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 mr-1" />
                          )}
                          {stock.changePercent >= 0 ? "+" : ""}
                          {stock.changePercent.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-foreground text-right font-mono">
                        {stock.finalPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {stock.finalQuantity.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {formatValue(stock.valueCrores)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {formatValue(stock.ffmCapCrores)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {stock.nm52wH.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-right font-mono">
                        {stock.nm52wL.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {currentData.length} stocks for {selectedCategory}
            </span>
            <span>Values in {denominationLabel}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
