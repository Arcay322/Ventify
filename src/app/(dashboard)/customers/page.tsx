"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Edit } from "lucide-react";
import { CustomerModal } from '@/components/customer-modal';
import type { Customer } from '@/types/customer';
import { getCustomers, saveCustomer } from '@/services/customer-service';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleOpenModal = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  }

  const handleSaveCustomer = async (customer: Customer) => {
    try {
      await saveCustomer(customer);
      setIsModalOpen(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error saving customer:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = getCustomers(setCustomers);
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} onClick={() => handleOpenModal(null)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Gestiona la información de tus clientes registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Compras Totales</TableHead>
                <TableHead>Gasto Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.totalPurchases}</TableCell>
                  <TableCell>S/{customer.totalSpent.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="outline" size="icon" onClick={() => handleOpenModal(customer)}>
                       <Edit className="h-4 w-4" />
                       <span className="sr-only">Editar Cliente</span>
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <CustomerModal 
        customer={selectedCustomer} 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen}
        onSave={handleSaveCustomer}
      />
    </div>
  )
}
