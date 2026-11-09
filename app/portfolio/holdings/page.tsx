"use client";

import { useEffect, useState } from "react";
import { Briefcase, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AuthGuard,
  PageHeader,
  StockActionsMenu,
  SearchInput,
  matchesSearch,
} from "@/components/common";
import apiClient, {
  getApiResponseMessage,
  getAxiosErrorMessage,
  isRecord,
  isSuccessfulApiResponse,
} from "@/lib/api-client";

interface Holding {
  readonly id: string;
  readonly tradingSymbol: string;
  readonly displayName: string;
  readonly quantity: number;
  readonly avgPrice: number;
}

function isHolding(value: unknown): value is Holding {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradingSymbol === "string" &&
    typeof value.displayName === "string" &&
    typeof value.quantity === "number" &&
    typeof value.avgPrice === "number"
  );
}

async function requestHoldings(): Promise<Holding[] | null> {
  const response = await apiClient.get<unknown>("/api/portfolio-holdings");
  if (
    !isSuccessfulApiResponse(response.data) ||
    !isRecord(response.data.data)
  ) {
    return null;
  }

  const holdings = response.data.data.holdings;
  return Array.isArray(holdings) ? holdings.filter(isHolding) : null;
}

function HoldingsContent() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    void requestHoldings()
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded === null) {
          toast.error("Received an invalid holdings response");
          return;
        }
        setHoldings(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          toast.error(getAxiosErrorMessage(error, "Failed to load holdings"));
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const response = await apiClient.delete<unknown>(
        "/api/portfolio-holdings",
        {
          data: { id },
        },
      );

      if (isSuccessfulApiResponse(response.data)) {
        toast.success("Holding removed");
        setHoldings((current) =>
          current.filter((holding) => holding.id !== id),
        );
      } else {
        toast.error(
          getApiResponseMessage(response.data, "Unable to remove holding"),
        );
      }
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, "Failed to remove holding"));
    }
  };

  const visibleHoldings = holdings.filter((holding) =>
    matchesSearch(search, holding.tradingSymbol, holding.displayName),
  );
  // Invested total stays whole-portfolio — a search narrows the rows you are
  // looking at, it does not change what you have invested.
  const totalInvested = holdings.reduce(
    (sum, holding) => sum + holding.quantity * holding.avgPrice,
    0,
  );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8 py-8 md:py-12">
        <PageHeader
          title="Holdings"
          description="Stocks added from any stock's three-dot menu"
          icon={Briefcase}
        >
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Invested
            </p>
            <p className="text-xl font-bold font-mono text-foreground">
              ₹
              {totalInvested.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </PageHeader>

        <div className="mb-4 flex justify-end">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search symbol or company..."
            className="relative w-full sm:w-72"
            inputClassName="w-full rounded-xl border border-border bg-card py-2.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none shadow-xs"
            matchCount={visibleHoldings.length}
            totalCount={holdings.length}
          />
        </div>

        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Avg Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Invested Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      Loading holdings...
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  visibleHoldings.map((holding) => (
                    <motion.tr
                      key={holding.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-muted/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {holding.displayName}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {holding.tradingSymbol}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <StockActionsMenu
                              stock={{
                                symbol: holding.tradingSymbol,
                                name: holding.displayName,
                                ltp: holding.avgPrice,
                              }}
                            />
                            <button
                              onClick={() => void handleDelete(holding.id)}
                              aria-label={`Remove ${holding.tradingSymbol}`}
                              className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-md transition-all"
                              title="Remove holding"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-foreground">
                        {holding.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-foreground">
                        ₹{holding.avgPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-foreground">
                        ₹
                        {(holding.quantity * holding.avgPrice).toLocaleString(
                          "en-IN",
                          { maximumFractionDigits: 2 },
                        )}
                      </td>
                    </motion.tr>
                  ))}
                {!loading && visibleHoldings.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      {search.trim()
                        ? `No holdings match "${search.trim()}".`
                        : "No holdings yet - use the ⋮ menu on any stock to add one."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HoldingsPage() {
  return (
    <AuthGuard loadingMessage="Loading holdings...">
      <HoldingsContent />
    </AuthGuard>
  );
}
