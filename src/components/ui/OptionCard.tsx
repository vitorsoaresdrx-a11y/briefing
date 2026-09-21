"use client";

import * as React from "react";

export interface OptionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export function OptionCard({
  title,
  description,
  icon,
  selected = false,
  onSelect,
  disabled = false,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        "flex w-full items-start gap-4 rounded-card border p-5 text-left transition-colors duration-200 min-h-[48px] cursor-pointer",
        selected
          ? "border-burgundy-glow bg-burgundy/20"
          : "border-line bg-ink hover:border-white/25",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ]
        .join(" ")
        .trim()}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={selected ? "text-burgundy-glow" : "text-muted"}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-white">
          {title}
        </span>
        {description ? (
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[12px] leading-none",
          selected
            ? "border-burgundy-glow bg-burgundy text-white"
            : "border-line text-transparent",
        ].join(" ")}
      >
        ✓
      </span>
    </button>
  );
}
