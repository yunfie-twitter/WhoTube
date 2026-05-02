import type { PropsWithChildren } from 'react';

interface Props extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function SpotlightPanel({ title, subtitle, children }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm">
      <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-40 w-40 rounded-full bg-rose-300/20 blur-3xl" />
      <div className="relative">
        <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}
