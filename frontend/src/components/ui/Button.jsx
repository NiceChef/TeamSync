const variants = {
    primary:
        'border-transparent bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-sm hover:-translate-y-px hover:shadow-md',
    secondary:
        'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    danger:
        'border-rose-300 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-500/10',
    ghost:
        'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
};

const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
    icon: 'h-10 w-10 p-0',
};

export default function Button({
    type = 'button',
    variant = 'secondary',
    size = 'md',
    className = '',
    children,
    ...props
}) {
    return (
        <button
            type={type}
            className={[
                'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                variants[variant] || variants.secondary,
                sizes[size] || sizes.md,
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </button>
    );
}