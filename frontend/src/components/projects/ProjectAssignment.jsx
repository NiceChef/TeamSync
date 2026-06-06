import {
    Building2,
    Check,
    UserRound,
    Users,
} from 'lucide-react';

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

export default function ProjectAssignment({
    users = [],
    groups = [],
    organizations = [],
    memberIds = [],
    groupIds = [],
    organizationIds = [],
    onChange,
    disabled = false,
    allowOrganizations = false,
}) {
    const selectedMemberIds = memberIds || [];
    const selectedGroupIds = groupIds || [];
    const selectedOrganizationIds = organizationIds || [];

    const selectedGroups = groups.filter((group) =>
        selectedGroupIds.includes(group.id)
    );

    const coveredUserIds = new Set(
        selectedGroups.flatMap((group) =>
            (group.members || []).map((member) => member.id)
        )
    );

    const update = (
        nextMemberIds,
        nextGroupIds,
        nextOrganizationIds,
    ) => {
        onChange({
            member_ids: nextMemberIds,
            assigned_group_ids: nextGroupIds,
            assigned_organization_ids: nextOrganizationIds,
        });
    };

    const toggleOrganization = (organization) => {
        const selected = selectedOrganizationIds.includes(organization.id);

        const nextOrganizationIds = selected
            ? selectedOrganizationIds.filter(
                (id) => id !== organization.id
            )
            : [
                ...selectedOrganizationIds,
                organization.id,
            ];

        const coveredOrganizationIds = new Set(nextOrganizationIds);

        const nextGroupIds = selectedGroupIds.filter((groupId) => {
            const group = groups.find((item) => item.id === groupId);

            return (
                !group ||
                !coveredOrganizationIds.has(group.organization_id)
            );
        });

        const nextMemberIds = selectedMemberIds.filter((userId) => {
            const user = users.find((item) => item.id === userId);

            return (
                !user ||
                !coveredOrganizationIds.has(user.organization_id)
            );
        });

        update(
            nextMemberIds,
            nextGroupIds,
            nextOrganizationIds,
        );
    };

    const toggleGroup = (group) => {
        const selected = selectedGroupIds.includes(group.id);

        const nextGroupIds = selected
            ? selectedGroupIds.filter((id) => id !== group.id)
            : [
                ...selectedGroupIds,
                group.id,
            ];

        const groupMemberIds = new Set(
            (group.members || []).map((member) => member.id)
        );

        const nextMemberIds = selected
            ? selectedMemberIds
            : selectedMemberIds.filter(
                (userId) => !groupMemberIds.has(userId)
            );

        update(
            nextMemberIds,
            nextGroupIds,
            selectedOrganizationIds,
        );
    };

    const toggleUser = (user) => {
        const selected = selectedMemberIds.includes(user.id);

        const nextMemberIds = selected
            ? selectedMemberIds.filter((id) => id !== user.id)
            : [
                ...selectedMemberIds,
                user.id,
            ];

        update(
            nextMemberIds,
            selectedGroupIds,
            selectedOrganizationIds,
        );
    };

    return (
        <div className="space-y-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />

                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Dostęp do całego projektu
                    </h3>
                </div>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Wybrane osoby, działy i organizacje zobaczą projekt
                    oraz wszystkie znajdujące się w nim zadania.
                </p>
            </div>

            {allowOrganizations && organizations.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />

                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Organizacje
                        </h4>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {organizations.map((organization) => (
                            <SelectionButton
                                key={organization.id}
                                icon={Building2}
                                selected={selectedOrganizationIds.includes(
                                    organization.id
                                )}
                                disabled={disabled}
                                title={organization.name}
                                description={`${organization.user_count || 0} użytkowników`}
                                onClick={() =>
                                    toggleOrganization(organization)
                                }
                            />
                        ))}
                    </div>
                </section>
            )}

            {groups.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />

                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Działy
                        </h4>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {groups.map((group) => {
                            const coveredByOrganization =
                                selectedOrganizationIds.includes(
                                    group.organization_id
                                );

                            return (
                                <SelectionButton
                                    key={group.id}
                                    icon={Users}
                                    selected={selectedGroupIds.includes(
                                        group.id
                                    )}
                                    disabled={
                                        disabled ||
                                        coveredByOrganization
                                    }
                                    title={group.name}
                                    description={
                                        coveredByOrganization
                                            ? 'Dostęp przez organizację'
                                            : group.organization_name ||
                                            `${group.member_count || 0} członków`
                                    }
                                    onClick={() => toggleGroup(group)}
                                />
                            );
                        })}
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-500" />

                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Osoby
                    </h4>
                </div>

                {users.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Brak dostępnych użytkowników.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {users.map((user) => {
                            const coveredByOrganization =
                                selectedOrganizationIds.includes(
                                    user.organization_id
                                );

                            const coveredByGroup =
                                coveredUserIds.has(user.id);

                            return (
                                <SelectionButton
                                    key={user.id}
                                    icon={UserRound}
                                    selected={selectedMemberIds.includes(
                                        user.id
                                    )}
                                    disabled={
                                        disabled ||
                                        coveredByOrganization ||
                                        coveredByGroup
                                    }
                                    title={getUserName(user)}
                                    description={
                                        coveredByOrganization
                                            ? 'Dostęp przez organizację'
                                            : coveredByGroup
                                                ? 'Dostęp przez dział'
                                                : user.organization_name ||
                                                user.email
                                    }
                                    onClick={() => toggleUser(user)}
                                />
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}