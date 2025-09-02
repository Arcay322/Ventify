export interface Branch {
  id: string;
  name: string;
  address: string;
  accountId: string; // Para multi-tenancy
  phone?: string;
  email?: string;
  manager?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateBranchRequest {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  manager?: string;
}
