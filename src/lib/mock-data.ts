import { Product } from '@/types/product';
import { Customer } from '@/types/customer';
import { Branch } from '@/types/branch';


export const mockBranches: Branch[] = [
  { id: 'branch-1', name: 'Tienda Centro', address: 'Av. Sol 123, Cusco' },
  { id: 'branch-2', name: 'Almacén Principal', address: 'Calle Luna 456, Arequipa' },
];

export const mockProducts: Product[] = [
  {
    id: 'elec-001',
    sku: 'ELEC-001',
    name: 'Auriculares Inalámbricos',
    category: 'Electrónica',
    price: 79.99,
    costPrice: 45.50,
    stock: { 'branch-1': 5, 'branch-2': 3 },
    imageUrl: 'https://picsum.photos/400/300?random=1',
    hint: 'headphones music',
    supplier: 'Proveedor A',
  },
  {
    id: 'ropa-002',
    sku: 'ROPA-002',
    name: 'Camiseta de Algodón',
    category: 'Ropa',
    price: 24.99,
    costPrice: 12.00,
    stock: { 'branch-1': 30, 'branch-2': 20 },
    imageUrl: 'https://picsum.photos/400/300?random=2',
    hint: 'tshirt clothing',
    supplier: 'Proveedor B',
  },
  {
    id: 'hogar-003',
    sku: 'HGR-003',
    name: 'Taza de Cerámica',
    category: 'Hogar',
    price: 12.50,
    costPrice: 6.75,
    stock: { 'branch-1': 20, 'branch-2': 15 },
    imageUrl: 'https://picsum.photos/400/300?random=3',
    hint: 'mug coffee',
    supplier: 'Proveedor C',
  },
  {
    id: 'elec-004',
    sku: 'ELEC-004',
    name: 'Teclado Mecánico',
    category: 'Electrónica',
    price: 120.00,
    costPrice: 80.00,
    stock: { 'branch-1': 2, 'branch-2': 3 },
    imageUrl: 'https://picsum.photos/400/300?random=4',
    hint: 'keyboard computer',
    supplier: 'Proveedor A',
  },
];


export const mockCategories = ["Todos", "Electrónica", "Ropa", "Hogar", "Libros", "Alimentos"];

export const mockCustomers: Customer[] = [
  {
    id: 'cus-001',
    name: 'Juan Pérez',
    email: 'juan.perez@example.com',
    phone: '+1234567890',
    totalPurchases: 5,
    totalSpent: 350.75,
  },
  {
    id: 'cus-002',
    name: 'María García',
    email: 'maria.garcia@example.com',
    phone: '+0987654321',
    totalPurchases: 12,
    totalSpent: 890.50,
  },
];
