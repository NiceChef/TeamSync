export default function TasksHeader() {
    return (
        <div className="mb-6">
            <h2 className="bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                Zadania
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Przeglądaj, filtruj i zarządzaj zadaniami zespołu.
            </p>
        </div>
    );
}