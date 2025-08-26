
"use client"

import { useState, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Trash2, X, Search, CreditCard, Wallet, Coins, CornerDownLeft, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from '@/types/product';
import type { Sale } from '@/types/sale';
import { Input } from '@/components/ui/input';
import { ReceiptModal } from '@/components/receipt-modal';
import { ReturnModal } from '@/components/return-modal';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { mockProducts } from '@/lib/mock-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = Product & { quantity: number };

// Mock de ventas completadas
const mockSales: Sale[] = [
    {
        id: 'SALE-6A3B1C',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).getTime(),
        items: [{ ...mockProducts[0], quantity: 1 }, { ...mockProducts[1], quantity: 1 }],
        total: 123.88,
        paymentMethod: 'Tarjeta',
        branchId: 'branch-1'
    },
    {
        id: 'SALE-D9E8F7',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).getTime(),
        items: [{ ...mockProducts[2], quantity: 2 }],
        total: 29.50,
        paymentMethod: 'Efectivo',
        branchId: 'branch-2'
    }
];


export default function SalesPage() {
    const [products, setProducts] = useState<Product[]>(mockProducts);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");
    const [activeSession, setActiveSession] = useState(true);
    const [salesHistory, setSalesHistory] = useState<Sale[]>(mockSales);
    const [transactionSearch, setTransactionSearch] = useState('');

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        return products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [products, searchQuery]);

    const filteredTransactions = useMemo(() => {
        if(!transactionSearch) return salesHistory;
        return salesHistory.filter(s => s.id.toLowerCase().includes(transactionSearch.toLowerCase()));
    }, [salesHistory, transactionSearch])

    const addToCart = (product: Product) => {
        const totalStock = Object.values(product.stock).reduce((a, b) => a + b, 0);
        if (totalStock <= 0) {
            toast({ title: "Producto Agotado", description: `No queda stock de ${product.name}.`, variant: "destructive" });
            return;
        }

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < totalStock) {
                    return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                } else {
                    toast({ title: "Stock insuficiente", description: `No puedes agregar más ${product.name} que el stock disponible.`, variant: "destructive" });
                    return prevCart;
                }
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => setCart(cart.filter(item => item.id !== productId));
    const clearCart = () => { setCart([]); setDiscount(0); setDiscountInput(""); }

    const applyDiscount = () => {
        const value = parseFloat(discountInput);
        if (!isNaN(value) && value >= 0 && value <= subtotal) {
            setDiscount(value);
            toast({ title: "Descuento Aplicado", description: `Se aplicó un descuento de S/${value.toFixed(2)}.` });
        } else {
            toast({ title: "Valor inválido", description: `Ingresa un descuento válido.`, variant: "destructive" });
        }
    }

    const processPayment = async () => {
        if (cart.length === 0) {
            toast({ title: "Carrito Vacío", description: "No se puede procesar el pago de un carrito vacío.", variant: "destructive" });
            return;
        }
        if (!activeSession) {
            toast({ title: "Caja Cerrada", description: "Necesitas abrir una caja para procesar ventas.", variant: "destructive" });
            return;
        }

        const newSale: Sale = {
            id: `SALE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            date: new Date().getTime(),
            items: cart,
            total,
            subtotal,
            tax,
            discount,
            paymentMethod,
            branchId: 'branch-1', // Simular venta en sucursal 1
        };

        setSalesHistory(prev => [newSale, ...prev]);
        setCompletedSale(newSale);
        setIsReceiptModalOpen(true);
        clearCart();
    }
    
    const handleReturnClick = (sale: Sale) => {
        setSaleToReturn(sale);
        setIsReturnModalOpen(true);
    }
    
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const discountedSubtotal = subtotal - discount;
    const tax = discountedSubtotal > 0 ? discountedSubtotal * 0.18 : 0;
    const total = discountedSubtotal + tax;

    if (!activeSession) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto mt-10">
                <AlertTitle className="text-xl">Caja Cerrada</AlertTitle>
                <AlertDescription>
                    No hay una sesión de caja activa. Para registrar nuevas ventas, primero debes abrir la caja.
                    <Button asChild className="mt-4"><Link href="/cash-management">Ir a Gestión de Caja</Link></Button>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <>
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
                                    <CardTitle>Seleccionar Productos</CardTitle>
                                    <div className="relative mt-2">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input type="search" placeholder="Buscar por nombre o SKU..." className="w-full pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[calc(100vh-25rem)] overflow-y-auto">
                                    {filteredProducts.map(product => (
                                        <Card key={product.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => addToCart(product)}>
                                            <Image src={product.imageUrl} alt={product.name} width={200} height={150} data-ai-hint={product.hint} className="w-full h-24 object-cover rounded-t-lg" />
                                            <div className="p-2">
                                                <h3 className="text-sm font-semibold truncate">{product.name}</h3>
                                                <p className="text-sm font-bold text-primary">S/{product.price.toFixed(2)}</p>
                                            </div>
                                        </Card>
                                    ))}
                                    {filteredProducts.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">No se encontraron productos.</div>}
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                            <Card className="sticky top-8">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>Venta Actual</CardTitle>
                                        <Button variant="ghost" size="icon" onClick={clearCart} aria-label="Limpiar Carrito"><Trash2 className="h-5 w-5 text-destructive" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {cart.length === 0 ? <p className="text-muted-foreground text-center py-8">El carrito está vacío</p> : (
                                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Image src={item.imageUrl} alt={item.name} width={40} height={40} data-ai-hint={item.hint} className="rounded-md" />
                                                        <div>
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-sm text-muted-foreground">S/{item.price.toFixed(2)} x {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">S/{(item.price * item.quantity).toFixed(2)}</p>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.id)} aria-label={`Eliminar ${item.name}`}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <Separator />
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>S/{subtotal.toFixed(2)}</span></div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="discount" className='text-muted-foreground'>Descuento</Label>
                                            <div className="flex w-full max-w-36 items-center space-x-2">
                                                <Input type="number" id="discount" placeholder="0.00" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="h-8 text-right" />
                                                <Button size="sm" variant="outline" onClick={applyDiscount} className='h-8'>Aplicar</Button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Descuento aplicado</span><span className="text-destructive">-S/{discount.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">IGV (18%)</span><span>S/{tax.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>S/{total.toFixed(2)}</span></div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <Label className="mb-2 block">Método de Pago</Label>
                                        <RadioGroup defaultValue="Efectivo" className="grid grid-cols-3 gap-2" onValueChange={setPaymentMethod} value={paymentMethod}>
                                            <Label className="flex items-center justify-center gap-2 rounded-md p-2 border has-[:checked]:bg-primary has-[:checked]:text-primary-foreground cursor-pointer"><RadioGroupItem value="Efectivo" id="cash"/><Coins className="h-4 w-4"/> Efectivo</Label>
                                            <Label className="flex items-center justify-center gap-2 rounded-md p-2 border has-[:checked]:bg-primary has-[:checked]:text-primary-foreground cursor-pointer"><RadioGroupItem value="Tarjeta" id="card"/><CreditCard className="h-4 w-4"/> Tarjeta</Label>
                                            <Label className="flex items-center justify-center gap-2 rounded-md p-2 border has-[:checked]:bg-primary has-[:checked]:text-primary-foreground cursor-pointer"><RadioGroupItem value="Digital" id="digital"/><Wallet className="h-4 w-4"/> Digital</Label>
                                        </RadioGroup>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" size="lg" onClick={processPayment} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} disabled={cart.length === 0}>Procesar Pago</Button>
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
                             <div className="relative mt-2 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Buscar por Nro. de Recibo..." className="w-full pl-8" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nro. Recibo</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Sucursal</TableHead>
                                        <TableHead>Método de Pago</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="font-mono">{sale.id}</TableCell>
                                            <TableCell>{format(new Date(sale.date), "PPP p", { locale: es })}</TableCell>
                                            <TableCell>{sale.branchId === 'branch-1' ? 'Tienda Centro' : 'Almacén Principal'}</TableCell>
                                            <TableCell>{sale.paymentMethod}</TableCell>
                                            <TableCell className="text-right font-medium">S/{sale.total.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => handleReturnClick(sale)}>
                                                    <CornerDownLeft className="mr-2 h-4 w-4" /> Devolución
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
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

    