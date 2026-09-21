"use client";

import { Link2, Plus, Trash2 } from "lucide-react";

interface LinkListInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxItems?: number;
  placeholder?: string;
  hint?: string;
  /** Esconde o rótulo visual (mantém legend para leitor de tela). O wizard usa com cabeçalho próprio. */
  hideLabel?: boolean;
}

export function LinkListInput({
  label,
  values,
  onChange,
  maxItems = 5,
  placeholder = "https://",
  hint,
  hideLabel = false,
}: LinkListInputProps) {
  const items = values.length === 0 ? [""] : values;
  const canAdd = items.length < maxItems;

  function setItem(index: number, next: string) {
    const copy = [...items];
    copy[index] = next;
    onChange(copy.filter((v, i) => v.trim() !== "" || i === copy.length - 1));
  }

  function addItem() {
    if (canAdd) onChange([...items, ""]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`mb-1 text-sm font-medium text-white ${hideLabel ? "sr-only" : ""}`}>{label}</legend>
      {hint ? <p className="text-sm leading-relaxed text-muted">{hint}</p> : null}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span aria-hidden="true" className="shrink-0 text-muted">
            <Link2 size={16} />
          </span>
          <label htmlFor={`link-${index}`} className="sr-only">
            {label} {index + 1}
          </label>
          <input
            id={`link-${index}`}
            type="url"
            inputMode="url"
            value={item}
            placeholder={placeholder}
            onChange={(e) => setItem(index, e.target.value)}
            className="min-h-[48px] w-full rounded-ctl border border-line bg-ink-2 px-4 text-[16px] text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
          />
          {items.length > 1 ? (
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label={`Remover link ${index + 1}`}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-ctl text-muted hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>
      ))}
      {canAdd && items.length > 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-sm text-muted hover:text-white cursor-pointer"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar outro link ({items.filter((v) => v.trim() !== "").length}/{maxItems})
        </button>
      ) : null}
    </fieldset>
  );
}
