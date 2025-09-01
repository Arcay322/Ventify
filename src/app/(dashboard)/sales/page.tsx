
"use client"

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Trash2, X, Search, CreditCard, Wallet, Coins, CornerDownLeft, History, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from '@/types/product';
import type { Sale } from '@/types/sale';
import { Input } from '@/components/ui/input';
import { ReceiptModal } from '@/components/receipt-modal';
import { ReturnModal } from '@/components/return-modal';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { getActiveCashRegisterSession, createCashRegisterSession, addSaleToActiveSession } from '@/services/cash-register-service';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = Product & { 
    quantity: number;
    originalPrice?: number;
    modifiedPrice?: number;
    priceModifiedBy?: string;
};



export default function SalesPage() {
    const authState = useAuth();
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
    }, [cart, activeSession, total, subtotalWithoutTax, finalTax, discount, paymentMethod, selectedBranch, authState.userDoc?.branchId, authState.userDoc?.accountId, selectedCustomer, cashAmount, cardAmount, toast, clearCart]);

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
        if(!transactionSearch) return salesHistory;
        const searchTerm = transactionSearch.toLowerCase();
        return salesHistory.filter(s => {
            // Buscar por ID de venta
            if (s.id.toLowerCase().includes(searchTerm)) return true;
            
            // Buscar por número de venta
            if (s.saleNumber && s.saleNumber.toString().includes(searchTerm)) return true;
            
            // Buscar por nombre de cliente
            if (s.customerName && s.customerName.toLowerCase().includes(searchTerm)) return true;
            
            // Buscar por email de cliente
            if ((s as any).customerEmail && (s as any).customerEmail.toLowerCase().includes(searchTerm)) return true;
            
            // Buscar por teléfono de cliente
            if ((s as any).customerPhone && (s as any).customerPhone.toLowerCase().includes(searchTerm)) return true;
            
            // Buscar por método de pago
            if (s.paymentMethod && s.paymentMethod.toLowerCase().includes(searchTerm)) return true;
            
            // Buscar por total (convertir a string para búsqueda parcial)
            if (s.total && s.total.toString().includes(searchTerm)) return true;
            
            return false;
        });
    }, [salesHistory, transactionSearch])

    const addToCart = useCallback((product: Product) => {
        const branchId = selectedBranch || Object.keys(product.stock || {})[0];
        const branchStock = typeof product.stock?.[branchId] === 'number' ? product.stock[branchId] : 0;
        if (branchStock <= 0) {
            toast({ title: "Producto Agotado", description: `No queda stock de ${product.name} en la sucursal seleccionada.`, variant: "destructive" });
            playSound('error');
            return;
        }

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < branchStock) {
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
    }, [selectedBranch, toast, playSound]);

    const changeQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity < 1) return; // No permitir cantidades menores a 1
        
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                // Validar stock disponible
                const branchId = selectedBranch || Object.keys(item.stock || {})[0];
                const branchStock = typeof item.stock?.[branchId] === 'number' ? item.stock[branchId] : 0;
                
                if (quantity > branchStock) {
                    toast({ 
                        title: "Stock insuficiente", 
                        description: `Solo hay ${branchStock} unidades disponibles de ${item.name}`, 
                        variant: "destructive" 
                    });
                    return item; // No cambiar la cantidad
                }
                
                return { ...item, quantity };
            }
            return item;
        }));
    }, [selectedBranch, toast]);


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
    }


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
            
            <Tabs defaultValue="pos">
                <TabsList className="mb-4">
                    <TabsTrigger value="pos">Punto de Venta</TabsTrigger>
                    <TabsTrigger value="transactions">Transacciones y Devoluciones</TabsTrigger>
                </TabsList>
                <TabsContent value="pos">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full items-start">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>Seleccionar Productos</span>
                                        <div className="text-xs text-muted-foreground font-normal">
                                            F1: Pagar | F2: Limpiar | F3: Buscar | ESC: Limpiar búsqueda
                                        </div>
                                    </CardTitle>
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-full">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input 
                                                        id="product-search"
                                                        type="search" 
                                                        placeholder="Buscar por nombre o SKU... (F3)" 
                                                        className="w-full pl-8" 
                                                        value={searchQuery} 
                                                        onChange={(e) => setSearchQuery(e.target.value)} 
                                                    />
                                                </div>
                                                <div className="w-48">
                                                    <label className="text-xs text-muted-foreground">Sucursal</label>
                                                    <select value={selectedBranch || ''} onChange={(e) => setSelectedBranch(e.target.value)} className="w-full border rounded p-1">
                                                        {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                                    </select>
                                                </div>
                                            </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[calc(100vh-25rem)] overflow-y-auto">
                                    {/* Debug info removida */}
                                    
                                    {filteredProducts.map(product => {
                                        const branchStock = product.stock[selectedBranch || Object.keys(product.stock || {})[0]] || 0;
                                        const isOutOfStock = branchStock === 0;
                                        
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
                                                    const branchStock = product.stock[selectedBranch || Object.keys(product.stock || {})[0]] || 0;
                                                    const isLowStock = branchStock <= 5 && branchStock > 0;
                                                    const isOutOfStock = branchStock === 0;
                                                    
                                                    return (
                                                        <p className={`text-xs ${
                                                            isOutOfStock ? 'text-red-600 font-semibold' : 
                                                            isLowStock ? 'text-yellow-600 font-medium' : 
                                                            'text-muted-foreground'
                                                        }`}>
                                                            Stock: {branchStock}
                                                            {isOutOfStock && ' (Agotado)'}
                                                            {isLowStock && ' (Stock bajo)'}
                                                        </p>
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
                                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (sin IGV)</span><span>S/{subtotalWithoutTax.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">IGV (18%)</span><span>S/{tax.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (con IGV)</span><span>S/{subtotal.toFixed(2)}</span></div>
                                        {canApplyDiscount() && (
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="discount" className='text-muted-foreground'>Descuento</Label>
                                                        <div className="flex w-full max-w-36 items-center space-x-2">
                                                            <Input type="number" id="discount" placeholder="0.00" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="h-8 text-right" />
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
                                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>S/{total.toFixed(2)}</span></div>
                                        {discount > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                (Incluye IGV: S/{finalTax.toFixed(2)})
                                            </div>
                                        )}
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
                                <CardFooter>
                                    <Button 
                                        className="w-full" 
                                        size="lg" 
                                        onClick={processPayment} 
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} 
                                        disabled={cart.length === 0 || isProcessingPayment || !activeSession}
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        {isProcessingPayment ? 
                                            'Procesando...' : 
                                            `Procesar Pago - S/${total.toFixed(2)} (${paymentMethod})`
                                        }
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="transactions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Transacciones</CardTitle>
                            <CardDescription>Busca ventas anteriores para ver detalles o procesar una devolución.</CardDescription>
                             <div className="flex items-center gap-4 mt-2">
                                <div className="relative max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input type="search" placeholder="Buscar por número de venta, cliente, total..." className="w-full pl-8 pr-8" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} />
                                    {transactionSearch && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-1 top-1 h-6 w-6 p-0"
                                            onClick={() => setTransactionSearch('')}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                                {transactionSearch && (
                                    <div className="text-sm text-muted-foreground">
                                        {filteredTransactions.length} resultado{filteredTransactions.length !== 1 ? 's' : ''} encontrado{filteredTransactions.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nro. Recibo</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Sucursal</TableHead>
                                        <TableHead>Método de Pago</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                {transactionSearch ? 
                                                    `No se encontraron transacciones que coincidan con "${transactionSearch}"` : 
                                                    'No hay transacciones registradas'
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTransactions.map((sale) => (
                                            <TableRow key={sale.id}>
                                                <TableCell className="font-mono">{sale.saleNumber || sale.id.slice(-6)}</TableCell>
                                                <TableCell>{format(new Date(sale.date), "PPP p", { locale: es })}</TableCell>
                                                <TableCell>
                                                    {sale.customerName ? (
                                                        <div>
                                                            <div className="font-medium">{sale.customerName}</div>
                                                            <div className="text-xs text-muted-foreground">{sale.customerEmail || sale.customerPhone}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Sin cliente</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{branches.find(b => b.id === sale.branchId)?.name || sale.branchId}</TableCell>
                                                <TableCell>{sale.paymentMethod}</TableCell>
                                                <TableCell className="text-right font-medium">S/{sale.total.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => handleReturnClick(sale)}>
                                                        <CornerDownLeft className="mr-2 h-4 w-4" /> Devolución
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
      
            <ReceiptModal isOpen={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen} saleDetails={completedSale} />
            <ReturnModal isOpen={isReturnModalOpen} onOpenChange={setIsReturnModalOpen} sale={saleToReturn} />
        </>
    )
}

// Subscriptions to products/sales/branches are initialized inside the component above.

    