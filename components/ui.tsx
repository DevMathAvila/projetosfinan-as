import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-lg border border-line bg-paper p-4 shadow-soft", className)}>{children}</section>;
}

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "tap inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function GhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "tap inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="tap w-full rounded-lg border border-line bg-white px-3 py-2 text-base outline-none focus:border-ink" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="tap w-full rounded-lg border border-line bg-white px-3 py-2 text-base outline-none focus:border-ink" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-base outline-none focus:border-ink" {...props} />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="space-y-1 text-sm font-medium text-ink">{children}</label>;
}

export function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "danger" | "warn" }) {
  const toneClass = {
    default: "text-ink",
    good: "text-good",
    danger: "text-danger",
    warn: "text-warn",
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={clsx("mt-1 text-xl font-bold", toneClass)}>{value}</p>
    </div>
  );
}
