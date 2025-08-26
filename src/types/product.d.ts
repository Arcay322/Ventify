export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number; // Nuevo campo para el costo
  stock: Record<string, number>; // Objeto para stock por sucursal: { branchId: quantity }
  sku: string;
  imageUrl: string;
  hint: string;
  supplier?: string;
};
