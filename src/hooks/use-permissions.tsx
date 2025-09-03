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
  | 'manage_cash_register'
  | 'request_transfer'
  | 'approve_transfer'
  | 'manage_transfers'
  | 'access_dashboard';

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
    'manage_cash_register',
    'request_transfer',
    'approve_transfer',
    'manage_transfers',
    'access_dashboard'
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
    'manage_cash_register',
    'request_transfer',
    'approve_transfer',
    'manage_transfers',
    'access_dashboard'
  ],
  manager: [
    'register_sale',
    'associate_customer',
    'modify_price',
    'apply_discount',
    'process_return',
    'manage_products',
    'view_reports',
    'manage_cash_register',
    'request_transfer',
    'approve_transfer',
    'manage_transfers',
    'access_dashboard'
  ],
  cashier: [
    'register_sale',
    'associate_customer',
    'apply_discount',
    'process_return',
    'request_transfer'
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

  const canAccessDashboard = (): boolean => {
    return hasPermission('access_dashboard');
  };

  const canRequestTransfer = (): boolean => {
    return hasPermission('request_transfer');
  };

  const canApproveTransfer = (): boolean => {
    return hasPermission('approve_transfer');
  };

  const canManageTransfers = (): boolean => {
    return hasPermission('manage_transfers');
  };

  // Funciones específicas para transferencias con lógica de negocio
  const canRequestTransferFromBranch = (branchId: string): boolean => {
    const role = userDoc?.role;
    const userBranchId = userDoc?.branchId;
    
    // Owner y admin pueden solicitar desde cualquier sucursal
    if (role === 'owner' || role === 'admin') {
      return true;
    }
    
    // Manager y cashier solo pueden solicitar desde su sucursal
    if (role === 'manager' || role === 'cashier') {
      return userBranchId === branchId;
    }
    
    return false;
  };

  const canApproveTransferToBranch = (branchId: string): boolean => {
    const role = userDoc?.role;
    const userBranchId = userDoc?.branchId;
    
    // Owner y admin pueden aprobar transferencias a cualquier sucursal
    if (role === 'owner' || role === 'admin') {
      return true;
    }
    
    // Manager solo puede aprobar transferencias que lleguen a su sucursal
    if (role === 'manager') {
      return userBranchId === branchId;
    }
    
    // Cashier no puede aprobar transferencias
    return false;
  };

  const canCreateDirectTransfer = (): boolean => {
    const role = userDoc?.role;
    // Solo owner y admin pueden crear transferencias directas sin solicitud
    return role === 'owner' || role === 'admin';
  };

  const canViewTransfer = (transfer: { sourceBranchId: string; destinationBranchId: string }): boolean => {
    const role = userDoc?.role;
    const userBranchId = userDoc?.branchId;
    
    // Owner y admin pueden ver todas las transferencias
    if (role === 'owner' || role === 'admin') {
      return true;
    }
    
    // Manager y cashier pueden ver transferencias donde su sucursal esté involucrada
    if (role === 'manager' || role === 'cashier') {
      return userBranchId === transfer.sourceBranchId || userBranchId === transfer.destinationBranchId;
    }
    
    return false;
  };

  const canUpdateTransferStatus = (transfer: { status: string; sourceBranchId: string; destinationBranchId: string }, newStatus: string): boolean => {
    const role = userDoc?.role;
    const userBranchId = userDoc?.branchId;
    
    // Owner y admin pueden actualizar cualquier estado
    if (role === 'owner' || role === 'admin') {
      return true;
    }
    
    // Transiciones específicas por rol
    switch (newStatus) {
      case 'approved':
      case 'rejected':
        // Solo managers pueden aprobar/rechazar, y solo para su sucursal de destino
        return role === 'manager' && userBranchId === transfer.destinationBranchId && transfer.status === 'pending';
      
      case 'in_transit':
        // Personal de la sucursal origen puede marcar como en tránsito
        return (role === 'manager' || role === 'cashier') && userBranchId === transfer.sourceBranchId && transfer.status === 'approved';
      
      case 'completed':
        // Personal de la sucursal destino puede marcar como completado
        return (role === 'manager' || role === 'cashier') && userBranchId === transfer.destinationBranchId && transfer.status === 'in_transit';
      
      default:
        return false;
    }
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
    canAccessDashboard,
    canRequestTransfer,
    canApproveTransfer,
    canManageTransfers,
    // Funciones específicas para transferencias
    canRequestTransferFromBranch,
    canApproveTransferToBranch,
    canCreateDirectTransfer,
    canViewTransfer,
    canUpdateTransferStatus,
    getUserRole,
    isOwner,
    isAdmin,
    isManager,
    isCashier,
    userRole: userDoc?.role,
    userBranchId: userDoc?.branchId
  };
}