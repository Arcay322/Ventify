
"use client"

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Trash2, X, Search, CreditCard, Wallet, Coins, CornerDownLeft, History, User, Calendar, Clock, ChevronDown, Filter, Receipt, Copy, Eye, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from '@/types/product';
import type { Sale } from '@/types/sale';
import { Input } from '@/components/ui/input';
import { ReceiptModal } from '@/components/receipt-modal';
import { ReturnModal } from '@/components/return-modal';
import { ReservationModal } from '@/components/reservation-modal';
import { ReservationReceiptModal } from '@/components/reservation-receipt-modal';
import { ReservationsManager } from '@/components/reservations-manager';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CustomerSelector } from '@/components/customer-selector';
import { AdvancedPriceEditor } from '@/components/advanced-price-editor';
import { PromotionManager } from '@/components/promotion-manager';
import { Customer } from '@/types/customer';
import { usePermissions } from '@/hooks/use-permissions';
import { DiscountSettingsService, DiscountSettings, DEFAULT_DISCOUNT_SETTINGS } from '@/services/discount-settings-service';
import { DebugProducts } from '@/components/debug-products';
import { getProducts } from '@/services/product-service';
import { getBranches } from '@/services/branch-service';
import { getSales, saveSale } from '@/services/sales-service';
import { ReservationService } from '@/services/reservation-service';
import { StockReservationService } from '@/services/stock-reservation-service';
import { Reservation } from '@/types/reservation';
import { getActiveCashRegisterSession, createCashRegisterSession, addSaleToActiveSession } from '@/services/cash-register-service';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type CartItem = Product & { 
    quantity: number;
    originalPrice?: number;
    modifiedPrice?: number;
    priceModifiedBy?: string;
};



