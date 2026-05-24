import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import TextInput from '../../ui/TextInput';
import Button from '../../ui/Button';
import { addComment } from '../../../api/tasks';

export default function TaskCommentsCard({ taskId, comments, onChanged, onError, disabled }) {
    const [body, setBody] = useState('');
    const [posting, setPosting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setPosting(true);
        try {
            await addComment(taskId, body.trim());
            setBody('');
            await onChanged?.();
        } catch (err) {
            onError?.(err.message || 'Nie udało się dodać komentarza');
        } finally {
            setPosting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Komentarze</CardTitle>
            </CardHeader>
            {comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Brak komentarzy.</p>
            ) : (
                <ul className="space-y-2">
                    {comments.map((c) => (
                        <li
                            key={c.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {c.author_username || 'Użytkownik'}
                                </span>
                                <span className="text-xs text-slate-400">{c.created_at}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{c.body}</p>
                        </li>
                    ))}
                </ul>
            )}
            <form onSubmit={submit} className="mt-4 flex gap-2">
                <TextInput
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Napisz komentarz..."
                />
                <Button type="submit" variant="primary" disabled={disabled || posting || !body.trim()}>
                    <Send className="h-4 w-4" />
                    Dodaj
                </Button>
            </form>
        </Card>
    );
}
