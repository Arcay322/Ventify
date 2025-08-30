export type Role = 'owner' | 'admin' | 'manager' | 'cashier';

export type User = {
    id: string;
    name: string;
    email: string;
    role: Role;
    // branchId is optional (owners/admins may not be tied to a single branch)
    branchId?: string;
    accountId?: string;
    displayName?: string;
};