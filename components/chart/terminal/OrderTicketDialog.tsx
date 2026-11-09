"use client";

import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import { formatNumber } from "./ui";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "stop" | "market";

interface OrderTicketDialogProps {
  readonly symbol: string;
  readonly displayName: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  readonly price: number;
  readonly onClose: () => void;
}

/**
 * Paper order ticket behind the chart menu's Buy/Sell/Add order rows.
 * Records into the paper journal (mode "paper", intraday) since the app has
 * no broker execution backend.
 */
export default function OrderTicketDialog({
  symbol,
  displayName,
  side,
  orderType,
  price,
  onClose,
}: OrderTicketDialogProps) {
  const [direction, setDirection] = useState<OrderSide>(side);
  const [type, setType] = useState<OrderType>(orderType);
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(String(price.toFixed(2)));
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const qty = Number(quantity);
    const at = Number(limitPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a quantity above zero.");
      return;
    }
    if (type !== "market" && (!Number.isFinite(at) || at <= 0)) {
      toast.error("Enter a valid price.");
      return;
    }
    setBusy(true);
    try {
      await axios.post(
        "/api/trades",
        {
          mode: "paper",
          tradingType: "intraday",
          instrument: "EQUITY",
          tradingSymbol: symbol,
          sector: "-",
          industry: "-",
          quantity: qty,
          entryPrice: type === "market" ? price : at,
        },
        { withCredentials: true },
      );
      toast.success(
        `Paper ${direction} recorded: ${qty} ${symbol} @ ₹${formatNumber(type === "market" ? price : at)}`,
      );
      onClose();
    } catch {
      toast.error("Could not record the paper trade.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${direction === "buy" ? "Buy" : "Sell"} ${symbol}`}
        className="flex max-h-[84vh] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[16px] font-bold text-foreground">
            {displayName}
          </h2>
          <button
            type="button"
            aria-label="Close order ticket"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["buy", "sell"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={direction === option}
                onClick={() => setDirection(option)}
                className={`rounded-md py-1.5 text-[13px] font-semibold capitalize ${
                  direction === option
                    ? option === "buy"
                      ? "bg-success text-primary-foreground"
                      : "bg-error text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
              Quantity
            </span>
            <input
              aria-label="Order quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
              Order type
            </span>
            <select
              aria-label="Order type"
              value={type}
              onChange={(event) => setType(event.target.value as OrderType)}
              className="rounded border border-border bg-card px-2 py-1.5 text-[13px] outline-none focus:border-primary"
            >
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
              <option value="market">Market</option>
            </select>
          </div>
          {type !== "market" && (
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
                Price
              </span>
              <input
                aria-label="Order price"
                inputMode="decimal"
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-[13px] outline-none focus:border-primary"
              />
            </div>
          )}
          <p className="text-[12px] text-muted-foreground">
            Paper ticket — records into your journal, no broker execution.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-4 py-1.5 text-[13px] text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className={`rounded px-4 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-40 ${
              direction === "buy"
                ? "bg-success hover:bg-success/90"
                : "bg-error hover:bg-error/90"
            }`}
          >
            {busy ? "Placing…" : direction === "buy" ? "Buy" : "Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}
