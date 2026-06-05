import { useEffect } from 'react';
import { X } from 'lucide-react';

// Prawy wsuwany panel z przyciemnionym tłem. ESC zamyka, klik w tło zamyka.
export default function Drawer({ open, onClose, title, children }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative flex h-full w-full max-w-[860px] flex-col bg-slate-50 shadow-2xl dark:bg-slate-950 animate-[slideIn_0.2s_ease-out]"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Zamknij"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-6">{children}</div>
            </div>
        </div>
    );
}
