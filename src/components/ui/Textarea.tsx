"use client";

import * as React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, id, rows = 4, ...props }: TextareaProps) {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const hintId = hint ? `${resolvedId}-hint` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={resolvedId} className="text-sm font-medium text-white">
        {label}
      </label>
      <textarea
        id={resolvedId}
        rows={rows}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={Boolean(error)}
        className="w-full rounded-ctl border border-line bg-ink-2 px-4 py-3 text-[16px] leading-relaxed text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
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
