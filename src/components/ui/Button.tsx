import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "amber";
  size?: "sm" | "md" | "lg" | "icon";
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-bold tracking-tight transition-all duration-200 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const variantClasses = {
    primary:
      "bg-accent text-white hover:bg-accent-hover shadow-md shadow-accent/20 border border-accent/30",
    secondary:
      "bg-card border border-border text-foreground hover:bg-surface-elevated hover:border-gray-700/80 shadow-sm",
    ghost:
      "text-text-secondary hover:text-text-primary hover:bg-surface-muted bg-transparent",
    danger:
      "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 shadow-sm",
    amber:
      "bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-sm",
  };

  const sizeClasses = {
    sm: "min-h-[36px] px-3 text-xs rounded-lg gap-1.5",
    md: "min-h-[44px] px-4 py-2.5 text-sm rounded-xl gap-2",
    lg: "min-h-[52px] px-6 py-3.5 text-base rounded-xl gap-2.5",
    icon: "min-w-[44px] min-h-[44px] p-2.5 rounded-xl justify-center",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
