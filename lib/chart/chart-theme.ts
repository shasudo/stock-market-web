"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_DISPLAY_SETTINGS,
  type ChartDisplaySettings,
} from "./display-settings";

/**
 * Runtime bridge between the app theme contract (`.dark` class + HSL-triplet
 * CSS variables in `app/globals.css`) and lightweight-charts, which needs
 * explicit canvas colors. Dark overrides only apply when the user kept the
 * light default for that field, so explicit chart color choices are honored
 * in both modes.
 */

const TRIPLET = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;

function readVariable(variable: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}

/**
 * Resolve an HSL-triplet theme variable (e.g. `--card: 240 6% 10%`) to an
 * `hsl(...)` color string the canvas accepts. Falls back to the contract
 * value when the variable is unreadable (e.g. before CSS loads).
 */
export function themeHsl(variable: string, fallbackTriplet: string): string {
  const raw = readVariable(variable);
  return `hsl(${TRIPLET.test(raw) ? raw : fallbackTriplet})`;
}

export function isDarkDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Re-renders when the `.dark` class toggles (same source as ThemeProvider). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    },
    isDarkDocument,
    () => false,
  );
}

const GRID_LIGHT = "rgba(42,46,57,0.06)";
const GRID_DARK = "rgba(255,255,255,0.07)";
const SEPARATOR_LIGHT = "#E0E3EB";
const SEPARATOR_HOVER_LIGHT = "#B2B5BE";

export interface CanvasTheme {
  readonly background: string;
  readonly text: string;
  readonly grid: string;
  readonly axisLine: string;
  readonly crosshair: string;
  readonly watermark: string;
  readonly separator: string;
  readonly separatorHover: string;
}

/**
 * Canvas colors for the full terminal chart. Any display field the user
 * customized (differs from the light default) passes through untouched;
 * untouched fields follow the theme in dark mode.
 */
export function resolveCanvasTheme(
  display: ChartDisplaySettings,
  isDark: boolean,
): CanvasTheme {
  const defaults = DEFAULT_DISPLAY_SETTINGS;
  if (!isDark) {
    return {
      background: display.canvasBackground,
      text: display.axisTextColor,
      grid: GRID_LIGHT,
      axisLine: display.axisLineColor,
      crosshair: display.crosshairColor,
      watermark: display.watermarkColor,
      separator: SEPARATOR_LIGHT,
      separatorHover: SEPARATOR_HOVER_LIGHT,
    };
  }
  const pick = (
    current: string,
    lightDefault: string,
    variable: string,
    fallbackTriplet: string,
  ): string =>
    current === lightDefault ? themeHsl(variable, fallbackTriplet) : current;
  return {
    background: pick(
      display.canvasBackground,
      defaults.canvasBackground,
      "--card",
      "240 6% 10%",
    ),
    text: pick(
      display.axisTextColor,
      defaults.axisTextColor,
      "--muted-foreground",
      "240 5% 65%",
    ),
    grid: GRID_DARK,
    axisLine: pick(
      display.axisLineColor,
      defaults.axisLineColor,
      "--border",
      "240 5% 16%",
    ),
    // Mid-gray crosshair stays legible on both canvas tones.
    crosshair: display.crosshairColor,
    watermark: pick(
      display.watermarkColor,
      defaults.watermarkColor,
      "--border",
      "240 5% 16%",
    ),
    separator: themeHsl("--border", "240 5% 16%"),
    separatorHover: themeHsl("--muted-foreground", "240 5% 65%"),
  };
}

export interface CoreCanvasTheme {
  readonly background: string;
  readonly text: string;
  readonly grid: string;
  readonly border: string;
}

/** Canvas colors for the lightweight embedded chart (no display settings). */
export function resolveCoreCanvasTheme(isDark: boolean): CoreCanvasTheme {
  if (!isDark) {
    return {
      background: "#FFFFFF",
      text: "#6E6E73",
      grid: "rgba(0,0,0,0.04)",
      border: "rgba(0,0,0,0.08)",
    };
  }
  return {
    background: themeHsl("--card", "240 6% 10%"),
    text: themeHsl("--muted-foreground", "240 5% 65%"),
    grid: GRID_DARK,
    border: themeHsl("--border", "240 5% 16%"),
  };
}
