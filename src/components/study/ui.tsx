"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/* ---------- Page structure ---------- */

export function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("page-enter mx-auto space-y-8 pb-16 md:space-y-10", wide ? "max-w-[1400px]" : "max-w-5xl")}>{children}</div>;
}

export function PageHeader({
  icon, title, sub, actions,
}: {
  icon?: React.ReactNode; title: string; sub?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="type-h1 flex items-center gap-3">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {sub && <p className="type-body mt-2 max-w-2xl text-[15px]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="type-label">{title}</h2>
      {action}
    </div>
  );
}

/* Plain section: grouping WITHOUT a bordered card (card rule — use for
   lists, timelines, secondary info so the UI breathes). */
export function PlainSection({ title, action, children, className }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("py-2", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-card-foreground md:text-2xl">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Buttons — semantic variants ----------
   PRIMARY   : accent fill, for main CTA
   SECONDARY : bordered, for secondary actions
   GHOST     : text-only, for tertiary / subtle actions
   DANGER    : rose, for destructive actions
   ICON      : square, for icon-only (44px touch target)
------------------------------------------------ */

const baseButton = "inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none min-h-[44px]";

export function PrimaryButton({
  children, onClick, type, className, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; type?: "button" | "submit";
  className?: string; disabled?: boolean;
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={cn(baseButton, "bg-accent px-5 py-2.5 text-white shadow-md hover:bg-accent-hover", className)}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children, onClick, className, href,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; href?: string;
}) {
  const cls = cn(baseButton, "border border-border bg-border/40 px-5 py-2.5 text-gray-200 hover:bg-border/70", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function GhostButton({
  children, onClick, className, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(baseButton, "px-4 py-2 text-gray-400 hover:bg-border/30 hover:text-gray-200", className)}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children, onClick, className, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(baseButton, "border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-rose-300 hover:bg-rose-500/20", className)}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children, onClick, label, className,
}: {
  children: React.ReactNode; onClick?: () => void; label: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(baseButton, "h-11 w-11 p-0 rounded-xl border border-border bg-card text-gray-400 hover:bg-border/40 hover:text-gray-200", className)}
    >
      {children}
    </button>
  );
}

/* ---------- Form controls (Phase 15: single theme-safe set, never regressed) ---------- */

const fieldCls =
  "w-full rounded-xl border border-border bg-card px-4 text-[15px] text-card-foreground placeholder:text-gray-500 transition-colors duration-200 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 min-h-[44px] disabled:opacity-70";

export function Input({ label, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const inputId = id ?? (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <div className="min-w-0">
      {label && <label htmlFor={inputId} className="type-label mb-1.5 block">{label}</label>}
      <input id={inputId} {...props} className={cn(fieldCls, "py-2.5", props.className)} />
    </div>
  );
}

export function Textarea({ label, id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const inputId = id ?? (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <div className="min-w-0">
      {label && <label htmlFor={inputId} className="type-label mb-1.5 block">{label}</label>}
      <textarea id={inputId} {...props} className={cn(fieldCls, "py-3 leading-relaxed", props.className)} />
    </div>
  );
}

export function Select({ label, id, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const inputId = id ?? (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <div className="min-w-0">
      {label && <label htmlFor={inputId} className="type-label mb-1.5 block">{label}</label>}
      <select id={inputId} {...props} className={cn(fieldCls, "py-2.5 pr-9", props.className)}>
        {children}
      </select>
    </div>
  );
}

/* ---------- Semantic text roles ---------- */
export function TextPrimary({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm font-semibold text-card-foreground", className)}>{children}</span>;
}
export function TextSecondary({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm text-gray-300", className)}>{children}</span>;
}
export function TextMuted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-xs text-gray-400", className)}>{children}</span>;
}
export function TextAccent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm font-bold text-accent", className)}>{children}</span>;
}

/* ---------- Data display ---------- */

export function StatCard({
  label, value, hint, accent = "text-card-foreground", className,
}: {
  label: string; value: React.ReactNode; hint?: string; accent?: string; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <span className="text-xs font-bold text-gray-400">{label}</span>
      <div className={cn("mt-1 text-2xl font-extrabold", accent)}>{value}</div>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  gray: "bg-border/40 text-gray-300 border-border",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
};

export function StatusBadge({ tone = "gray", children }: { tone?: keyof typeof badgeStyles; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold", badgeStyles[tone])}>
      {children}
    </span>
  );
}

export function ChartCard({
  title, action, children, className,
}: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-card-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function FilterPills<T extends string>({
  options, value, onChange, activeClass, label,
}: {
  options: readonly T[]; value: T; onChange: (v: T) => void; activeClass?: string; label?: string;
}) {
  return (
    <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-2" role="group" aria-label={label ?? "Filter"}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "min-h-[44px] whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none",
            value === o
              ? activeClass ?? "border-accent bg-accent text-white shadow-sm"
              : "border-border bg-card text-gray-400 hover:bg-border/40"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl border border-border bg-card", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Skeleton className="h-24" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
      <p className="text-sm font-bold text-rose-300">Something couldn&apos;t load</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-gray-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs, value, onChange, label,
}: {
  tabs: readonly T[]; value: T; onChange: (v: T) => void; label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={label ?? "Tabs"}>
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "min-h-[44px] rounded-lg border px-3.5 py-1.5 text-xs font-bold capitalize transition-colors duration-200 motion-reduce:transition-none",
            value === t ? "border-accent bg-accent text-white" : "border-border bg-card text-gray-400 hover:bg-border/40"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
