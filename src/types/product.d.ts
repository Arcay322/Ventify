export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number; // Nuevo campo para el costo
  stock: Record<string, number>; // Objeto para stock por sucursal: { branchId: quantity }
  reservedStock?: Record<string, number>; // Stock comprometido en reservas por sucursal: { branchId: quantity }
  sku: string;
  imageUrl: string;
  hint: string;
  supplier?: string;
  accountId: string; // ID de la cuenta a la que pertenece el producto
};
