
import { Product } from './product';

type CartItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku: string;
    // Para modificación de precios
    originalPrice?: number;
    modifiedPrice?: number;
    priceModifiedBy?: string; // userId que modificó el precio
    priceModificationReason?: string;
    // Propiedades opcionales del producto completo
    category?: string;
    costPrice?: number;
    stock?: Record<string, number>;
    imageUrl?: string;
    hint?: string;
};

export type Sale = {
    id: string;
    saleNumber?: number; // Número secuencial de venta
    date: number; // timestamp
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    branchId: string;
    // Información del cliente (opcional)
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
};

    