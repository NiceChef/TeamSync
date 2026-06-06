export function Card({ className = '', children, ...props }) {
    return (
        <section
            className={[
                'rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow dark:border-slate-800 dark:bg-slate-900',
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </section>
    );
}

export function CardHeader({ className = '', children, ...props }) {
    return (
        <div
            className={[
                'mb-4 flex flex-wrap items-start justify-between gap-3',
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardTitle({ className = '', children, ...props }) {
    return (
        <h3
            className={[
                'text-base font-semibold text-slate-900 dark:text-slate-100',
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </h3>
    );
}

export function CardDescription({ className = '', children, ...props }) {
    return (
        <p
            className={[
                'mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400',
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </p>
    );
}