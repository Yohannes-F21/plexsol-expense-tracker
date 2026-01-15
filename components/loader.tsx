"use client";

import { cn } from "@/lib/utils";

type LoaderProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  showLabel?: boolean;
};

const sizeClasses: Record<NonNullable<LoaderProps["size"]>, string> = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function Loader({
  size = "md",
  className,
  ariaLabel,
  "aria-label": ariaLabelAttr,
  showLabel = false,
}: LoaderProps) {
  const explicitLabel = ariaLabelAttr ?? ariaLabel;
  const resolvedAriaLabel = explicitLabel ?? "Loading";

  return (
    <span
      role="status"
      aria-label={resolvedAriaLabel}
      className={cn(
        "inline-flex flex-col items-center justify-center text-primary",
        className
      )}
    >
      <svg
        aria-hidden="true"
        className={cn("shrink-0", sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="15"
          r="15"
          cx="35"
          cy="100"
        >
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2"
            values="35;165;165;35;35"
            keySplines="0 .1 .5 1;0 .1 .5 1;0 .1 .5 1;0 .1 .5 1"
            repeatCount="indefinite"
            begin="0"
          />
        </circle>
        <circle
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="15"
          opacity=".8"
          r="15"
          cx="35"
          cy="100"
        >
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2"
            values="35;165;165;35;35"
            keySplines="0 .1 .5 1;0 .1 .5 1;0 .1 .5 1;0 .1 .5 1"
            repeatCount="indefinite"
            begin="0.05"
          />
        </circle>
        <circle
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="15"
          opacity=".6"
          r="15"
          cx="35"
          cy="100"
        >
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2"
            values="35;165;165;35;35"
            keySplines="0 .1 .5 1;0 .1 .5 1;0 .1 .5 1;0 .1 .5 1"
            repeatCount="indefinite"
            begin=".1"
          />
        </circle>
        <circle
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="15"
          opacity=".4"
          r="15"
          cx="35"
          cy="100"
        >
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2"
            values="35;165;165;35;35"
            keySplines="0 .1 .5 1;0 .1 .5 1;0 .1 .5 1;0 .1 .5 1"
            repeatCount="indefinite"
            begin=".15"
          />
        </circle>
        <circle
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="15"
          opacity=".2"
          r="15"
          cx="35"
          cy="100"
        >
          <animate
            attributeName="cx"
            calcMode="spline"
            dur="2"
            values="35;165;165;35;35"
            keySplines="0 .1 .5 1;0 .1 .5 1;0 .1 .5 1;0 .1 .5 1"
            repeatCount="indefinite"
            begin=".2"
          />
        </circle>
      </svg>

      {showLabel ? (
        <span className="mt-3 text-sm text-muted-foreground">
          {resolvedAriaLabel}
        </span>
      ) : null}
    </span>
  );
}
