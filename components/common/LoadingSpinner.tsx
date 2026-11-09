"use client";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6 border",
  md: "w-12 h-12 border-2",
  lg: "w-16 h-16 border-2",
};

export function LoadingSpinner({
  message,
  size = "md",
  fullScreen = true,
}: LoadingSpinnerProps) {
  const content = (
    <div className="text-center">
      <div
        className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4`}
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;
