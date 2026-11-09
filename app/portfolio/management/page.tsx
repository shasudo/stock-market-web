"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/common";
import { motion } from "framer-motion";
import { PieChart, Save, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import toast from "react-hot-toast";
import apiClient, {
  getAxiosErrorMessage,
  getApiResponseMessage,
  isRecord,
  isSuccessfulApiResponse,
  type ApiSuccessResponse,
} from "@/lib/api-client";
import { logger, serializeError } from "@/lib/logger";

const MARKET_CONDITIONS = [
  "Bull Market",
  "Bullish to Bearish",
  "Side Ways Market",
  "Bear Market",
  "Bearish to Bullish",
] as const;

type MarketCondition = (typeof MARKET_CONDITIONS)[number];

const DEFAULT_STRATEGIES = [
  "Intraday Trading",
  "F&O Trading",
  "Swing Trading",
  "Positional Trading",
  "Multi Bagger Stocks",
  "Index Funds (ETFs)",
  "Gold ETFs",
  "Emergency Fund (6M - 1Y)",
  "Free Cash",
];

interface Strategy {
  _clientId: string;
  name: string;
  allocationPercent: number;
  allocationRupees: number;
  usedFunds: number;
  unusedFunds: number;
}

interface ExperienceNote {
  _clientId: string;
  positive: string;
  negative: string;
}

interface PersistedStrategy {
  readonly name: string;
  readonly allocationPercent: number;
  readonly allocationRupees: number;
  readonly usedFunds: number;
  readonly unusedFunds: number;
}

interface PersistedExperienceNote {
  readonly positive: string;
  readonly negative: string;
}

interface PortfolioData {
  readonly totalCapital: number;
  readonly strategies: PersistedStrategy[];
  readonly experienceNotes: PersistedExperienceNote[];
}

interface PortfolioResponseData {
  readonly portfolio: PortfolioData | null;
}

interface PortfolioUpdateRequest {
  readonly marketCondition: MarketCondition;
  readonly totalCapital: number;
  readonly strategies: Omit<Strategy, "_clientId">[];
  readonly experienceNotes: Omit<ExperienceNote, "_clientId">[];
}

function isPersistedStrategy(value: unknown): value is PersistedStrategy {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.allocationPercent === "number" &&
    typeof value.allocationRupees === "number" &&
    typeof value.usedFunds === "number" &&
    typeof value.unusedFunds === "number"
  );
}

function isPersistedExperienceNote(
  value: unknown,
): value is PersistedExperienceNote {
  return (
    isRecord(value) &&
    typeof value.positive === "string" &&
    typeof value.negative === "string"
  );
}

function isPortfolioData(value: unknown): value is PortfolioData {
  return (
    isRecord(value) &&
    typeof value.totalCapital === "number" &&
    Array.isArray(value.strategies) &&
    value.strategies.every(isPersistedStrategy) &&
    Array.isArray(value.experienceNotes) &&
    value.experienceNotes.every(isPersistedExperienceNote)
  );
}

function isPortfolioResponse(
  value: unknown,
): value is ApiSuccessResponse<PortfolioResponseData> {
  return (
    isSuccessfulApiResponse(value) &&
    isRecord(value.data) &&
    (value.data.portfolio === null || isPortfolioData(value.data.portfolio))
  );
}

type PortfolioRequestResult =
  | { readonly status: "success"; readonly portfolio: PortfolioData | null }
  | { readonly status: "invalid-response" };

async function requestPortfolio(
  marketCondition: MarketCondition,
): Promise<PortfolioRequestResult> {
  const response = await apiClient.get<unknown>(
    `/api/portfolio?marketCondition=${encodeURIComponent(marketCondition)}`,
  );

  if (!isPortfolioResponse(response.data)) {
    return { status: "invalid-response" };
  }

  return { status: "success", portfolio: response.data.data.portfolio };
}

let clientIdCounter = 0;
function generateClientId(): string {
  return `s_${Date.now()}_${clientIdCounter++}`;
}

function makeStrategy(data?: Partial<Omit<Strategy, "_clientId">>): Strategy {
  return {
    _clientId: generateClientId(),
    name: data?.name ?? "",
    allocationPercent: data?.allocationPercent ?? 0,
    allocationRupees: data?.allocationRupees ?? 0,
    usedFunds: data?.usedFunds ?? 0,
    unusedFunds: data?.unusedFunds ?? 0,
  };
}

