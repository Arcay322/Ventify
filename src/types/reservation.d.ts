import { Product } from './product';

type ReservationItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku: string;
    // Para modificación de precios
    originalPrice?: number;
    modifiedPrice?: number;
    priceModifiedBy?: string;
    priceModificationReason?: string;
    // Propiedades opcionales del producto completo
    category?: string;
    costPrice?: number;
    stock?: Record<string, number>;
    imageUrl?: string;
    hint?: string;
};

export type ReservationStatus = 'pending' | 'completed' | 'cancelled' | 'expired';

export type Reservation = {
    id: string;
    reservationNumber?: number; // Número secuencial de reserva
    date: number; // timestamp de creación
    expiryDate?: number; // timestamp de expiración (opcional)
    items: ReservationItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    status: ReservationStatus;
    branchId: string;
    createdBy: string; // userId del empleado que creó la reserva
    
    // Información del cliente (requerida para reservas)
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    
    // Información adicional de la reserva
    notes?: string; // Notas adicionales sobre la reserva
    depositAmount?: number; // Monto de anticipo/depósito (opcional)
    reservationDays?: number; // Días que se mantendrá la reserva
    
    // Información de completado (cuando se convierte en venta)
    completedDate?: number;
    saleId?: string; // ID de la venta cuando se completa
    paymentMethod?: string; // Se llena cuando se completa
    
    // Información adicional de pago (para tracking completo)
    finalPaymentAmount?: number; // Monto cobrado en el pago final
    totalPaid?: number; // Total pagado (depósito + pago final)
    originalTotal?: number; // Total original calculado para referencia
};
