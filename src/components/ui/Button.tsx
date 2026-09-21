"use client";

import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-ctl px-6 text-[15px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-burgundy text-white hover:bg-burgundy-hover",
  secondary:
    "border border-line bg-transparent text-white hover:bg-white/10",
  ghost: "bg-transparent text-muted hover:text-white hover:bg-white/5",
};

export function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
