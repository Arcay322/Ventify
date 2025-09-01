"use client"

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, User, Plus, X } from "lucide-react";
import { Customer } from '@/types/customer';
import { getCustomers, saveCustomer } from '@/services/customer-service';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
}

export function CustomerSelector({ selectedCustomer, onCustomerSelect }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    dni: '',
    email: '',
    phone: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  
  const authState = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    if (!accountId) return;
    
    const unsubscribe = getCustomers((customerList) => {
      setCustomers(customerList);
    }, accountId);
    
    return () => {
      try { unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, [authState.userDoc?.accountId]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.dni && customer.dni.includes(searchQuery)) ||
    (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchQuery))
  );

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast({ title: 'Error', description: 'El nombre del cliente es requerido', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const accountId = authState.userDoc?.accountId as string;
      const customerData = {
        ...newCustomer,
        accountId,
        totalPurchases: 0,
        totalSpent: 0
      };
      
      const customerId = await saveCustomer(customerData);
      const createdCustomer: Customer = {
        id: customerId,
        ...customerData
      };
      
      onCustomerSelect(createdCustomer);
      setIsCreateModalOpen(false);
      setNewCustomer({ name: '', dni: '', email: '', phone: '' });
      setIsPopoverOpen(false);
      
      toast({ title: 'Cliente creado', description: `${newCustomer.name} ha sido agregado` });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({ title: 'Error', description: 'No se pudo crear el cliente', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    onCustomerSelect(customer);
    setIsPopoverOpen(false);
    setSearchQuery('');
  };

  const handleRemoveCustomer = () => {
    onCustomerSelect(null);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Cliente (Opcional)</Label>
        </div>
        
        {selectedCustomer ? (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">{selectedCustomer.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedCustomer.dni && `DNI: ${selectedCustomer.dni}`}
                  {selectedCustomer.dni && (selectedCustomer.email || selectedCustomer.phone) && ' • '}
                  {selectedCustomer.phone || selectedCustomer.email || (!selectedCustomer.dni && 'Sin contacto')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedCustomer.totalPurchases} compras • S/{selectedCustomer.totalSpent.toFixed(2)} total
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemoveCustomer}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start h-11">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Cliente
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <div className="p-4 border-b">
                  <h3 className="font-semibold mb-3">Buscar Cliente</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, DNI, teléfono o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    <>
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                        {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''} encontrado{filteredCustomers.length !== 1 ? 's' : ''}
                      </div>
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {customer.dni && <div>🆔 DNI: {customer.dni}</div>}
                                {customer.phone && <div>📱 {customer.phone}</div>}
                                {customer.email && <div>📧 {customer.email}</div>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {customer.totalPurchases} compras • S/{customer.totalSpent.toFixed(2)} gastado
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <User className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <div className="text-muted-foreground font-medium">
                        {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                      </div>
                      <div className="text-sm text-muted-foreground/70 mt-1">
                        {searchQuery ? 'Intenta con otro término de búsqueda' : 'Crea tu primer cliente'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t">
                  <Button
                    className="w-full"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Nuevo Cliente
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full mt-2 text-xs"
                    onClick={() => setIsPopoverOpen(false)}
                  >
                    Continuar sin cliente
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Modal para crear cliente */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="customerName">Nombre Completo *</Label>
              <Input
                id="customerName"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Juan Pérez García"
              />
            </div>
            <div>
              <Label htmlFor="customerDni">DNI</Label>
              <Input
                id="customerDni"
                value={newCustomer.dni}
                onChange={(e) => {
                  // Solo permitir números y máximo 8 dígitos
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setNewCustomer(prev => ({ ...prev, dni: value }));
                }}
                placeholder="12345678"
                maxLength={8}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Opcional - Para boletas electrónicas
              </div>
            </div>
            <div>
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input
                id="customerPhone"
                value={newCustomer.phone}
                onChange={(e) => {
                  // Permitir números, espacios y guiones
                  const value = e.target.value.replace(/[^\d\s-]/g, '');
                  setNewCustomer(prev => ({ ...prev, phone: value }));
                }}
                placeholder="999 999 999"
              />
            </div>
            <div>
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="cliente@email.com (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCustomer} disabled={isCreating}>
              {isCreating ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}