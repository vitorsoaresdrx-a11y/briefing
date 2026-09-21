"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Esconde o rótulo visual (mantém para leitor de tela). O wizard usa com cabeçalho próprio. */
  hideLabel?: boolean;
}

export function Input({ label, hint, error, id, hideLabel = false, ...props }: InputProps) {
  const inputId = React.useId();
  const resolvedId = id ?? inputId;
  const hintId = hint ? `${resolvedId}-hint` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={resolvedId} className={`text-sm font-medium text-white ${hideLabel ? "sr-only" : ""}`}>
        {label}
      </label>
      <input
        id={resolvedId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={Boolean(error)}
        className="min-h-[48px] w-full rounded-ctl border border-line bg-ink-2 px-4 text-[16px] text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
    </div>
  );
}
