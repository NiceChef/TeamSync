import * as XLSX from 'xlsx';
import { API_URL } from '../../api/authFetch';

function downloadTextFile(content, filename, type) {
    const dataBlob = new Blob([content], { type });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

function exportFileDate() {
    return new Date().toISOString().split('T')[0];
}

function buildJsonExport(tasksData) {
    return {
        export_date: new Date().toISOString(),
        tasks: tasksData.map((task) => ({
            topic: task.topic,
            deadline: task.deadline,
            planned_date: task.planned_date,
            completed: task.completed,
            created_at: task.created_at,
            categories: task.categories ? task.categories.map((cat) => cat.name) : [],
            subtasks:
                task.related_tasks?.outgoing
                    ?.map((rel) => {
                        const subtask = tasksData.find((t) => t.id === rel.target_task_id);
                        return subtask ? subtask.topic : null;
                    })
                    .filter(Boolean) || [],
        })),
    };
}

function buildXlsxExport(tasksData) {
    return tasksData.map((task) => ({
        Topic: task.topic,
        Created: task.created_at ? new Date(task.created_at).toLocaleDateString('pl-PL') : '',
        'Planned Date': task.planned_date
            ? new Date(task.planned_date).toLocaleDateString('pl-PL')
            : '',
        Deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('pl-PL') : '',
        Status: task.completed ? 'Completed' : 'Pending',
        Categories: task.categories ? task.categories.map((cat) => cat.name).join(', ') : '',
        Subtasks:
            task.related_tasks?.outgoing
                ?.map((rel) => {
                    const subtask = tasksData.find((t) => t.id === rel.target_task_id);
                    return subtask ? subtask.topic : null;
                })
                .filter(Boolean)
                .join(', ') || '',
    }));
}

async function fetchAllTasks(fetchWithAuth) {
    const response = await fetchWithAuth(`${API_URL}/api/tasks?include_relations=true`);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tasks for export');
    }

    return response.json();
}

export async function exportTasksToJSON(fetchWithAuth) {
    const tasksData = await fetchAllTasks(fetchWithAuth);
    const exportData = buildJsonExport(tasksData);
    const dataStr = JSON.stringify(exportData, null, 2);

    downloadTextFile(
        dataStr,
        `tasks_export_${exportFileDate()}.json`,
        'application/json'
    );
}

export async function exportTasksToXLSX(fetchWithAuth) {
    const tasksData = await fetchAllTasks(fetchWithAuth);
    const exportData = buildXlsxExport(tasksData);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `tasks_export_${exportFileDate()}.xlsx`);
}

function mapJsonTasks(importData) {
    if (!importData.tasks || !Array.isArray(importData.tasks)) {
        throw new Error('Invalid JSON format. Expected object with "tasks" array.');
    }

    return importData.tasks.map((task) => ({
        topic: task.topic || '',
        deadline: task.deadline || null,
        planned_date: task.planned_date || null,
        completed: task.completed || false,
    }));
}

function mapXlsxTasks(jsonData) {
    return jsonData
        .map((row) => ({
            topic: row.Topic || row.topic || row.Description || row.description || '',
            deadline: row.Deadline || row.deadline || null,
            planned_date: row['Planned Date'] || row.planned_date || null,
            completed:
                row.Status === 'Completed' ||
                row.Status === 'completed' ||
                row.completed === true ||
                false,
        }))
        .filter((task) => task.topic.trim() !== '');
}

async function importTasks(fetchWithAuth, tasksToImport) {
    const response = await fetchWithAuth(`${API_URL}/api/tasks/import`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks: tasksToImport }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import tasks');
    }

    return tasksToImport.length;
}

export async function importTasksFromJSON(file, fetchWithAuth) {
    const text = await file.text();
    const importData = JSON.parse(text);
    const tasksToImport = mapJsonTasks(importData);

    return importTasks(fetchWithAuth, tasksToImport);
}

export async function importTasksFromXLSX(file, fetchWithAuth) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const tasksToImport = mapXlsxTasks(jsonData);

    if (tasksToImport.length === 0) {
        throw new Error('No valid tasks found in the file');
    }

    return importTasks(fetchWithAuth, tasksToImport);
}