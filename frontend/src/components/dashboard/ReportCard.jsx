export default function ReportCard({ title, icon: Icon, children }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                </h3>
            </div>

            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {children || 'Brak danych'}
            </pre>
        </section>
    );
}