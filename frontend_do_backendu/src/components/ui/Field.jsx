export function Field({ children, className = '' }) {
    return <label className={['block', className].join(' ')}>{children}</label>;
}

export function FieldLabel({ children, className = '' }) {
    return (
        <span
            className={[
                'mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300',
                className,
            ].join(' ')}
        >
            {children}
        </span>
    );
}

export function FieldHint({ children, className = '' }) {
    return (
        <p className={['mt-1 text-xs text-slate-500 dark:text-slate-400', className].join(' ')}>
            {children}
        </p>
    );
}

export function FieldError({ children, className = '' }) {
    if (!children) return null;

    return (
        <div
            className={[
                'rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
                className,
            ].join(' ')}
        >
            {children}
        </div>
    );
}