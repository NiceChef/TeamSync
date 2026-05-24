export const ROLE = {
    CLIENT: 'client',
    EMPLOYEE: 'employee',
};

export const isClient = (user) => user?.role === ROLE.CLIENT;

// Konto pracownicze może zarządzać (tworzyć/edytować grupy, projekty, wydarzenia itp.).
export const canManage = (user) => !!user && user.role !== ROLE.CLIENT;
