import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * L'azione del momento, grande (56 px) e a tutta larghezza.
 * - `brand`: solo per "allenati adesso" e simili, sulle superfici scure (lime acceso)
 * - `primary`: le altre azioni principali (salva, condividi, applica)
 */
export type PrimaryActionVariant = "brand" | "primary";

const BASE =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60 touch-manipulation";

const VARIANTS: Record<PrimaryActionVariant, string> = {
  brand: "bg-brand-bright text-brand-foreground shadow-[0_8px_30px_-8px_rgba(163,230,53,0.6)]",
  primary: "bg-foreground text-background",
};

export const primaryActionClass = (variant: PrimaryActionVariant = "primary", className?: string) =>
  cn(BASE, VARIANTS[variant], className);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PrimaryActionVariant;
  loading?: boolean;
};

export const PrimaryAction = forwardRef<HTMLButtonElement, ButtonProps>(function PrimaryAction(
  { variant = "primary", loading = false, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={primaryActionClass(variant, className)} {...props}>
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/** Stessa azione come link (es. "Riprendi l'allenamento") */
export function PrimaryActionLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: PrimaryActionVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={primaryActionClass(variant, className)}>
      {children}
    </Link>
  );
}
