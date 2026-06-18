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
      <div className="ag-card mt-8 border-dashed p-8">
        <p className="text-slate-600">{description}</p>
        <p className="mt-2 text-sm text-slate-400">
          Esta área será preparada nas próximas etapas do AgroZap.
        </p>
      </div>
    </section>
  );
}
