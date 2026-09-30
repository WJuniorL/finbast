"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary (vermelho), secondary (ink), outline, ghost, destructive, success */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg";
  /** Nome de ícone Finbast mostrado antes do texto */
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

const SIZES = {
  sm: { h: 32, pad: "0 14px", fs: 13, icon: 14 },
  md: { h: 40, pad: "0 18px", fs: 14, icon: 16 },
  lg: { h: 48, pad: "0 24px", fs: 15, icon: 18 },
} as const;

const VARIANTS = {
  primary: { bg: "var(--red-500)", hover: "var(--red-600)", press: "var(--red-700)", color: "#fff" },
  secondary: { bg: "var(--ink-900)", hover: "var(--ink-700)", press: "var(--ink-950)", color: "#fff" },
  outline: { bg: "#fff", hover: "var(--gray-50)", press: "var(--gray-100)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
  ghost: { bg: "transparent", hover: "var(--gray-100)", press: "var(--gray-200)", color: "var(--text-secondary)" },
  destructive: { bg: "var(--red-50)", hover: "var(--red-100)", press: "var(--red-200)", color: "var(--red-700)", border: "1px solid var(--red-200)" },
  success: { bg: "var(--green-600)", hover: "var(--green-700)", press: "var(--green-700)", color: "#fff" },
} as const;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  children,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.md;
  const border = "border" in v ? v.border : undefined;
  const bg = disabled
    ? variant === "outline" || variant === "ghost" ? v.bg : "var(--gray-200)"
    : press ? v.press : hover ? v.hover : v.bg;

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.h,
        padding: s.pad,
        borderRadius: "var(--radius-pill)",
        border: border ?? "none",
        background: bg,
        color: disabled ? "var(--gray-400)" : v.color,
        font: `700 ${s.fs}px/1 var(--font-sans)`,
        cursor: disabled || loading ? "default" : "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease-standard)",
        width: fullWidth ? "100%" : undefined,
        outline: "none",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--focus-ring)"; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            width: s.icon,
            height: s.icon,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "fbspin .7s linear infinite",
          }}
        />
      ) : icon ? (
        <Icon name={icon} size={s.icon} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={s.icon} /> : null}
    </button>
  );
}