function createDefaultStrategies(): Strategy[] {
  return DEFAULT_STRATEGIES.map((name) => makeStrategy({ name }));
}

function makeExperienceNote(
  data?: Partial<Omit<ExperienceNote, "_clientId">>,
): ExperienceNote {
  return {
    _clientId: generateClientId(),
    positive: data?.positive ?? "",
    negative: data?.negative ?? "",
  };
}

function NumberInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: number;
  onChange: (value: number) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = isFocused
    ? (draftValue ?? String(value))
    : String(value);

  return (
    <input
      type="number"
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value;
        setDraftValue(raw);
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          onChange(num);
        } else if (raw === "" || raw === "-") {
          onChange(0);
        }
      }}
      onFocus={() => {
        setDraftValue(String(value));
        setIsFocused(true);
      }}
      onBlur={() => {
        const parsedValue = parseFloat(displayValue);
        setIsFocused(false);
        setDraftValue(null);
        if (isNaN(parsedValue) || displayValue === "") {
          onChange(0);
        } else {
          onChange(parsedValue);
        }
      }}
      className={className}
      {...props}
    />
  );
}

export default function PortfolioManagementPage() {
  return (
    <AuthGuard loadingMessage="Loading portfolio management...">
      <PortfolioManagementContent />
    </AuthGuard>
  );
}

