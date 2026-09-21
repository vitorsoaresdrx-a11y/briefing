"use client";

import * as React from "react";

const PRESET_COLORS = [
  "#6D001A",
  "#E23A5B",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#84CC16",
  "#06B6D4",
  "#EAB308",
  "#111111",
  "#6B7280",
  "#F5F5F5",
  "#FFFFFF",
];

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  unknown?: boolean;
  onUnknownChange?: (unknown: boolean) => void;
  unknownLabel?: string;
}

export function ColorPicker({
  label,
  value,
  onChange,
  unknown = false,
  onUnknownChange,
  unknownLabel = "Não tenho, me sugira",
}: ColorPickerProps) {
  const hexId = React.useId();
  const validHex = /^#[0-9a-fA-F]{6}$/.test(value.trim());

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-white">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {PRESET_COLORS.map((color) => {
          const active =
            !unknown && value.trim().toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Cor ${color}`}
              aria-pressed={active}
              disabled={unknown}
              onClick={() => {
                onUnknownChange?.(false);
                onChange(color);
              }}
              style={{ backgroundColor: color }}
              className={[
                "h-[44px] w-[44px] rounded-ctl border transition-transform duration-150 cursor-pointer",
                active
                  ? "border-burgundy-glow scale-105"
                  : "border-line hover:scale-105",
                unknown ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={hexId} className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          HEX
        </label>
        <input
          id={hexId}
          type="text"
          inputMode="text"
          value={value}
          disabled={unknown}
          placeholder="#6D001A"
          maxLength={7}
          onChange={(e) => {
            onUnknownChange?.(false);
            onChange(e.target.value);
          }}
          aria-invalid={value.trim() !== "" && !validHex}
          className="min-h-[48px] w-36 rounded-ctl border border-line bg-ink-2 px-4 font-mono text-sm uppercase text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none disabled:opacity-40"
        />
        {value.trim() !== "" && !validHex && !unknown ? (
          <p role="alert" className="text-sm text-burgundy-glow">
            Use o formato #RRGGBB.
          </p>
        ) : null}
      </div>
      {onUnknownChange ? (
        <button
          type="button"
          aria-pressed={unknown}
          onClick={() => onUnknownChange(!unknown)}
          className={[
            "inline-flex min-h-[44px] items-center self-start rounded-full border px-4 text-sm transition-colors duration-200 cursor-pointer",
            unknown
              ? "border-burgundy-glow bg-burgundy/20 text-white"
              : "border-line text-muted hover:border-white/25 hover:text-white",
          ].join(" ")}
        >
          {unknownLabel}
        </button>
      ) : null}
    </div>
  );
}
