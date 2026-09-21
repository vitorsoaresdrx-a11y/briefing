"use client";

import * as React from "react";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  leftLabel,
  rightLabel,
  id,
  ...props
}: SliderProps) {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={resolvedId} className="text-sm font-medium text-white">
        {label}
      </label>
      <input
        id={resolvedId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={leftLabel && rightLabel ? `${leftLabel} ${value} ${rightLabel}` : String(value)}
        className="h-[44px] w-full accent-[#e23a5b]"
        {...props}
      />
      {leftLabel || rightLabel ? (
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
