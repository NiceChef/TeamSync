const variants = {
    default:
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    primary:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
    success:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    warning:
        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    danger:
        'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
};

export default function Badge({ variant = 'default', className = '', children, ...props }) {
    return (
        <span
            className={[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                variants[variant] || variants.default,
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </span>
    );
}