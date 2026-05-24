// Lustro walidacji backendu (config.MAX_UPLOAD_BYTES + whitelist w routes.upload_task_attachment).
export const MAX_UPLOAD_BYTES = 5_000_000;
export const ALLOWED_EXTENSIONS = [
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.doc', '.docx', '.xlsx', '.csv',
];

// Zwraca komunikat błędu albo null gdy plik jest dozwolony.
export function validateAttachment(file) {
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `Niedozwolony typ pliku. Dozwolone: ${ALLOWED_EXTENSIONS.join(', ')}.`;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        const mb = (MAX_UPLOAD_BYTES / 1_000_000).toFixed(0);
        return `Plik jest za duży (maks. ${mb} MB).`;
    }
    return null;
}
