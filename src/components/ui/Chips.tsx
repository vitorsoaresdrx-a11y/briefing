"use client";

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipsProps {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
  label?: string;
}

export function Chips({ options, selected, onToggle, label }: ChipsProps) {
  return (
    <div>
      {label ? (
        <p className="mb-3 text-sm font-medium text-white">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(opt.value)}
              className={[
                "inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm transition-colors duration-200 cursor-pointer",
                active
                  ? "border-burgundy-glow bg-burgundy/20 text-white"
                  : "border-line text-muted hover:border-white/25 hover:text-white",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
