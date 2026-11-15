"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import axios from "axios";
import { normalizeAuthResponse } from "@/lib/api-client";
import toast from "react-hot-toast";
import { LogIn, BarChart3, ArrowLeft, Eye, EyeOff } from "lucide-react";
import {
  isLoginResponse,
  type ApiErrorResponse,
  type LoginRequest,
} from "@/types/api";

function getLoginErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return "Login failed";
  }

  const message = error.response?.data?.message;
  return typeof message === "string" ? message : "Login failed";
}

const inputClassName =
  "w-full rounded-md border border-border bg-card px-4 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState<LoginRequest>({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post<unknown>("/api/auth/login", formData, {
        withCredentials: true,
      });
      const payload = normalizeAuthResponse("/api/auth/login", response.data);
      if (!isLoginResponse(payload)) {
        toast.error("The authentication service returned an invalid response");
        return;
      }

      const { user, accessToken } = payload;

      setAuth(user, accessToken);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error: unknown) {
      toast.error(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="group mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to home
          </Link>

          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              StockMarket Pro
            </span>
          </div>

          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-[13px] font-medium text-foreground"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className={inputClassName}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className={`${inputClassName} pr-12`}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-foreground hover:underline"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center border-l border-border bg-muted/40 p-12 lg:flex">
        <div className="max-w-lg">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-foreground">
            Professional trading made simple
          </h2>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground">
            Access institutional-grade market data, build intelligent
            watchlists, and manage your portfolio with precision.
          </p>
          <ul className="space-y-3">
            {[
              "Real-time market data",
              "Advanced analytics",
              "Secure & reliable",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
