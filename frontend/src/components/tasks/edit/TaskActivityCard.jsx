import { Card, CardHeader, CardTitle } from '../../ui/Card';

export default function TaskActivityCard({ activities }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Historia aktywności</CardTitle>
            </CardHeader>
            {activities.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Brak zarejestrowanej aktywności.</p>
            ) : (
                <ul className="max-h-56 space-y-2 overflow-auto">
                    {activities.map((a) => (
                        <li key={a.id} className="flex items-start gap-3 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                            <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-medium text-slate-800 dark:text-slate-100">
                                    {a.username || 'Użytkownik'}
                                </span>{' '}
                                {a.action}
                                <span className="ml-1 text-xs text-slate-400">· {a.created_at}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
