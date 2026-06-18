type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
        AgroZap
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">
        {title}
      </h1>
      <div className="mt-8 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 shadow-sm">
        <p className="text-slate-600">{description}</p>
        <p className="mt-2 text-sm text-slate-400">
          Esta área será preparada nas próximas etapas do AgroZap.
        </p>
      </div>
    </section>
  );
}
