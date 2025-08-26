export type Role = 'Administrador' | 'Cajero';

export type User = {
    id: string;
    name: string;
    email: string;
    role: Role;
    branchId: string;
};