"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/auth";
import { ApiError } from "@/lib/types";

const USER_RE = /^[A-Za-z0-9_]{3,32}$/;

/** Sign in / register. Mirrors the backend constraints so 400s are rare. */
export default function LoginPage({ initialMode = "login" }: { initialMode?: "login" | "register" } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const userBad = username !== "" && !USER_RE.test(username);
  const passBad =
    mode === "register" &&
    password !== "" &&
    (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (userBad || passBad || username === "" || password === "") return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password);
      router.push("/mine");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields != null) setFieldErrors(err.fields);
        else setFormError(err.message);
      } else {
        setFormError("Could not reach the server. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const first = (k: string) => fieldErrors[k]?.[0] ?? null;

  return (
    <div className="mx-auto max-w-md p-4 pt-16">
      <div className="rounded-md border border-line bg-surface p-6">
        <h1 className="text-lg font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-xs text-muted">Watchlists, alerts and journal sync to your account.</p>

        <div role="tablist" aria-label="Auth mode" className="mt-4 flex rounded-md border border-line p-0.5">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setFormError(null);
                setFieldErrors({});
              }}
              className={
                mode === m
                  ? "min-h-[36px] flex-1 rounded-sm bg-accent/10 text-sm font-semibold text-accent"
                  : "min-h-[36px] flex-1 rounded-sm text-sm font-medium text-muted hover:text-fg"
              }
            >
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="username" className="text-xs font-medium text-muted">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="3–32 letters, digits, underscores"
              className="mt-1 h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
            />
            {(userBad || first("username") != null) && (
              <p className="mt-1 text-xs text-down">
                {first("username") ?? "Username must be 3–32 letters, digits, or underscores."}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "Your password" : "10+ characters, a letter and a digit"}
              className="mt-1 h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
            />
            {(passBad || first("password") != null) && (
              <p className="mt-1 text-xs text-down">
                {first("password") ?? "Password needs 10–128 characters with a letter and a digit."}
              </p>
            )}
          </div>

          {formError != null && (
            <p role="alert" className="rounded-md bg-down-tint px-3 py-2 text-[13px] font-medium text-down">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || userBad || passBad || username === "" || password === ""}
            className="min-h-[44px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
