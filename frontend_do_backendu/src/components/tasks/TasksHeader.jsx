import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function TasksHeader() {
    const navigate = useNavigate();

    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                    Zadania
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Przeglądaj, filtruj i zarządzaj zadaniami zespołu.
                </p>
            </div>

            <button
                type="button"
                onClick={() => navigate('/tasks/new')}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
                <Plus className="h-4 w-4" />
                Dodaj zadanie
            </button>
        </div>
    );
}
