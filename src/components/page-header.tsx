import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

type Props = {
  /** Crumbs shown in the thin top row (× icon + chain of labels). */
  crumbs?: Crumb[];
  /** Main page title rendered in serif. */
  title: string;
  /** Small label above the title, e.g. "Doklady". */
  eyebrow?: string;
  /** Right-side actions (buttons, etc). */
  actions?: React.ReactNode;
  /** Secondary description rendered under the title. */
  description?: React.ReactNode;
  /** Where the × button leads. Defaults to "/". */
  closeHref?: string;
  className?: string;
};

export function PageHeader({
  crumbs,
  title,
  eyebrow,
  actions,
  description,
  closeHref = "/",
  className,
}: Props) {
  return (
    <header
      className={cn(
        "border-b border-border bg-card",
        className
      )}
    >
      {/* Thin breadcrumb row */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border/60 min-h-[40px]">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Link
            href={closeHref}
            aria-label="Späť na dashboard"
            className="rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </Link>
          {crumbs && crumbs.length > 0 && (
            <div className="flex items-center gap-1.5">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/50">›</span>}
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-foreground/80">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {/* Title block */}
      <div className="px-6 py-5">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="font-serif text-[28px] leading-tight font-medium text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <div className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </header>
  );
}

type StatusKind =
  | "ok"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const STATUS_DOT = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  neutral: "bg-zinc-300",
};

const STATUS_TEXT = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  info: "text-sky-700",
  neutral: "text-zinc-600",
};

/** Status indicator: colored dot + label, no background pill. */
export function Status({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        STATUS_TEXT[kind],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[kind])} />
      {label}
    </span>
  );
}