export default function SalesPage() {
    const authState = useAuth();
    const searchParams = useSearchParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const { toast } = useToast();
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");
    const [activeSession, setActiveSession] = useState<any | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
    const [transactionSearch, setTransactionSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [cardAmount, setCardAmount] = useState<number>(0);
    const { canApplyDiscount, isCashier, getUserRole } = usePermissions();
    const [discountSettings, setDiscountSettings] = useState<DiscountSettings>(DEFAULT_DISCOUNT_SETTINGS);
    
    // Estados para reservas
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [reservationToComplete, setReservationToComplete] = useState<Reservation | null>(null);
    const [isReservationReceiptModalOpen, setIsReservationReceiptModalOpen] = useState(false);
    
    // Control de tabs
    const activeTab = searchParams.get('tab') || 'pos';
    
    // Estados para transacciones mejoradas
    const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(null);
    const [transactionFilters, setTransactionFilters] = useState({
        branchId: 'all',
        paymentMethod: 'all',
        dateFrom: null as Date | null,
        dateTo: null as Date | null,
        status: 'all' // completed, returned, partial
    });
    const [sortBy, setSortBy] = useState<'date' | 'total' | 'customer'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
    const [completedReservation, setCompletedReservation] = useState<Reservation | null>(null);

    // Helper function to get available stock (physical - reserved)
    const getAvailableStock = useCallback((product: Product, branchId: string): number => {
        return StockReservationService.getAvailableStock(product, branchId);
    }, []);

    // Limpiar montos cuando se cambia el método de pago
    useEffect(() => {
        if (paymentMethod !== 'Mixto') {
            setCashAmount(0);
            setCardAmount(0);
        }
    }, [paymentMethod]);

    // Cargar configuraciones de descuento
    useEffect(() => {
        const loadDiscountSettings = async () => {
            if (authState.user?.uid && authState.userDoc?.accountId) {
                try {
                    const settings = await DiscountSettingsService.getDiscountSettings(authState.userDoc.accountId);
                    setDiscountSettings(settings);
                } catch (error) {
                    console.error('Error loading discount settings:', error);
                    // Usar configuraciones por defecto si hay error
                    setDiscountSettings(DEFAULT_DISCOUNT_SETTINGS);
                }
            }
        };
        
        loadDiscountSettings();
    }, [authState.user?.uid, authState.userDoc?.accountId]);

    // Efecto separado para datos básicos (productos, ventas, sucursales)
    useEffect(() => {
        if (!authState.initialized) return;
        
        const accountId = authState.userDoc?.accountId as string | undefined;
        // Setting up basic data subscriptions
        
        const unsubProd = getProducts(setProducts, accountId);
        const unsubSales = getSales(setSalesHistory, accountId);
        const unsubBranches = getBranches(setBranches, accountId);
        
        return () => {
            unsubProd();
            unsubSales();
            unsubBranches();
        };
    }, [authState.initialized, authState.userDoc?.accountId]);

    // Efecto separado para sesión de caja (depende de sucursal seleccionada)
    useEffect(() => {
        if (!authState.initialized || !selectedBranch) {
            setActiveSession(null);
            setSessionLoading(false);
            return;
        }
        
        const accountId = authState.userDoc?.accountId as string | undefined;
        // Setting up cash register session
        
        setSessionLoading(true);
        const unsubSession = getActiveCashRegisterSession(selectedBranch, accountId, (session) => {
            setActiveSession(session);
            setSessionLoading(false);
        });
        
        return () => {
            if (unsubSession) unsubSession();
        };
    }, [authState.initialized, authState.userDoc?.accountId, selectedBranch]);

    // Optimizar cálculos con useMemo
    const calculations = useMemo(() => {
        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        // En Perú, el IGV se incluye en el precio. Calculamos el IGV sobre el subtotal
        const taxableAmount = subtotal;
        const tax = taxableAmount > 0 ? (taxableAmount * 0.18) / 1.18 : 0; // IGV incluido en precio
        const subtotalWithoutTax = subtotal - tax;
        
        // Aplicar descuento al total (subtotal con IGV)
        const totalAfterDiscount = Math.max(0, subtotal - discount);
        
        // Recalcular IGV después del descuento
        const finalTax = totalAfterDiscount > 0 ? (totalAfterDiscount * 0.18) / 1.18 : 0;
        const discountedSubtotalWithoutTax = totalAfterDiscount - finalTax;
        
        return {
            subtotal,
            tax,
            subtotalWithoutTax,
            discountedSubtotalWithoutTax,
            finalTax,
            total: totalAfterDiscount
        };
    }, [cart, discount]);
    
    const { subtotal, tax, subtotalWithoutTax, discountedSubtotalWithoutTax, finalTax, total } = calculations;

    const clearCart = useCallback((skipConfirmation = false) => {
        if (cart.length === 0) return;
        
        const shouldClear = skipConfirmation || window.confirm('¿Estás seguro de que quieres limpiar el carrito? Se perderán todos los productos agregados.');
        
        if (shouldClear) {
            setCart([]); 
            setDiscount(0); 
            setDiscountInput(""); 
            setSelectedCustomer(null);
            setCashAmount(0);
            setCardAmount(0);
            if (!skipConfirmation) {
                toast({ title: "Carrito limpiado", description: "Se han eliminado todos los productos del carrito." });
            }
        }
    }, [cart.length, toast]);

    const processPayment = useCallback(async () => {
        // Validaciones previas
        if (cart.length === 0) {
            toast({ title: "Carrito Vacío", description: "No se puede procesar el pago de un carrito vacío.", variant: "destructive" });
            return;
        }
        if (!activeSession) {
            toast({ title: "Caja Cerrada", description: "Necesitas abrir una caja para procesar ventas.", variant: "destructive" });
            return;
        }
        if (total <= 0) {
            toast({ title: "Total Inválido", description: "El total de la venta debe ser mayor a cero.", variant: "destructive" });
            return;
        }

        // Validar método de pago mixto
        if (paymentMethod === 'Mixto') {
            const totalPaid = cashAmount + cardAmount;
            const difference = Math.abs(total - totalPaid);
            
            if (difference > 0.01) { // Permitir diferencia mínima por redondeo
                toast({ 
                    title: "Error en Pago Mixto", 
                    description: `El total de los pagos (S/${totalPaid.toFixed(2)}) no coincide con el total de la venta (S/${total.toFixed(2)}). Diferencia: S/${(total - totalPaid).toFixed(2)}`, 
                    variant: "destructive" 
                });
                return;
            }

            if (cashAmount < 0 || cardAmount < 0) {
                toast({ 
                    title: "Montos Inválidos", 
                    description: "Los montos de efectivo y tarjeta no pueden ser negativos.", 
                    variant: "destructive" 
                });
                return;
            }
        }
        
        setIsProcessingPayment(true);

        // Validar que todos los campos requeridos no sean undefined
        if (total === undefined || subtotalWithoutTax === undefined || finalTax === undefined) {
            toast({ title: "Error de cálculo", description: "Error en los cálculos de la venta.", variant: "destructive" });
            setIsProcessingPayment(false);
            return;
        }

        // Limpiar items del carrito para evitar campos undefined
        const cleanItems = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            sku: item.sku || '',
            // Solo incluir campos opcionales si existen
            ...(item.originalPrice !== undefined && { originalPrice: Number(item.originalPrice) }),
            ...(item.modifiedPrice !== undefined && { modifiedPrice: Number(item.modifiedPrice) }),
            ...(item.priceModifiedBy && { priceModifiedBy: item.priceModifiedBy }),
        }));

        const newSale: Sale = {
            id: `SALE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            date: new Date().getTime(),
            items: cleanItems,
            total: Number(total) || 0,
            subtotal: Number(subtotalWithoutTax) || 0, // Subtotal sin IGV
            tax: Number(finalTax) || 0, // IGV final después del descuento
            discount: Number(discount) || 0,
            paymentMethod: paymentMethod || 'Efectivo',
            branchId: selectedBranch || (authState.userDoc?.branchId as string) || 'branch-1',
        };

        // Agregar detalles de pago mixto si aplica
        if (paymentMethod === 'Mixto') {
            (newSale as any).cashAmount = Number(cashAmount) || 0;
            (newSale as any).cardAmount = Number(cardAmount) || 0;
        }

        // Solo agregar campos de cliente si existen
        if (selectedCustomer?.id) {
            (newSale as any).customerId = selectedCustomer.id;
        }
        if (selectedCustomer?.name) {
            (newSale as any).customerName = selectedCustomer.name;
        }
        if (selectedCustomer?.email) {
            (newSale as any).customerEmail = selectedCustomer.email;
        }
        if (selectedCustomer?.phone) {
            (newSale as any).customerPhone = selectedCustomer.phone;
        }

        try {
            // attach accountId at save time (Sale type doesn't include accountId in definition)
            const saleForSave = { ...newSale } as any;
            
            // Solo agregar accountId si existe
            if (authState.userDoc?.accountId) {
                saleForSave.accountId = authState.userDoc.accountId;
            }
            
            // Solo agregar sessionId si existe
            if (activeSession?.id) {
                saleForSave.sessionId = activeSession.id;
            }
            
            const saleForSaveWithSession = saleForSave;
            const result = await saveSale(saleForSaveWithSession);
            // Session counters are updated automatically in saveSale
            newSale.id = result.saleId;
            newSale.saleNumber = result.saleNumber;
            
            // Si esta venta completa una reserva, actualizarla
            if (reservationToComplete) {
                try {
                    // Calcular totales originales de la reserva
                    const originalTotal = reservationToComplete.items.reduce((sum, item) => 
                        sum + (item.price * item.quantity), 0) - reservationToComplete.discount;
                    const depositAmount = reservationToComplete.depositAmount || 0;
                    const remainingAmount = originalTotal - depositAmount;
                    
                    // Si la reserva ya estaba completamente pagada, el pago final es 0
                    // Si tenía saldo pendiente, el pago final es lo que se cobra ahora
                    const finalPaymentAmount = remainingAmount <= 0 ? 0 : total;
                    
                    await ReservationService.completeReservation(
                        reservationToComplete.id, 
                        paymentMethod, 
                        result.saleId,
                        finalPaymentAmount
                    );
                    
                    // Mostrar información completa del pago
                    if (remainingAmount <= 0) {
                        toast({
                            title: "Reserva completada",
                            description: `Reserva #${reservationToComplete.reservationNumber} completada. Ya estaba completamente pagada (S/${originalTotal.toFixed(2)}). Nota de pedido generada.`
                        });
                    } else {
                        toast({
                            title: "Reserva completada",
                            description: `Reserva #${reservationToComplete.reservationNumber} completada. Total: S/${originalTotal.toFixed(2)} (Adelanto: S/${depositAmount.toFixed(2)} + Final: S/${finalPaymentAmount.toFixed(2)})`
                        });
                    }
                    
                    setReservationToComplete(null);
                } catch (reservationError) {
                    console.error('Error completing reservation:', reservationError);
                    // La venta se guardó exitosamente, solo notificamos el error de reserva
                    toast({
                        title: "Venta procesada, error en reserva",
                        description: "La venta se procesó correctamente pero hubo un error actualizando la reserva",
                        variant: "destructive"
                    });
                }
            }
            
            setCompletedSale(newSale);
            setIsReceiptModalOpen(true);
            clearCart(true); // true = skip confirmation
        } catch (err) {
            console.error('Error saving sale:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            toast({ 
                title: 'Error al procesar venta', 
                description: `No se pudo completar la venta: ${errorMessage}`, 
                variant: 'destructive' 
            });
        } finally {
            setIsProcessingPayment(false);
        }
    }, [cart, activeSession, total, subtotalWithoutTax, finalTax, discount, paymentMethod, selectedBranch, authState.userDoc?.branchId, authState.userDoc?.accountId, selectedCustomer, cashAmount, cardAmount, reservationToComplete, toast, clearCart]);

    // Shortcuts de teclado
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Solo procesar si no estamos en un input
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            switch (event.key) {
                case 'F1':
                    event.preventDefault();
                    if (cart.length > 0 && activeSession && !isProcessingPayment) {
                        processPayment();
                    }
                    break;
                case 'F2':
                    event.preventDefault();
                    clearCart();
                    break;
                case 'F3':
                    event.preventDefault();
                    document.getElementById('product-search')?.focus();
                    break;
                case 'Escape':
                    event.preventDefault();
                    setSearchQuery('');
                    break;
            }
        };
        
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [cart.length, activeSession, isProcessingPayment, processPayment, clearCart]);

    // Función para reproducir sonido de feedback
    const playSound = useCallback((type: 'success' | 'error' | 'warning') => {
        // Solo en navegadores que soporten Web Audio API
        if (typeof window !== 'undefined' && window.AudioContext) {
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Diferentes tonos para diferentes tipos
                switch (type) {
                    case 'success':
                        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                        break;
                    case 'error':
                        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                        break;
                    case 'warning':
                        oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
                        break;
                }
                
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                // Silenciar errores de audio
            }
        }
    }, []);

    // Set user's branch as default when available, or first branch for owners
    useEffect(() => {
        const userBranchId = authState.userDoc?.branchId;
        if (userBranchId && !selectedBranch) {
            setSelectedBranch(userBranchId);
        } else if (!userBranchId && branches.length > 0 && !selectedBranch) {
            // Owner or admin without specific branch - use first available branch
            setSelectedBranch(branches[0].id);
        }
    }, [authState.userDoc?.branchId, selectedBranch, branches]);

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products;
        const query = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remover acentos
        return products.filter(product => {
            const name = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const sku = product.sku.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return name.includes(query) || sku.includes(query);
        });
    }, [products, searchQuery]);

    const filteredTransactions = useMemo(() => {
        let filtered = [...salesHistory];
        
        // Filtro de búsqueda de texto
        if (transactionSearch) {
            const searchTerm = transactionSearch.toLowerCase();
            filtered = filtered.filter(s => {
                return (
                    s.id.toLowerCase().includes(searchTerm) ||
                    (s.saleNumber && s.saleNumber.toString().includes(searchTerm)) ||
                    (s.customerName && s.customerName.toLowerCase().includes(searchTerm)) ||
                    ((s as any).customerEmail && (s as any).customerEmail.toLowerCase().includes(searchTerm)) ||
                    ((s as any).customerPhone && (s as any).customerPhone.toLowerCase().includes(searchTerm)) ||
                    (s.paymentMethod && s.paymentMethod.toLowerCase().includes(searchTerm)) ||
                    s.total.toString().includes(searchTerm)
                );
            });
        }
        
        // Filtro por sucursal
        if (transactionFilters.branchId !== 'all') {
            filtered = filtered.filter(s => s.branchId === transactionFilters.branchId);
        }
        
        // Filtro por método de pago
        if (transactionFilters.paymentMethod !== 'all') {
            filtered = filtered.filter(s => s.paymentMethod === transactionFilters.paymentMethod);
        }
        
        // Filtro por rango de fechas
        if (transactionFilters.dateFrom) {
            filtered = filtered.filter(s => new Date(s.date) >= transactionFilters.dateFrom!);
        }
        if (transactionFilters.dateTo) {
            const endDate = new Date(transactionFilters.dateTo);
            endDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => new Date(s.date) <= endDate);
        }
        
        // Ordenamiento
        filtered.sort((a, b) => {
            let compareValue = 0;
            
            switch (sortBy) {
                case 'date':
                    compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                case 'total':
                    compareValue = a.total - b.total;
                    break;
                case 'customer':
                    const nameA = a.customerName || 'Sin cliente';
                    const nameB = b.customerName || 'Sin cliente';
                    compareValue = nameA.localeCompare(nameB);
                    break;
            }
            
            return sortOrder === 'asc' ? compareValue : -compareValue;
        });
        
        return filtered;
    }, [salesHistory, transactionSearch, transactionFilters, sortBy, sortOrder]);

    // Paginación
    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTransactions, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

    const addToCart = useCallback((product: Product) => {
        const branchId = selectedBranch || Object.keys(product.stock || {})[0];
        const availableStock = getAvailableStock(product, branchId);
        if (availableStock <= 0) {
            toast({ title: "Producto Agotado", description: `No queda stock disponible de ${product.name} en la sucursal seleccionada.`, variant: "destructive" });
            playSound('error');
            return;
        }

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < availableStock) {
                    playSound('success');
                    return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                } else {
                    toast({ title: "Stock insuficiente", description: `No puedes agregar más ${product.name} que el stock disponible en la sucursal.`, variant: "destructive" });
                    playSound('error');
                    return prevCart;
                }
            }
            // Al agregar un producto nuevo, guardamos el precio original
            playSound('success');
            return [...prevCart, { 
                ...product, 
                quantity: 1,
                originalPrice: product.price,
                modifiedPrice: undefined,
                priceModifiedBy: undefined
            }];
        });
    }, [selectedBranch, toast, playSound, getAvailableStock]);

    const changeQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity < 1) return; // No permitir cantidades menores a 1
        
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                // Validar stock disponible
                const branchId = selectedBranch || Object.keys(item.stock || {})[0];
                const availableStock = getAvailableStock(item, branchId);
                
                if (quantity > availableStock) {
                    toast({ 
                        title: "Stock insuficiente", 
                        description: `Solo hay ${availableStock} unidades disponibles de ${item.name}`, 
                        variant: "destructive" 
                    });
                    return item; // No cambiar la cantidad
                }
                
                return { ...item, quantity };
            }
            return item;
        }));
    }, [selectedBranch, toast, getAvailableStock]);


    const removeFromCart = (productId: string) => setCart(cart.filter(item => item.id !== productId));

    // Funciones para manejar promociones
    const handleAddToCartAsGift = useCallback((product: Product, quantity: number, price: number, reason: string) => {
        const cartItem = {
            id: product.id,
            name: product.name,
            price: price,
            originalPrice: product.price,
            quantity: quantity,
            sku: product.sku,
            priceModificationReason: reason,
            modifiedPrice: price !== product.price ? price : undefined,
            priceModifiedBy: authState.user?.uid,
            category: product.category,
            costPrice: product.costPrice,
            stock: product.stock,
            imageUrl: product.imageUrl,
            hint: product.hint
        };
        
        setCart(prev => {
            const existingIndex = prev.findIndex(item => item.id === product.id && item.price === price);
            if (existingIndex >= 0) {
                return prev.map((item, index) => 
                    index === existingIndex 
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, cartItem];
        });
    }, [authState.user?.uid]);

    const handleApplyPromotion = useCallback((promotionType: string, details: any) => {
        switch (promotionType) {
            case 'total_discount':
                // Aplicar descuento general
                const discountAmount = (subtotalWithoutTax * details.discountPercentage) / 100;
                setDiscount(discountAmount);
                setDiscountInput(discountAmount.toString());
                toast({
                    title: 'Promoción aplicada',
                    description: details.reason
                });
                break;
        }
    }, [subtotalWithoutTax, toast]);


    const applyDiscountWithValue = async (value: number) => {
        if (!canApplyDiscount()) {
            toast({ title: "Sin permisos", description: "No tienes permisos para aplicar descuentos.", variant: "destructive" });
            return;
        }
        
        setIsApplyingDiscount(true);
        
        try {
            const originalTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
            const maxDiscount = originalTotal; // Descuento máximo es el total original
            
            if (isNaN(value)) {
                throw new Error("Ingresa un valor numérico válido");
            }
            
            if (value < 0) {
                throw new Error("El descuento no puede ser negativo");
            }
            
            if (value > maxDiscount) {
                throw new Error(`El descuento máximo es S/${maxDiscount.toFixed(2)}`);
            }
            
            // Validaciones específicas por rol usando configuraciones dinámicas
            const userRole = getUserRole();
            const maxAllowedDiscount = DiscountSettingsService.calculateMaxDiscount(
                discountSettings, 
                userRole, 
                originalTotal
            );
            
            if (value > maxAllowedDiscount) {
                const discountType = userRole === 'cashier' 
                    ? discountSettings.cashierMaxDiscountType 
                    : discountSettings.managerMaxDiscountType;
                const discountLimit = userRole === 'cashier' 
                    ? discountSettings.cashierMaxDiscount 
                    : discountSettings.managerMaxDiscount;
                
                const limitText = discountType === 'amount' 
                    ? `S/${discountLimit}` 
                    : `${discountLimit}% del total`;
                
                throw new Error(`Tu límite de descuento es ${limitText} (máximo S/${maxAllowedDiscount.toFixed(2)})`);
            }
            
            // Verificar si requiere aprobación
            if (DiscountSettingsService.requiresApproval(discountSettings, value)) {
                // TODO: Implementar flujo de aprobación
                toast({
                    title: "Descuento aplicado",
                    description: `Descuento de S/${value.toFixed(2)} aplicado. Los descuentos grandes pueden requerir aprobación posterior.`,
                    variant: "default"
                });
            }
            
            // Validar descuentos muy pequeños
            if (value > 0 && value < 0.01) {
                throw new Error("El descuento mínimo es S/0.01");
            }
            
            setDiscount(value);
            setDiscountInput(value.toString());
            toast({ title: "Descuento Aplicado", description: `Se aplicó un descuento de S/${value.toFixed(2)}.` });
        } catch (error) {
            toast({ 
                title: "Error al aplicar descuento", 
                description: error instanceof Error ? error.message : "Error desconocido", 
                variant: "destructive" 
            });
        } finally {
            setIsApplyingDiscount(false);
        }
    }

    const applyDiscount = async () => {
        const value = parseFloat(discountInput);
        await applyDiscountWithValue(value);
    }


    
    const handleReturnClick = (sale: Sale) => {
        setSaleToReturn(sale);
        setIsReturnModalOpen(true);
    };

    const handleViewDetails = (sale: Sale) => {
        setSelectedTransaction(sale);
        setIsTransactionDetailOpen(true);
    };

    const handleReprintReceipt = (sale: Sale) => {
        setCompletedSale(sale);
        setIsReceiptModalOpen(true);
    };

    const handleCopyToNewSale = (sale: Sale) => {
        // Limpiar carrito actual
        setCart([]);
        
        // Agregar productos de la venta al carrito
        const newCartItems: CartItem[] = sale.items.map(item => ({
            ...item,
            quantity: item.quantity
        }));
        
        setCart(newCartItems);
        
        // Cambiar al tab de punto de venta
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('tab');
        const newUrl = newParams.toString() ? `?${newParams.toString()}` : '';
        window.history.pushState({}, '', `/sales${newUrl}`);
        
        toast({
            title: "Productos copiados",
            description: `Se copiaron ${sale.items.length} productos al carrito`,
        });
    };

    // Función para crear una reserva
    const handleCreateReservation = () => {
        if (cart.length === 0) {
            toast({
                title: "Carrito vacío",
                description: "Agrega productos al carrito antes de crear una reserva",
                variant: "destructive"
            });
            return;
        }
        setIsReservationModalOpen(true);
    };

    // Función para completar una reserva (convertir en venta)
    const handleCompleteReservation = (reservation: Reservation) => {
        // Limpiar el carrito actual
        clearCart(true);
        
        // Calcular el subtotal de la reserva original
        const originalSubtotal = reservation.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );
        
        // Calcular el total original con descuento aplicado
        const originalTotal = originalSubtotal - reservation.discount;
        
        // Si hay adelanto, calcular lo que queda por cobrar
        const remainingAmount = originalTotal - (reservation.depositAmount || 0);
        
        // Si ya se pagó todo o más, procesar la venta directamente
        if (remainingAmount <= 0) {
            // Cargar los productos con precios originales para generar la nota
            const reservationCart = reservation.items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price, // Precio original completo
                quantity: item.quantity,
                sku: item.sku,
                originalPrice: item.originalPrice,
                modifiedPrice: item.modifiedPrice,
                priceModifiedBy: item.priceModifiedBy,
                category: item.category || '',
                costPrice: item.costPrice || 0,
                stock: item.stock || {},
                imageUrl: item.imageUrl,
                hint: item.hint
            }));
            
            setCart(reservationCart);
            setDiscount(reservation.discount); // Descuento original completo
            setDiscountInput(reservation.discount.toString());
            
            // Cargar información del cliente si existe
            if (reservation.customerName) {
                const customerData: Customer = {
                    id: reservation.customerId || '',
                    name: reservation.customerName,
                    phone: reservation.customerPhone,
                    email: reservation.customerEmail
                };
                setSelectedCustomer(customerData);
            }
            
            // Marcar para completar (sin cobrar más)
            setReservationToComplete(reservation);
            
            toast({
                title: "Reserva completada",
                description: `La reserva #${reservation.reservationNumber} ya está completamente pagada. Puede generar la nota de pedido.`,
            });
            
            return;
        }
        
        // Calcular factor de proporción para ajustar precios
        const priceAdjustmentFactor = remainingAmount / originalTotal;
        
        // Cargar los productos con precios ajustados según lo que queda por pagar
        const reservationCart = reservation.items.map(item => {
            const adjustedPrice = item.price * priceAdjustmentFactor;
            return {
                id: item.id,
                name: item.name,
                price: adjustedPrice, // Precio proporcional al monto restante
                quantity: item.quantity,
                sku: item.sku,
                originalPrice: item.originalPrice,
                modifiedPrice: item.modifiedPrice,
                priceModifiedBy: item.priceModifiedBy,
                category: item.category || '',
                costPrice: item.costPrice || 0,
                stock: item.stock || {},
                imageUrl: item.imageUrl,
                hint: item.hint
            };
        });
        
        setCart(reservationCart);
        setDiscount(reservation.discount * priceAdjustmentFactor); // Ajustar descuento proporcionalmente
        setDiscountInput((reservation.discount * priceAdjustmentFactor).toString());
        
        // Cargar información del cliente si existe
        if (reservation.customerName) {
            const customerData: Customer = {
                id: reservation.customerId || '',
                name: reservation.customerName,
                phone: reservation.customerPhone,
                email: reservation.customerEmail
            };
            setSelectedCustomer(customerData);
        }
        
        // Marcar esta reserva para completar
        setReservationToComplete(reservation);
        
        toast({
            title: "Reserva cargada para completar",
            description: `Reserva #${reservation.reservationNumber} cargada. Restante por cobrar: S/${remainingAmount.toFixed(2)}`,
        });
    };

    // Función llamada cuando se crea una reserva exitosamente
    const handleReservationCreated = (reservation: Reservation) => {
        clearCart(true); // Limpiar carrito después de crear reserva
        
        // Mostrar el comprobante de reserva
        setCompletedReservation(reservation);
        setIsReservationReceiptModalOpen(true);
        
        toast({
            title: "¡Reserva creada!",
            description: `Reserva #${reservation.reservationNumber} creada exitosamente`,
        });
    };


    if (sessionLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="text-center">
                    <div className="animate-pulse text-muted-foreground">Cargando sesión de caja...</div>
                </div>
            </div>
        );
    }

    if (!selectedBranch) {
        return (
            <Alert className="max-w-xl mx-auto mt-10">
                <AlertTitle className="text-xl">Selecciona una Sucursal</AlertTitle>
                <AlertDescription>
                    Cargando sucursales disponibles...
                </AlertDescription>
            </Alert>
        );
    }

    if (!activeSession) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto mt-10">
                <AlertTitle className="text-xl">Caja Cerrada</AlertTitle>
                <AlertDescription>
                    No hay una sesión de caja activa para la sucursal {branches.find(b => b.id === selectedBranch)?.name || selectedBranch}. Para registrar nuevas ventas, primero debes abrir la caja.
                    <Button asChild className="mt-4"><Link href="/cash-management">Ir a Gestión de Caja</Link></Button>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <>
            {/* Debug Component removido - ya no es necesario */}
            
            <Tabs value={activeTab} onValueChange={(value) => {
                // Actualizar URL con el nuevo tab
                const newParams = new URLSearchParams(searchParams.toString());
                if (value !== 'pos') {
                    newParams.set('tab', value);
                } else {
                    newParams.delete('tab');
                }
                const newUrl = newParams.toString() ? `?${newParams.toString()}` : '';
                window.history.pushState({}, '', `/sales${newUrl}`);
            }}>
                <TabsList className="mb-4">
                    <TabsTrigger value="pos">Punto de Venta</TabsTrigger>
                    <TabsTrigger value="reservations">Reservas de Pedidos</TabsTrigger>
                    <TabsTrigger value="transactions">Transacciones y Devoluciones</TabsTrigger>
                </TabsList>
                <TabsContent value="pos">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full items-start">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>Seleccionar Productos</span>
                                    </CardTitle>
                                            <div className="flex items-end gap-4 mt-4">
                                                <div className="relative flex-1">
                                                    <label className="text-xs text-muted-foreground mb-1 block">Buscar productos</label>
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input 
                                                            id="product-search"
                                                            type="search" 
                                                            placeholder="Buscar por nombre o SKU..." 
                                                            className="w-full pl-8" 
                                                            value={searchQuery} 
                                                        onChange={(e) => setSearchQuery(e.target.value)} 
                                                    />
                                                    </div>
                                                </div>
                                                <div className="w-48">
                                                    <label className="text-xs text-muted-foreground mb-1 block">Sucursal</label>
                                                    <select 
                                                        value={selectedBranch || ''} 
                                                        onChange={(e) => setSelectedBranch(e.target.value)} 
                                                        className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    >
                                                        {branches.map(b => (
                                                            <option key={b.id} value={b.id}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[calc(100vh-25rem)] overflow-y-auto">
                                    {/* Debug info removida */}
                                    
                                    {filteredProducts.map(product => {
                                        const availableStock = getAvailableStock(product, selectedBranch || Object.keys(product.stock || {})[0]);
                                        const physicalStock = product.stock[selectedBranch || Object.keys(product.stock || {})[0]] || 0;
                                        const reservedStock = product.reservedStock?.[selectedBranch || Object.keys(product.stock || {})[0]] || 0;
                                        const isOutOfStock = availableStock === 0;
                                        
                                        return (
                                        <Card key={product.id} className={`cursor-pointer hover:shadow-lg transition-shadow ${
                                            isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                                        }`} onClick={() => !isOutOfStock && addToCart(product)}>
                                            {product.imageUrl ? (
                                                <Image src={product.imageUrl} alt={product.name} width={200} height={150} data-ai-hint={product.hint} className="w-full h-24 object-cover rounded-t-lg" />
                                            ) : (
                                                <div className="w-full h-24 bg-muted/40 rounded-t-lg flex items-center justify-center">No Image</div>
                                            )}
                                            <div className="p-2">
                                                <h3 className="text-sm font-semibold truncate">{product.name}</h3>
                                                <p className="text-sm font-bold text-primary">S/{product.price.toFixed(2)}</p>
                                                {(() => {
                                                    const isLowStock = availableStock <= 5 && availableStock > 0;
                                                    const isOutOfStock = availableStock === 0;
                                                    
                                                    return (
                                                        <div className="space-y-1">
                                                            <div className="text-xs space-y-0.5">
                                                                <p className="text-muted-foreground">
                                                                    📦 Stock total: {physicalStock}
                                                                </p>
                                                                <p className={`${
                                                                    isOutOfStock ? 'text-red-600 font-semibold' : 
                                                                    isLowStock ? 'text-yellow-600 font-medium' : 
                                                                    'text-green-600 font-medium'
                                                                }`}>
                                                                    {isOutOfStock ? '🚫' : isLowStock ? '⚠️' : '✅'} Disponible: {availableStock}
                                                                    {isOutOfStock && ' (Agotado)'}
                                                                    {isLowStock && ' (Stock bajo)'}
                                                                </p>
                                                                {reservedStock > 0 && (
                                                                    <p className="text-blue-600">
                                                                        🔒 Reservado: {reservedStock}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </Card>
                                        );
                                    })}
                                    {filteredProducts.length === 0 && (
                                        <div className="col-span-full text-center text-muted-foreground py-8">
                                            {searchQuery ? 
                                                `No se encontraron productos que coincidan con "${searchQuery}"` : 
                                                'No hay productos disponibles'
                                            }
                                        </div>
                                    )}
                                    
                                    {searchQuery && filteredProducts.length > 0 && (
                                        <div className="col-span-full text-center text-sm text-muted-foreground py-2 border-b">
                                            Mostrando {filteredProducts.length} de {products.length} productos
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                            <Card className="sticky top-8">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                Venta Actual
                                                {cart.length > 0 && (
                                                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                                                        {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                                                    </span>
                                                )}
                                            </CardTitle>
                                            {activeSession && (
                                                <p className="text-xs text-green-600 font-medium">
                                                    ✓ Caja abierta - Sesión #{activeSession.id?.slice(-6)}
                                                </p>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => clearCart()} aria-label="Limpiar Carrito">
                                            <Trash2 className="h-5 w-5 text-destructive" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <CustomerSelector 
                                        selectedCustomer={selectedCustomer}
                                        onCustomerSelect={setSelectedCustomer}
                                    />
                                    
                                    <Separator />
                                    
                                    {cart.length === 0 ? <p className="text-muted-foreground text-center py-8">El carrito está vacío</p> : (
                                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {item.imageUrl ? (
                                                            <Image src={item.imageUrl} alt={item.name} width={40} height={40} data-ai-hint={item.hint} className="rounded-md" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-muted/40 rounded-md" />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                S/{item.price.toFixed(2)} x {item.quantity}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQuantity(item.id, Math.max(1, item.quantity - 1))}>-</Button>
                                                            <Input 
                                                                type="number" 
                                                                min="1" 
                                                                value={item.quantity} 
                                                                onChange={(e) => {
                                                                    const newQuantity = parseInt(e.target.value) || 1;
                                                                    changeQuantity(item.id, newQuantity);
                                                                }}
                                                                className="w-16 h-7 text-center px-1"
                                                            />
                                                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</Button>
                                                        </div>

                                                        <p className="font-semibold">S/{(item.price * item.quantity).toFixed(2)}</p>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.id)} aria-label={`Eliminar ${item.name}`}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <Separator />
                                    
                                    {/* Resumen de items */}
                                    {cart.length > 0 && (
                                        <div className="text-xs text-muted-foreground text-center py-1 space-y-1">
                                            <div>
                                                {cart.reduce((acc, item) => acc + item.quantity, 0)} unidades • {cart.length} productos diferentes
                                            </div>
                                            {cart.some(item => item.modifiedPrice) && (
                                                <div className="text-blue-600 font-medium">
                                                    💰 {cart.filter(item => item.modifiedPrice).length} producto{cart.filter(item => item.modifiedPrice).length > 1 ? 's' : ''} con precio modificado
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Promociones y Regalos */}
                                    <div className="py-2">
                                        <PromotionManager
                                            cart={cart}
                                            products={products}
                                            onAddToCart={handleAddToCartAsGift}
                                            onApplyPromotion={handleApplyPromotion}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {(() => {
                                            const totalSavings = cart.reduce((acc, item) => {
                                                if (item.modifiedPrice && item.originalPrice) {
                                                    return acc + ((item.originalPrice - item.price) * item.quantity);
                                                }
                                                return acc;
                                            }, 0);
                                            
                                            return totalSavings > 0 ? (
                                                <div className="flex justify-between text-green-600 font-medium">
                                                    <span>💰 Ahorro por regateo</span>
                                                    <span>-S/{totalSavings.toFixed(2)}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>S/{subtotal.toFixed(2)}</span></div>
                                        {canApplyDiscount() && (
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="discount" className='text-muted-foreground'>Descuento</Label>
                                                        <div className="flex w-full max-w-36 items-center space-x-2">
                                                            <Input 
                                                                type="number" 
                                                                id="discount" 
                                                                placeholder="0.00" 
                                                                value={discountInput} 
                                                                onChange={(e) => setDiscountInput(e.target.value)} 
                                                                className="h-8 text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" 
                                                            />
                                                            <Button size="sm" variant="outline" onClick={applyDiscount} className='h-8' disabled={isApplyingDiscount}>
                                                                {isApplyingDiscount ? 'Aplicando...' : 'Aplicar'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {(isCashier() || getUserRole() === 'manager') && (
                                                        <div className="text-xs text-muted-foreground text-right">
                                                            {(() => {
                                                                const userRole = getUserRole();
                                                                const maxDiscount = DiscountSettingsService.calculateMaxDiscount(
                                                                    discountSettings, 
                                                                    userRole, 
                                                                    subtotal
                                                                );
                                                                const settings = userRole === 'cashier' ? {
                                                                    type: discountSettings.cashierMaxDiscountType,
                                                                    limit: discountSettings.cashierMaxDiscount
                                                                } : {
                                                                    type: discountSettings.managerMaxDiscountType,
                                                                    limit: discountSettings.managerMaxDiscount
                                                                };
                                                                
                                                                const limitText = settings.type === 'amount' 
                                                                    ? `S/${settings.limit}` 
                                                                    : `${settings.limit}%`;
                                                                
                                                                return `Límite ${userRole}: ${limitText} (máx S/${maxDiscount.toFixed(2)})`;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 justify-end">
                                                    {isCashier() ? (
                                                        // Botones para cajeros - descuentos más pequeños
                                                        <>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(0.5)}
                                                            >
                                                                💰 S/0.50
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(1)}
                                                            >
                                                                💰 S/1
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(2)}
                                                            >
                                                                💰 S/2
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(5)}
                                                            >
                                                                💰 S/5
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        // Botones para otros roles - descuentos más grandes
                                                        <>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(1)}
                                                            >
                                                                💰 S/1
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(5)}
                                                            >
                                                                💰 S/5
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(10)}
                                                            >
                                                                💰 S/10
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                                                                onClick={() => applyDiscountWithValue(20)}
                                                            >
                                                                💰 S/20
                                                            </Button>
                                                        </>
                                                    )}
                                                    {discount > 0 && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
                                                            onClick={() => {
                                                                setDiscount(0);
                                                                setDiscountInput("");
                                                                toast({
                                                                    title: "Descuento eliminado",
                                                                    description: "Se ha quitado el descuento de la venta"
                                                                });
                                                            }}
                                                        >
                                                            ✕ Quitar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {discount > 0 && (
                                            <div className="flex justify-between"><span className="text-muted-foreground">Descuento aplicado</span><span className="text-destructive">-S/{discount.toFixed(2)}</span></div>
                                        )}
                                        
                                        {/* Indicador de Reserva */}
                                        {reservationToComplete && (
                                            <div className="border-t border-b py-3 my-2 bg-blue-50 rounded-md p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-blue-600" />
                                                        <span className="font-medium text-blue-800">Completando Reserva #{reservationToComplete.reservationNumber}</span>
                                                    </div>
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    {(() => {
                                                        const originalSubtotal = reservationToComplete.items.reduce((sum, item) => 
                                                            sum + (item.price * item.quantity), 0
                                                        );
                                                        const originalTotal = originalSubtotal - reservationToComplete.discount;
                                                        const depositAmount = reservationToComplete.depositAmount || 0;
                                                        const remainingAmount = originalTotal - depositAmount;
                                                        
                                                        return (
                                                            <>
                                                                <div className="flex justify-between text-muted-foreground">
                                                                    <span>Total original de la reserva:</span>
                                                                    <span>S/{originalTotal.toFixed(2)}</span>
                                                                </div>
                                                                {depositAmount > 0 && (
                                                                    <div className="flex justify-between text-green-600">
                                                                        <span>💰 Adelanto ya pagado:</span>
                                                                        <span>S/{depositAmount.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between font-medium text-orange-600 border-t pt-1">
                                                                    <span>Restante por cobrar:</span>
                                                                    <span>S/{remainingAmount.toFixed(2)}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>S/{total.toFixed(2)}</span></div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <div className="space-y-2">
                                            <Label>Método de Pago</Label>
                                            <RadioGroup defaultValue="Efectivo" className="grid grid-cols-2 gap-2" onValueChange={setPaymentMethod} value={paymentMethod}>
                                                <Label className={`flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer transition-colors ${paymentMethod === 'Efectivo' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                                                    <RadioGroupItem value="Efectivo" id="cash" className="sr-only"/>
                                                    <Coins className="h-4 w-4"/> Efectivo
                                                </Label>
                                                <Label className={`flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer transition-colors ${paymentMethod === 'Tarjeta' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                                                    <RadioGroupItem value="Tarjeta" id="card" className="sr-only"/>
                                                    <CreditCard className="h-4 w-4"/> Tarjeta
                                                </Label>
                                                <Label className={`flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer transition-colors ${paymentMethod === 'Digital' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                                                    <RadioGroupItem value="Digital" id="digital" className="sr-only"/>
                                                    <Wallet className="h-4 w-4"/> Digital
                                                </Label>
                                                <Label className={`flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer transition-colors ${paymentMethod === 'Mixto' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                                                    <RadioGroupItem value="Mixto" id="mixed" className="sr-only"/>
                                                    <CreditCard className="h-4 w-4"/> Mixto
                                                </Label>
                                            </RadioGroup>
                                            
                                            {paymentMethod === 'Mixto' && (
                                                <div className="mt-4 p-3 border rounded-lg bg-muted/50">
                                                    <Label className="text-sm font-medium">Distribución del pago (Total: S/{total.toFixed(2)})</Label>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <div>
                                                            <Label htmlFor="cashAmount" className="text-xs">Efectivo</Label>
                                                            <Input 
                                                                id="cashAmount"
                                                                type="number" 
                                                                step="0.01" 
                                                                min="0" 
                                                                max={total}
                                                                placeholder="0.00" 
                                                                className="h-8 text-sm"
                                                                value={cashAmount || ''}
                                                                onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="cardAmount" className="text-xs">Tarjeta/Digital</Label>
                                                            <Input 
                                                                id="cardAmount"
                                                                type="number" 
                                                                step="0.01" 
                                                                min="0" 
                                                                max={total}
                                                                placeholder="0.00" 
                                                                className="h-8 text-sm"
                                                                value={cardAmount || ''}
                                                                onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-2">
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="flex-1 h-7 text-xs"
                                                                onClick={() => {
                                                                    setCashAmount(total);
                                                                    setCardAmount(0);
                                                                }}
                                                            >
                                                                Todo Efectivo
                                                            </Button>
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="flex-1 h-7 text-xs"
                                                                onClick={() => {
                                                                    setCashAmount(0);
                                                                    setCardAmount(total);
                                                                }}
                                                            >
                                                                Todo Tarjeta
                                                            </Button>
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="flex-1 h-7 text-xs"
                                                                onClick={() => {
                                                                    const half = total / 2;
                                                                    setCashAmount(half);
                                                                    setCardAmount(half);
                                                                }}
                                                            >
                                                                50/50
                                                            </Button>
                                                        </div>
                                                        <div className="p-2 bg-background rounded border">
                                                            <div className="flex justify-between text-xs">
                                                                <span>Total a pagar:</span>
                                                                <span className="font-medium">S/{total.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span>Total ingresado:</span>
                                                                <span className="font-medium">S/{(cashAmount + cardAmount).toFixed(2)}</span>
                                                            </div>
                                                            <div className={`flex justify-between text-xs font-bold ${
                                                                Math.abs(total - (cashAmount + cardAmount)) < 0.01 ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                                <span>Diferencia:</span>
                                                                <span>S/{(total - (cashAmount + cardAmount)).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2 p-4">
                                    {/* Botón para crear reserva */}
                                    <Button 
                                        className="w-full text-sm" 
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCreateReservation}
                                        disabled={cart.length === 0}
                                    >
                                        <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">Crear Reserva de Pedido</span>
                                    </Button>
                                    
                                    {/* Botón principal de pago */}
                                    <Button 
                                        className="w-full text-sm min-h-[44px]" 
                                        size="lg" 
                                        onClick={processPayment} 
                                        style={{ 
                                            backgroundColor: reservationToComplete ? 'hsl(var(--primary))' : 'hsl(var(--accent))', 
                                            color: reservationToComplete ? 'hsl(var(--primary-foreground))' : 'hsl(var(--accent-foreground))' 
                                        }} 
                                        disabled={cart.length === 0 || isProcessingPayment || !activeSession}
                                    >
                                        <div className="flex items-center justify-center w-full">
                                            {reservationToComplete ? (
                                                <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                                            ) : (
                                                <CreditCard className="mr-2 h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="truncate">
                                                {isProcessingPayment ? 
                                                    'Procesando...' : 
                                                    reservationToComplete ? 
                                                        `Completar Reserva #${reservationToComplete.reservationNumber}` :
                                                        `Procesar Pago - S/${total.toFixed(2)}`
                                                }
                                            </span>
                                        </div>
                                        {reservationToComplete && (
                                            <div className="text-xs opacity-75 mt-1">
                                                S/${total.toFixed(2)}
                                            </div>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="reservations">
                    <ReservationsManager 
                        branchId={selectedBranch || undefined}
                        onCompleteReservation={handleCompleteReservation}
                    />
                </TabsContent>
                <TabsContent value="transactions">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Historial de Transacciones
                                </CardTitle>
                                <CardDescription>
                                    Gestiona todas las ventas realizadas: busca, filtra, ve detalles y procesa devoluciones.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Barra de búsqueda y filtros */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Buscar transacciones..."
                                            className="pl-8"
                                            value={transactionSearch}
                                            onChange={(e) => setTransactionSearch(e.target.value)}
                                        />
                                    </div>
                                    
                                    <Select
                                        value={transactionFilters.branchId}
                                        onValueChange={(value) => setTransactionFilters(prev => ({...prev, branchId: value}))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todas las sucursales" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las sucursales</SelectItem>
                                            {branches.map(branch => (
                                                <SelectItem key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    
                                    <Select
                                        value={transactionFilters.paymentMethod}
                                        onValueChange={(value) => setTransactionFilters(prev => ({...prev, paymentMethod: value}))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todos los métodos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los métodos</SelectItem>
                                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                                            <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                            <SelectItem value="Digital">Digital</SelectItem>
                                            <SelectItem value="Mixto">Mixto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        >
                                            <ArrowUpDown className="h-4 w-4 mr-1" />
                                            {sortOrder === 'asc' ? 'Más antiguas' : 'Más recientes'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Filtros de fecha */}
                                <div className="flex flex-wrap gap-4">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "justify-start text-left font-normal",
                                                    !transactionFilters.dateFrom && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {transactionFilters.dateFrom ? format(transactionFilters.dateFrom, "PPP", { locale: es }) : "Desde fecha"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarComponent
                                                mode="single"
                                                selected={transactionFilters.dateFrom || undefined}
                                                onSelect={(date) => setTransactionFilters(prev => ({...prev, dateFrom: date || null}))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "justify-start text-left font-normal",
                                                    !transactionFilters.dateTo && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {transactionFilters.dateTo ? format(transactionFilters.dateTo, "PPP", { locale: es }) : "Hasta fecha"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarComponent
                                                mode="single"
                                                selected={transactionFilters.dateTo || undefined}
                                                onSelect={(date) => setTransactionFilters(prev => ({...prev, dateTo: date || null}))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    {(transactionFilters.dateFrom || transactionFilters.dateTo || transactionFilters.branchId !== 'all' || transactionFilters.paymentMethod !== 'all') && (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setTransactionFilters({
                                                    branchId: 'all',
                                                    paymentMethod: 'all',
                                                    dateFrom: null,
                                                    dateTo: null,
                                                    status: 'all'
                                                });
                                                setTransactionSearch('');
                                            }}
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Limpiar filtros
                                        </Button>
                                    )}
                                </div>

                                {/* Estadísticas */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {filteredTransactions.length}
                                        </div>
                                        <div className="text-sm text-blue-600">
                                            Transacciones encontradas
                                        </div>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <div className="text-2xl font-bold text-green-600">
                                            S/{filteredTransactions.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}
                                        </div>
                                        <div className="text-sm text-green-600">
                                            Total en ventas
                                        </div>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-lg">
                                        <div className="text-2xl font-bold text-orange-600">
                                            {filteredTransactions.reduce((sum, sale) => sum + sale.items.length, 0)}
                                        </div>
                                        <div className="text-sm text-orange-600">
                                            Productos vendidos
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lista de transacciones mejorada */}
                        <div className="space-y-4">
                            {paginatedTransactions.length === 0 ? (
                                <Card>
                                    <CardContent className="text-center py-8 text-muted-foreground">
                                        {transactionSearch || transactionFilters.branchId !== 'all' || transactionFilters.paymentMethod !== 'all' || transactionFilters.dateFrom || transactionFilters.dateTo ? 
                                            'No se encontraron transacciones con los filtros aplicados' : 
                                            'No hay transacciones registradas'
                                        }
                                    </CardContent>
                                </Card>
                            ) : (
                                paginatedTransactions.map((sale) => (
                                    <Card key={sale.id} className="transition-all hover:shadow-lg">
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg">
                                                            Venta #{sale.saleNumber || sale.id.slice(-6)}
                                                        </h3>
                                                        <Badge variant={
                                                            sale.paymentMethod === 'Efectivo' ? 'default' :
                                                            sale.paymentMethod === 'Tarjeta' ? 'secondary' :
                                                            sale.paymentMethod === 'Digital' ? 'outline' : 'destructive'
                                                        }>
                                                            {sale.paymentMethod}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-4 w-4" />
                                                            {format(new Date(sale.date), "PPP p", { locale: es })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-4 w-4" />
                                                            {sale.customerName || 'Cliente sin registrar'}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Sucursal: {branches.find(b => b.id === sale.branchId)?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-green-600">
                                                        S/{sale.total.toFixed(2)}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vista previa de productos */}
                                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Productos vendidos
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {sale.items.reduce((sum, item) => sum + item.quantity, 0)} unidades
                                                    </span>
                                                </div>
                                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                                    {sale.items.slice(0, 3).map((item, index) => (
                                                        <div key={index} className="flex items-center justify-between text-sm">
                                                            <span className="truncate flex-1">
                                                                {item.quantity}x {item.name}
                                                            </span>
                                                            <span className="text-muted-foreground ml-2">
                                                                S/{(item.price * item.quantity).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {sale.items.length > 3 && (
                                                        <div className="text-xs text-center text-muted-foreground py-1">
                                                            +{sale.items.length - 3} productos más...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Acciones */}
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(sale)}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Ver detalles
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReprintReceipt(sale)}
                                                >
                                                    <Receipt className="h-4 w-4 mr-1" />
                                                    Reimprimir
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCopyToNewSale(sale)}
                                                >
                                                    <Copy className="h-4 w-4 mr-1" />
                                                    Copiar al carrito
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleReturnClick(sale)}
                                                >
                                                    <CornerDownLeft className="h-4 w-4 mr-1" />
                                                    Devolución
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-muted-foreground">
                                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length} transacciones
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            >
                                                Anterior
                                            </Button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    const page = i + 1;
                                                    return (
                                                        <Button
                                                            key={page}
                                                            variant={currentPage === page ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setCurrentPage(page)}
                                                        >
                                                            {page}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
      
            <ReceiptModal isOpen={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen} saleDetails={completedSale} />
            <ReturnModal isOpen={isReturnModalOpen} onOpenChange={setIsReturnModalOpen} sale={saleToReturn} />
            <ReservationModal 
                isOpen={isReservationModalOpen} 
                onOpenChange={setIsReservationModalOpen}
                saleData={cart.length > 0 ? {
                    cart,
                    total,
                    subtotal,
                    tax: finalTax,
                    discount,
                    selectedBranch: selectedBranch!
                } : null}
                onReservationCreated={handleReservationCreated}
            />

            {/* Modal de Comprobante de Reserva */}
            <ReservationReceiptModal 
                isOpen={isReservationReceiptModalOpen} 
                onOpenChange={setIsReservationReceiptModalOpen}
                reservationDetails={completedReservation}
            />

            {/* Modal de detalles de transacción */}
            {selectedTransaction && (
                <Dialog open={isTransactionDetailOpen} onOpenChange={setIsTransactionDetailOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5" />
                                Detalles de Venta #{selectedTransaction.saleNumber || selectedTransaction.id.slice(-6)}
                            </DialogTitle>
                            <DialogDescription>
                                Información completa de la transacción
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            {/* Información general */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-semibold mb-2">Información de venta</h3>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Fecha:</span>{' '}
                                            {format(new Date(selectedTransaction.date), "PPP p", { locale: es })}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Método de pago:</span>{' '}
                                            <Badge variant="outline">{selectedTransaction.paymentMethod}</Badge>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Sucursal:</span>{' '}
                                            {branches.find(b => b.id === selectedTransaction.branchId)?.name || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">Cliente</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="font-medium">
                                            {selectedTransaction.customerName || 'Cliente sin registrar'}
                                        </div>
                                        {(selectedTransaction as any).customerPhone && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Teléfono:</span>
                                                {(selectedTransaction as any).customerPhone}
                                            </div>
                                        )}
                                        {(selectedTransaction as any).customerEmail && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Email:</span>
                                                {(selectedTransaction as any).customerEmail}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Productos */}
                            <div>
                                <h3 className="font-semibold mb-3">Productos vendidos</h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {selectedTransaction.items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                                            <div className="flex-1">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    SKU: {item.sku || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold">
                                                    {item.quantity}x S/{item.price.toFixed(2)}
                                                </div>
                                                <div className="text-sm font-bold">
                                                    S/{(item.quantity * item.price).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totales */}
                            <div className="border-t pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span>S/{selectedTransaction.subtotal.toFixed(2)}</span>
                                    </div>
                                    {selectedTransaction.discount > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>Descuento:</span>
                                            <span>-S/{selectedTransaction.discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span>IGV (18%):</span>
                                        <span>S/{selectedTransaction.tax.toFixed(2)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total:</span>
                                        <span>S/{selectedTransaction.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsTransactionDetailOpen(false)}>
                                Cerrar
                            </Button>
                            <Button
                                onClick={() => {
                                    handleReprintReceipt(selectedTransaction);
                                    setIsTransactionDetailOpen(false);
                                }}
                            >
                                <Receipt className="h-4 w-4 mr-2" />
                                Reimprimir recibo
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}

// Subscriptions to products/sales/branches are initialized inside the component above.

    