function PortfolioManagementContent() {
  const [activeTab, setActiveTab] = useState<MarketCondition>(
    MARKET_CONDITIONS[0],
  );
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [experienceNotes, setExperienceNotes] = useState<ExperienceNote[]>([]);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [totalCapital, setTotalCapital] = useState<number>(100000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void requestPortfolio(activeTab)
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        if (result.status === "invalid-response") {
          logger.warn("Received an invalid portfolio response");
          toast.error("Received an invalid portfolio response");
          setStrategies(createDefaultStrategies());
          setExperienceNotes([]);
          return;
        }

        const { portfolio } = result;
        if (portfolio !== null && portfolio.strategies.length > 0) {
          setStrategies(
            portfolio.strategies.map((strategy) =>
              makeStrategy({
                name: strategy.name,
                allocationPercent: strategy.allocationPercent || 0,
                allocationRupees: strategy.allocationRupees || 0,
                usedFunds: strategy.usedFunds || 0,
                unusedFunds: strategy.unusedFunds || 0,
              }),
            ),
          );
          if (portfolio.totalCapital > 0) {
            setTotalCapital(portfolio.totalCapital);
          }
          if (portfolio.experienceNotes.length > 0) {
            setExperienceNotes(
              portfolio.experienceNotes.map((note) =>
                makeExperienceNote({
                  positive: note.positive || "",
                  negative: note.negative || "",
                }),
              ),
            );
          } else {
            setExperienceNotes([]);
          }
          return;
        }

        setStrategies(createDefaultStrategies());
        setExperienceNotes([]);
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        logger.error("Failed to fetch portfolio data", {
          error: serializeError(error),
        });
        toast.error("Failed to load portfolio data");
        setStrategies(createDefaultStrategies());
        setExperienceNotes([]);
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeTab]);

  const handleMarketConditionChange = (
    marketCondition: MarketCondition,
  ): void => {
    if (marketCondition === activeTab) {
      return;
    }

    setLoading(true);
    setActiveTab(marketCondition);
  };

  const handleTotalCapitalChange = (newTotal: number) => {
    setTotalCapital(newTotal);
    setStrategies((prev) =>
      prev.map((s) => {
        const newRupees =
          newTotal > 0 ? (newTotal * s.allocationPercent) / 100 : 0;
        return {
          ...s,
          allocationRupees: newRupees,
          unusedFunds: newRupees - s.usedFunds,
        };
      }),
    );
  };

  const handleStrategyChange = (
    index: number,
    field: keyof Omit<Strategy, "_clientId">,
    value: string | number,
  ) => {
    setStrategies((prev) => {
      const newStrategies = [...prev];
      const strategy = { ...newStrategies[index] };

      if (field === "name") {
        if (typeof value !== "string") {
          return prev;
        }

        strategy.name = value;
      } else {
        const numValue =
          typeof value === "number" ? value : parseFloat(value) || 0;

        if (field === "allocationPercent") {
          strategy.allocationPercent = numValue;
          strategy.allocationRupees = (totalCapital * numValue) / 100;
          strategy.unusedFunds = strategy.allocationRupees - strategy.usedFunds;
        } else if (field === "allocationRupees") {
          strategy.allocationRupees = numValue;
          strategy.allocationPercent =
            totalCapital > 0 ? (numValue / totalCapital) * 100 : 0;
          strategy.unusedFunds = numValue - strategy.usedFunds;
        } else if (field === "usedFunds") {
          strategy.usedFunds = numValue;
          strategy.unusedFunds = strategy.allocationRupees - numValue;
        }
      }

      newStrategies[index] = strategy;
      return newStrategies;
    });
  };

  const handleAddStrategy = () => {
    setStrategies((prev) => [...prev, makeStrategy()]);
  };

  const handleDeleteStrategy = (index: number) => {
    setStrategies((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    return strategies.reduce(
      (acc, s) => ({
        percent: acc.percent + (s.allocationPercent || 0),
        rupees: acc.rupees + (s.allocationRupees || 0),
        used: acc.used + (s.usedFunds || 0),
        unused: acc.unused + (s.unusedFunds || 0),
      }),
      { percent: 0, rupees: 0, used: 0, unused: 0 },
    );
  };

  const totals = calculateTotals();

  const createPortfolioUpdateRequest = (): PortfolioUpdateRequest => ({
    marketCondition: activeTab,
    totalCapital,
    strategies: strategies.map((strategy) => ({
      name: strategy.name.trim(),
      allocationPercent: strategy.allocationPercent || 0,
      allocationRupees: strategy.allocationRupees || 0,
      usedFunds: strategy.usedFunds || 0,
      unusedFunds: strategy.unusedFunds || 0,
    })),
    experienceNotes: experienceNotes.map((note) => ({
      positive: note.positive,
      negative: note.negative,
    })),
  });

  const handleSave = async () => {
    const emptyNames = strategies.filter((s) => !s.name.trim());
    if (emptyNames.length > 0) {
      toast.error("All strategies must have a name");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.put<unknown>(
        "/api/portfolio",
        createPortfolioUpdateRequest(),
      );
      if (!isSuccessfulApiResponse(response.data)) {
        toast.error(
          getApiResponseMessage(response.data, "Failed to save portfolio"),
        );
        return;
      }

      toast.success("Portfolio saved successfully");
    } catch (error: unknown) {
      logger.error("Failed to save portfolio data", {
        error: serializeError(error),
      });
      toast.error(getAxiosErrorMessage(error, "Failed to save portfolio"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddExperienceNote = () => {
    setExperienceNotes((prev) => [...prev, makeExperienceNote()]);
    setEditingNoteIndex(experienceNotes.length);
  };

  const handleDeleteExperienceNote = (index: number) => {
    setExperienceNotes((prev) => prev.filter((_, i) => i !== index));
    if (editingNoteIndex === index) setEditingNoteIndex(null);
    else if (editingNoteIndex !== null && editingNoteIndex > index) {
      setEditingNoteIndex(editingNoteIndex - 1);
    }
  };

  const handleExperienceNoteChange = (
    index: number,
    field: "positive" | "negative",
    value: string,
  ) => {
    setExperienceNotes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const response = await apiClient.put<unknown>(
        "/api/portfolio",
        createPortfolioUpdateRequest(),
      );
      if (!isSuccessfulApiResponse(response.data)) {
        toast.error(
          getApiResponseMessage(response.data, "Failed to save notes"),
        );
        return;
      }

      setEditingNoteIndex(null);
      toast.success("Experience notes saved");
    } catch (error: unknown) {
      logger.error("Failed to save portfolio notes", {
        error: serializeError(error),
      });
      toast.error(getAxiosErrorMessage(error, "Failed to save notes"));
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-6 pb-20">
      <div className="w-full px-4 lg:px-8 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-purple/10 rounded-2xl flex items-center justify-center">
                <PieChart className="w-7 h-7 text-violet-500" />
              </div>
              <div>
                <h1
                  className={`text-3xl md:text-4xl font-display font-bold ${
                    activeTab === "Bull Market"
                      ? "text-[#00FF00]"
                      : activeTab === "Bullish to Bearish"
                        ? "text-[#FF00FF]"
                        : activeTab === "Side Ways Market"
                          ? "text-[#FFA500]"
                          : activeTab === "Bear Market"
                            ? "text-[#FF0000]"
                            : activeTab === "Bearish to Bullish"
                              ? "text-[#0000FF]"
                              : "text-foreground"
                  }`}
                >
                  Portfolio Management
                </h1>
                <p
                  className={`mt-1 font-semibold ${
                    activeTab === "Bull Market"
                      ? "text-[#00FF00]"
                      : activeTab === "Bullish to Bearish"
                        ? "text-[#FF00FF]"
                        : activeTab === "Side Ways Market"
                          ? "text-[#FFA500]"
                          : activeTab === "Bear Market"
                            ? "text-[#FF0000]"
                            : activeTab === "Bearish to Bullish"
                              ? "text-[#0000FF]"
                              : "text-muted-foreground"
                  }`}
                >
                  Keep Rebalancing Your Portfolio Actively
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <label className="text-sm text-muted-foreground mb-1">
                  Total Funds (Rs)
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <NumberInput
                    value={totalCapital}
                    onChange={handleTotalCapitalChange}
                    min={0}
                    className="pl-9 pr-4 py-2 w-40 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </motion.div>

        {}
        <div className="w-full mb-8 overflow-x-auto pb-2">
          <div className="flex w-full border border-border/50 divide-x divide-border">
            {MARKET_CONDITIONS.map((tab) => {
              const isActive = activeTab === tab;

              let textColorClass = "text-muted-foreground";
              let activeClass = "";

              if (tab === "Bull Market") {
                textColorClass = isActive
                  ? "text-[#00FF00] font-bold"
                  : "text-[#00FF00]/70";
                activeClass = isActive ? "bg-[#00FF00]/10" : "bg-muted";
              } else if (tab === "Bullish to Bearish") {
                textColorClass = isActive
                  ? "text-[#FF00FF] font-bold"
                  : "text-[#FF00FF]/70";
                activeClass = isActive ? "bg-[#FF00FF]/10" : "bg-muted";
              } else if (tab === "Side Ways Market") {
                textColorClass = isActive
                  ? "text-[#FFA500] font-bold"
                  : "text-[#FFA500]/70";
                activeClass = isActive ? "bg-[#FFA500]/10" : "bg-muted";
              } else if (tab === "Bear Market") {
                textColorClass = isActive
                  ? "text-[#FF0000] font-bold"
                  : "text-[#FF0000]/70";
                activeClass = isActive ? "bg-[#FF0000]/10" : "bg-muted";
              } else if (tab === "Bearish to Bullish") {
                textColorClass = isActive
                  ? "text-[#0000FF] font-bold"
                  : "text-[#0000FF]/70";
                activeClass = isActive ? "bg-[#0000FF]/10" : "bg-muted";
              }

              return (
                <button
                  key={tab}
                  onClick={() => handleMarketConditionChange(tab)}
                  className={`
                    flex-1 px-4 py-3 text-sm transition-all duration-200 border-b-2
                    ${activeClass}
                    ${textColorClass}
                    ${isActive ? "border-primary shadow-sm" : "border-transparent hover:bg-muted"}
                  `}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
            <h2 className="text-xl font-bold text-center w-full">
              Total Funds Rs {totalCapital.toLocaleString("en-IN")}
            </h2>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="finder-row bg-card hover:bg-primary/10 border-b border-border/80">
                <TableHead className="w-[30%] text-foreground font-bold border-r border-black">
                  Following Strategies
                </TableHead>
                <TableHead
                  className="text-left text-foreground font-bold border-r border-black"
                  colSpan={2}
                >
                  <div className="text-center border-b border-black w-full pb-1 mb-1">
                    Allocation of Funds
                  </div>
                  <div className="flex justify-between px-2">
                    <span>In %</span>
                    <span>In Rupees</span>
                  </div>
                </TableHead>
                <TableHead className="text-right text-foreground font-bold border-r border-black">
                  Used Funds Rs
                </TableHead>
                <TableHead className="text-right text-foreground font-bold text-nowrap">
                  Un Used Funds Rs
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-48 text-center text-muted-foreground"
                  >
                    Loading strategies...
                  </TableCell>
                </TableRow>
              ) : strategies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-48 text-center text-muted-foreground"
                  >
                    No strategies yet. Click &quot;+ Add Strategy&quot; below to
                    get started.
                  </TableCell>
                </TableRow>
              ) : (
                strategies.map((strategy, index) => (
                  <TableRow
                    key={strategy._clientId}
                    className="border-b border-border hover:bg-muted/5"
                  >
                    <TableCell className="font-medium border-r border-border py-1">
                      <div className="flex items-center">
                        <span className="mr-2 text-muted-foreground font-normal">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={strategy.name}
                          onChange={(e) =>
                            handleStrategyChange(index, "name", e.target.value)
                          }
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-medium"
                          placeholder="Strategy Name"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right border-r border-border py-1 w-[10%]">
                      <NumberInput
                        min={0}
                        max={100}
                        step={0.1}
                        value={strategy.allocationPercent}
                        onChange={(val) =>
                          handleStrategyChange(index, "allocationPercent", val)
                        }
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-ring rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right border-r border-border py-1 w-[15%]">
                      <NumberInput
                        min={0}
                        value={strategy.allocationRupees}
                        onChange={(val) =>
                          handleStrategyChange(index, "allocationRupees", val)
                        }
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-ring rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right border-r border-border py-1 w-[15%]">
                      <NumberInput
                        min={0}
                        value={strategy.usedFunds}
                        onChange={(val) =>
                          handleStrategyChange(index, "usedFunds", val)
                        }
                        className="w-full text-right bg-transparent focus:bg-background focus:ring-1 focus:ring-ring rounded px-1"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground py-1 w-[15%]">
                      {Math.round(strategy.unusedFunds).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="py-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteStrategy(index)}
                      >
                        <span className="sr-only">Delete</span>
                        &times;
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter className="bg-muted/90 font-bold border-t border-border">
              <TableRow>
                <TableCell className="border-r border-black">Total</TableCell>
                <TableCell
                  className="text-right border-r border-black"
                  colSpan={1}
                >
                  {Math.round(totals.percent * 100) / 100}%
                </TableCell>
                <TableCell className="text-right border-r border-black">
                  {Math.round(totals.rupees).toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-right border-r border-black">
                  {Math.round(totals.used).toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-right">
                  {Math.round(totals.unused).toLocaleString("en-IN")}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <div className="p-4 border-t border-border flex justify-center">
            <Button
              onClick={handleAddStrategy}
              variant="outline"
              className="border-dashed"
            >
              + Add Strategy
            </Button>
          </div>
        </div>

        {}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
            <h2 className="text-xl font-bold text-center flex-1 text-yellow-500">
              Note Down the Experience Time to Time
            </h2>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="bg-violet-600 hover:bg-violet-700 ml-4"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingNotes ? "Saving..." : "Save"}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="finder-row bg-card hover:bg-primary/10 border-b border-border/80">
                <TableHead className="w-1/2 text-center text-green-500 font-bold border-r border-black">
                  Positives
                </TableHead>
                <TableHead className="w-1/2 text-center text-red-500 font-bold border-r border-black">
                  Negatives
                </TableHead>
                <TableHead className="w-24 text-center font-bold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : experienceNotes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No experience notes yet. Click &quot;Add Points&quot; below.
                  </TableCell>
                </TableRow>
              ) : (
                experienceNotes.map((note, index) => {
                  const isEditing = editingNoteIndex === index;
                  return (
                    <TableRow
                      key={note._clientId}
                      className="border-b border-border hover:bg-muted/5"
                    >
                      <TableCell className="border-r border-border py-2 align-top">
                        {isEditing ? (
                          <textarea
                            value={note.positive}
                            onChange={(e) =>
                              handleExperienceNoteChange(
                                index,
                                "positive",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none min-h-[60px]"
                            placeholder="Write positive experience..."
                          />
                        ) : (
                          <p className="px-2 py-1 whitespace-pre-wrap">
                            {note.positive || (
                              <span className="text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border py-2 align-top">
                        {isEditing ? (
                          <textarea
                            value={note.negative}
                            onChange={(e) =>
                              handleExperienceNoteChange(
                                index,
                                "negative",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none min-h-[60px]"
                            placeholder="Write negative experience..."
                          />
                        ) : (
                          <p className="px-2 py-1 whitespace-pre-wrap">
                            {note.negative || (
                              <span className="text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center align-top">
                        <div className="flex flex-col gap-1 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary hover:bg-primary/10 h-7 px-2"
                            onClick={() =>
                              setEditingNoteIndex(isEditing ? null : index)
                            }
                          >
                            {isEditing ? "Done" : "+ Edit"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                            onClick={() => handleDeleteExperienceNote(index)}
                          >
                            Del
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="p-4 border-t border-border flex justify-center">
            <Button
              onClick={handleAddExperienceNote}
              variant="outline"
              className="border-dashed"
            >
              + Add Points
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
