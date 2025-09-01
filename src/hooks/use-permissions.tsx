"use client"

import { useAuth } from './use-auth';

export type Permission = 
  | 'register_sale'
  | 'associate_customer'
  | 'modify_price'
  | 'apply_discount'
  | 'process_return'
  | 'manage_products'
  | 'manage_users'
  | 'manage_branches'
  | 'view_reports'
  | 'manage_cash_register';

export interface RolePermissions {
  owner: Permission[];
  admin: Permission[];
  manager: Permission[];
  cashier: Permission[];
}

const ROLE_PERMISSIONS: RolePermissions = {
  owner: [
    'register_sale',
    'associate_customer', 
    'modify_price',
    'apply_discount',
    'process_return',
    'manage_products',
    'manage_users',
    'manage_branches',
    'view_reports',
    'manage_cash_register'
  ],
  admin: [
    'register_sale',
    'associate_customer',
    'modify_price', 
    'apply_discount',
    'process_return',
    'manage_products',
    'manage_users',
    'manage_branches',
    'view_reports',
    'manage_cash_register'
  ],
  manager: [
    'register_sale',
    'associate_customer',
    'modify_price', // Configurable por admin
    'apply_discount', // Configurable por admin
    'process_return',
    'manage_products',
    'view_reports',
    'manage_cash_register'
  ],
  cashier: [
    'register_sale',
    'associate_customer',
    'apply_discount', // Cajeros pueden aplicar descuentos limitados
    'process_return'
    // No puede modificar precios directamente
  ]
};

export function usePermissions() {
  const { userDoc } = useAuth();
  
  const hasPermission = (permission: Permission): boolean => {
    if (!userDoc?.role) return false;
    
    const role = userDoc.role as keyof RolePermissions;
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    
    return rolePermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canModifyPrice = (): boolean => {
    return hasPermission('modify_price');
  };

  const canApplyDiscount = (): boolean => {
    return hasPermission('apply_discount');
  };

  const canManageUsers = (): boolean => {
    return hasPermission('manage_users');
  };

  const canManageProducts = (): boolean => {
    return hasPermission('manage_products');
  };

  const canViewReports = (): boolean => {
    return hasPermission('view_reports');
  };

  const getUserRole = (): string => {
    return userDoc?.role || 'guest';
  };

  const isOwner = (): boolean => {
    return userDoc?.role === 'owner';
  };

  const isAdmin = (): boolean => {
    return userDoc?.role === 'admin';
  };

  const isManager = (): boolean => {
    return userDoc?.role === 'manager';
  };

  const isCashier = (): boolean => {
    return userDoc?.role === 'cashier';
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canModifyPrice,
    canApplyDiscount,
    canManageUsers,
    canManageProducts,
    canViewReports,
    getUserRole,
    isOwner,
    isAdmin,
    isManager,
    isCashier,
    userRole: userDoc?.role
  };
}