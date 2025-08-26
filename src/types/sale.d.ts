
import { Product } from './product';

type CartItem = Product & { quantity: number };

export type Sale = {
    id: string;
    date: number; // timestamp
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    branchId: string;
};

    