export default function TextInput({ className = '', ...props }) {
    return (
        <input
            className={[
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100',
                className,
            ].join(' ')}
            {...props}
        />
    );
}