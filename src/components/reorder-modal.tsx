"use client"

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { analyzeReorderingRequirements, AnalyzeReorderingRequirementsOutput } from '@/ai/flows/inventory-reordering';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { Product } from '@/types/product';

export function ReorderModal({ product, isOpen, onOpenChange }: { product: Product | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeReorderingRequirementsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const historicalSalesData = JSON.stringify([
        { week: 1, sales: Math.floor(Math.random() * 20) + 10 },
        { week: 2, sales: Math.floor(Math.random() * 20) + 10 },
        { week: 3, sales: Math.floor(Math.random() * 20) + 10 },
        { week: 4, sales: Math.floor(Math.random() * 20) + 10 },
      ]);

      const currentStockLevel = product ? Object.values(product.stock || {}).reduce((a, b) => a + b, 0) : 0;

      const res = await analyzeReorderingRequirements({
        productId: product?.id || '',
        currentStockLevel,
        historicalSalesData: historicalSalesData,
        leadTimeDays: 7,
      });
      setResult(res);
    } catch (e) {
      setError("No se pudo obtener la sugerencia de reorden. Por favor, inténtalo de nuevo.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if(!open) {
      setResult(null);
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sugerencia de Reorden con IA</DialogTitle>
          <DialogDescription>
            Analizar los niveles de stock para <span className="font-semibold">{product?.name}</span> para obtener una cantidad de reorden óptima.
          </DialogDescription>
        </DialogHeader>

        {error && (
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {result ? (
            <div className='space-y-4'>
                <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertTitle>Sugerencia</AlertTitle>
                    <AlertDescription>
                        <p className="text-2xl font-bold">Reordenar {result.reorderQuantity} unidades</p>
                    </AlertDescription>
                </Alert>
                <div className='p-4 border rounded-md bg-muted/50'>
                    <h4 className='font-semibold mb-2'>Justificación</h4>
                    <p className='text-sm text-muted-foreground'>{result.reasoning}</p>
                </div>
            </div>
        ) : (
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Haz clic en el botón de abajo para generar una sugerencia de reorden usando IA.</p>
            </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAnalyze} disabled={loading} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            {result ? 'Regenerar' : 'Analizar Ahora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
