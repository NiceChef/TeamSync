import {
    Building2,
    UserRound,
    Users,
} from 'lucide-react';

function AssignmentBadge({
    icon: Icon,
    children,
    title,
}) {
    return (
        <span
            title={title}
            className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
            <Icon className="h-3 w-3 shrink-0" />

            <span className="truncate">
                {children}
            </span>
        </span>
    );
}

export default function TaskAssignmentSummary({
    task,
    compact = false,
}) {
    const organizations = task.assigned_organizations || [];
    const groups = task.assigned_groups || [];
    const users = task.assigned_users || [];
    const effectiveCount = Number(task.effective_assignee_count || 0);

    const visibleOrganizations = compact
        ? organizations.slice(0, 1)
        : organizations;

    const visibleGroups = compact
        ? groups.slice(0, 1)
        : groups;

    const visibleUsers = compact
        ? users.slice(0, 2)
        : users;

    const visibleCount =
        visibleOrganizations.length +
        visibleGroups.length +
        visibleUsers.length;

    const directCount =
        organizations.length +
        groups.length +
        users.length;

    const hiddenCount = Math.max(
        0,
        directCount - visibleCount,
    );

    if (
        organizations.length === 0 &&
        groups.length === 0 &&
        users.length === 0
    ) {
        return (
            <span className="text-xs text-slate-400">
                Brak przypisania
            </span>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {visibleOrganizations.map((organization) => (
                <AssignmentBadge
                    key={`organization-${organization.id}`}
                    icon={Building2}
                    title={`Cała organizacja: ${organization.name}`}
                >
                    {organization.name}
                </AssignmentBadge>
            ))}

            {visibleGroups.map((group) => (
                <AssignmentBadge
                    key={`group-${group.id}`}
                    icon={Users}
                    title={`Dział: ${group.name}`}
                >
                    {group.name}
                </AssignmentBadge>
            ))}

            {visibleUsers.map((user) => (
                <AssignmentBadge
                    key={`user-${user.id}`}
                    icon={UserRound}
                    title={`Osoba: ${user.username || user.email}`}
                >
                    {user.username || user.email}
                </AssignmentBadge>
            ))}

            {hiddenCount > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    +{hiddenCount}
                </span>
            )}

            {effectiveCount > directCount && (
                <span
                    title="Łączna liczba osób po rozwinięciu działów i organizacji"
                    className="text-[11px] text-slate-400"
                >
                    {effectiveCount} os.
                </span>
            )}
        </div>
    );
}