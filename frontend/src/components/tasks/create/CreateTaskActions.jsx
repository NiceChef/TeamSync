import Button from '../../ui/Button';

export default function CreateTaskActions({
    submitting,
    onCancel,
}) {
    return (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row">
            <Button type="submit" variant="primary" size="lg" disabled={submitting}>
                {submitting ? 'Tworzenie...' : 'Utwórz zadanie'}
            </Button>

            <Button type="button" size="lg" onClick={onCancel} disabled={submitting}>
                Anuluj
            </Button>
        </div>
    );
}