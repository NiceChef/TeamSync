export default function StatCard({ label, value, helper, icon: Icon }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {label}
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {value}
                    </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                </div>
            </div>

            {helper && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {helper}
                </p>
            )}
        </section>
    );
}