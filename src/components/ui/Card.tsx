import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-sm transition hover:border-gray-700/60 md:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between pb-4 border-b border-border/50 mb-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-base md:text-lg font-semibold tracking-tight text-card-foreground flex items-center gap-2 ${className}`}>{children}</h3>;
}
