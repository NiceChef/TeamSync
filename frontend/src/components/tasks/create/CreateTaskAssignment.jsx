import { Building2, Check, Users, UserRound } from 'lucide-react';
import { FieldLabel } from '../../ui/Field';

function getUserName(user) {
    return user.username || user.email || `Użytkownik ${user.id}`;
}

function SelectionButton({
    selected,
    disabled,
    icon: Icon,
    title,
    description,
    onClick,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={[
                'flex min-h-16 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                selected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900',
                disabled ? 'cursor-not-allowed opacity-45' : '',
            ].join(' ')}
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                {selected ? (
                    <Check className="h-4 w-4 text-indigo-600" />
                ) : (
                    <Icon className="h-4 w-4 text-slate-500" />
                )}
            </span>

            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {title}
                </span>

                {description && (
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {description}
                    </span>
                )}
            </span>
        </button>
    );
}

export default function CreateTaskAssignment({
    users = [],
    groups = [],
    organizations = [],
    value,
    onChange,
    disabled = false,
}) {
    const assignedUserIds = value.assigned_user_ids || [];
    const assignedGroupIds = value.assigned_group_ids || [];
    const assignedOrganizationIds = value.assigned_organization_ids || [];

    const selectedGroups = groups.filter((group) =>
        assignedGroupIds.includes(group.id)
    );

    const selectedUsers = users.filter((user) =>
        assignedUserIds.includes(user.id)
    );

    const selectedOrganizationId = assignedOrganizationIds[0] || null;

    const scopeOrganizationId =
        selectedOrganizationId ||
        selectedGroups.find((group) => group.organization_id)?.organization_id ||
        selectedUsers.find((user) => user.organization_id)?.organization_id ||
        null;

    const coveredUserIds = new Set(
        selectedGroups.flatMap((group) =>
            (group.members || []).map((member) => member.id)
        )
    );

    const updateAssignments = (updates) => {
        onChange({
            assigned_user_ids: assignedUserIds,
            assigned_group_ids: assignedGroupIds,
            assigned_organization_ids: assignedOrganizationIds,
            ...updates,
        });
    };

    const toggleOrganization = (organizationId) => {
        if (selectedOrganizationId === organizationId) {
            updateAssignments({
                assigned_organization_ids: [],
            });
            return;
        }

        updateAssignments({
            assigned_organization_ids: [organizationId],
            assigned_group_ids: [],
            assigned_user_ids: [],
        });
    };

    const toggleGroup = (group) => {
        const selected = assignedGroupIds.includes(group.id);

        if (selected) {
            updateAssignments({
                assigned_group_ids: assignedGroupIds.filter((id) => id !== group.id),
            });
            return;
        }

        const memberIds = new Set(
            (group.members || []).map((member) => member.id)
        );

        updateAssignments({
            assigned_organization_ids: [],
            assigned_group_ids: [...assignedGroupIds, group.id],
            assigned_user_ids: assignedUserIds.filter((id) => !memberIds.has(id)),
        });
    };

    const toggleUser = (user) => {
        const selected = assignedUserIds.includes(user.id);

        updateAssignments({
            assigned_organization_ids: [],
            assigned_user_ids: selected
                ? assignedUserIds.filter((id) => id !== user.id)
                : [...assignedUserIds, user.id],
        });
    };

    return (
        <div className="space-y-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div>
                <FieldLabel>Przypisanie zadania</FieldLabel>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Zadanie może dotyczyć jednej organizacji. Wybranie całej organizacji
                    zastępuje przypisanie jej działów i użytkowników.
                </p>
            </div>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Cała organizacja
                    </h3>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {organizations.map((organization) => (
                        <SelectionButton
                            key={organization.id}
                            icon={Building2}
                            selected={selectedOrganizationId === organization.id}
                            disabled={disabled}
                            title={organization.name}
                            description={`${organization.user_count || 0} użytkowników`}
                            onClick={() => toggleOrganization(organization.id)}
                        />
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Działy i grupy
                    </h3>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {groups.map((group) => {
                        const wrongOrganization =
                            scopeOrganizationId &&
                            group.organization_id &&
                            group.organization_id !== scopeOrganizationId;

                        return (
                            <SelectionButton
                                key={group.id}
                                icon={Users}
                                selected={assignedGroupIds.includes(group.id)}
                                disabled={
                                    disabled ||
                                    Boolean(selectedOrganizationId) ||
                                    Boolean(wrongOrganization)
                                }
                                title={group.name}
                                description={
                                    group.department ||
                                    `${group.members?.length || group.member_count || 0} członków`
                                }
                                onClick={() => toggleGroup(group)}
                            />
                        );
                    })}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Wybrane osoby
                    </h3>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {users.map((user) => {
                        const coveredByGroup = coveredUserIds.has(user.id);

                        const wrongOrganization =
                            scopeOrganizationId &&
                            user.organization_id &&
                            user.organization_id !== scopeOrganizationId;

                        return (
                            <SelectionButton
                                key={user.id}
                                icon={UserRound}
                                selected={assignedUserIds.includes(user.id)}
                                disabled={
                                    disabled ||
                                    Boolean(selectedOrganizationId) ||
                                    coveredByGroup ||
                                    Boolean(wrongOrganization)
                                }
                                title={getUserName(user)}
                                description={
                                    coveredByGroup
                                        ? 'Przypisany przez wybrany dział'
                                        : user.organization_name || user.email
                                }
                                onClick={() => toggleUser(user)}
                            />
                        );
                    })}
                </div>
            </section>
        </div>
    );
}