import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { uploadAttachment, downloadAttachment } from '../../../api/tasks';
import { MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS, validateAttachment } from '../../../constants/attachments';

export default function TaskAttachmentsCard({ taskId, attachments, onChanged, onError }) {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const validationError = validateAttachment(file);
        if (validationError) {
            onError?.(validationError);
            return;
        }
        setUploading(true);
        try {
            await uploadAttachment(taskId, file);
            await onChanged?.();
        } catch (err) {
            onError?.(err.message || 'Upload nie powiódł się');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Załączniki</CardTitle>
            </CardHeader>
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <Paperclip className="h-4 w-4" />
                {uploading ? 'Wysyłanie...' : 'Dodaj plik'}
                <input
                    type="file"
                    className="hidden"
                    accept={ALLOWED_EXTENSIONS.join(',')}
                    onChange={handleUpload}
                    disabled={uploading}
                />
            </label>
            <p className="mt-2 text-xs text-slate-400">
                Maks. {(MAX_UPLOAD_BYTES / 1_000_000).toFixed(0)} MB · {ALLOWED_EXTENSIONS.join(', ')}
            </p>
            {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {attachments.map((at) => (
                        <li
                            key={at.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
                        >
                            <button
                                type="button"
                                onClick={() => downloadAttachment(at).catch((err) => onError?.(err.message))}
                                className="flex min-w-0 items-center gap-2 text-left text-sm text-indigo-600 hover:underline dark:text-indigo-300"
                            >
                                <span className="min-w-0 truncate">{at.original_name}</span>
                                <span className="shrink-0 text-xs text-slate-400">
                                    {Math.round((at.size_bytes || 0) / 1024)} KB
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
