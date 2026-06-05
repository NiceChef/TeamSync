export const ROLE = {
    CLIENT: 'client',
    INTERNAL: 'internal',
};

export const isClient = (user) => user?.role === ROLE.CLIENT;

export const isInternal = (user) => user?.role === ROLE.INTERNAL;

export const isApproved = (user) => user?.approval_status === 'approved';

export const canManage = (user) => isApproved(user) && isInternal(user);