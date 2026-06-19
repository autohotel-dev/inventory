"use client";

import { Badge } from "@/components/ui/badge";
import { getScoreBgColor, getScoreLabel, SCORE_THRESHOLDS } from "./types";

interface PerformanceScoreBarProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showValue?: boolean;
  className?: string;
}

export function PerformanceScoreBar({
  score,
  size = "md",
  showLabel = true,
  showValue = true,
  className = "",
}: PerformanceScoreBarProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const barColor = getScoreBgColor(clampedScore);
  const label = getScoreLabel(clampedScore);

  const heightClass = size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4";
  const textClass = size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 min-w-[60px]">
        <div className={`w-full ${heightClass} bg-muted rounded-full overflow-hidden`}>
          <div
            className={`${heightClass} ${barColor} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
      </div>
      {showValue && (
        <span className={`${textClass} font-bold tabular-nums min-w-[32px] text-right`}>
          {clampedScore}
        </span>
      )}
      {showLabel && (
        <Badge
          variant="secondary"
          className={`${textClass} font-medium px-1.5 py-0 border-0 ${
            clampedScore >= SCORE_THRESHOLDS.excellent
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : clampedScore >= SCORE_THRESHOLDS.good
              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
              : clampedScore >= SCORE_THRESHOLDS.warning
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-red-500/15 text-red-600 dark:text-red-400"
          }`}
        >
          {label}
        </Badge>
      )}
    </div>
  );
}
