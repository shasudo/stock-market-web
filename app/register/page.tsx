"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import {
  UserPlus,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { UpperWickMark } from "@/components/brand/UpperWickMark";
import {
  isRegisterResponse,
  type ApiErrorResponse,
  type RegisterRequest,
} from "@/types/api";

interface RegistrationFormValues extends Required<RegisterRequest> {
  confirmPassword: string;
}

const INITIAL_FORM_VALUES: RegistrationFormValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
};

function getRegistrationErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return "Registration failed";
  }

  const message = error.response?.data?.message;
  return typeof message === "string" ? message : "Registration failed";
}

const inputClassName =
  "w-full rounded-md border border-border bg-card px-4 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

const labelClassName = "mb-2 block text-[13px] font-medium text-foreground";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] =
    useState<RegistrationFormValues>(INITIAL_FORM_VALUES);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateFormField = <TField extends keyof RegistrationFormValues>(
    field: TField,
    value: RegistrationFormValues[TField],
  ): void => {
    setFormData((currentValues) => ({ ...currentValues, [field]: value }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (
      formData.password.length < 10 ||
      !/[A-Za-z]/.test(formData.password) ||
      !/\d/.test(formData.password)
    ) {
      toast.error("Password must be at least 10 characters with a letter and a digit");
      return;
    }

    setLoading(true);

    try {
      const registrationInput: RegisterRequest = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };
      const response = await axios.post<unknown>(
        "/api/auth/register",
        registrationInput,
      );
      if (!isRegisterResponse(response.data)) {
        toast.error("The registration service returned an invalid response");
        return;
      }

      toast.success("Account created successfully!");
      router.push("/");
    } catch (error: unknown) {
      toast.error(getRegistrationErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "Real-time market data",
    "Advanced portfolio analytics",
    "Customizable watchlists",
    "Price alerts & notifications",
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden flex-1 items-center justify-center border-r border-border bg-muted/40 p-12 lg:flex">
        <div className="max-w-lg">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-foreground">
            Start your trading journey today
          </h2>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground">
            Join thousands of successful traders using professional-grade
            tools to make informed decisions.
          </p>

          <ul className="space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
                <span className="text-sm text-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="group mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to sign in
          </Link>

          <div className="mb-8 flex items-center gap-2.5">
            <UpperWickMark className="h-8 w-8" />
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Upper<span className="text-primary">Wick</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">Start trading in minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className={labelClassName}>
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={formData.firstName}
                  onChange={(event) =>
                    updateFormField("firstName", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>

              <div>
                <label htmlFor="last-name" className={labelClassName}>
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={formData.lastName}
                  onChange={(event) =>
                    updateFormField("lastName", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className={labelClassName}>
                Username <span className="text-destructive">*</span>
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(event) =>
                  updateFormField("username", event.target.value)
                }
                className={inputClassName}
                placeholder="johndoe"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="email" className={labelClassName}>
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) =>
                  updateFormField("email", event.target.value)
                }
                className={inputClassName}
                placeholder="john@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className={labelClassName}>
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(event) =>
                      updateFormField("password", event.target.value)
                    }
                    className={`${inputClassName} pr-12`}
                    placeholder="••••••••"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    aria-controls="password"
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

              <div>
                <label htmlFor="confirm-password" className={labelClassName}>
                  Confirm <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(event) =>
                      updateFormField("confirmPassword", event.target.value)
                    }
                    className={`${inputClassName} pr-12`}
                    placeholder="••••••••"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    aria-pressed={showConfirmPassword}
                    aria-controls="confirm-password"
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/"
                className="font-semibold text-foreground hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
