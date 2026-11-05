import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
}

export default function Button({
  children,
  type = "button",
  disabled,
  loading = false,
  loadingLabel,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"]}
    >
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}
