import { Badge } from "@/components/ui/badge";
import { StockReservationService } from "@/services/stock-reservation-service";
import type { Product } from "@/types/product";

interface StockDisplayProps {
  product: Product;
  branchId: string;
  showDetailed?: boolean;
}

export function StockDisplay({ product, branchId, showDetailed = false }: StockDisplayProps) {
  const physicalStock = product.stock[branchId] || 0;
  const reservedStock = product.reservedStock?.[branchId] || 0;
  const availableStock = StockReservationService.getAvailableStock(product, branchId);

  const getStockStatus = () => {
    if (availableStock === 0) {
      return { color: '🔴', variant: 'destructive' as const, status: 'Agotado' };
    }
    if (availableStock <= 5) {
      return { color: '🟡', variant: 'secondary' as const, status: 'Stock Bajo' };
    }
    if (reservedStock > 0) {
      return { color: '🔵', variant: 'outline' as const, status: 'Con Reservas' };
    }
    return { color: '🟢', variant: 'default' as const, status: 'Disponible' };
  };

  const { color, variant, status } = getStockStatus();

  if (!showDetailed) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{color}</span>
        <Badge variant={variant} className="min-w-0">
          {availableStock}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{color}</span>
        <Badge variant={variant}>{status}</Badge>
      </div>
      
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Disponible:</span>
          <span className="font-medium text-green-600">{availableStock}</span>
        </div>
        
        {reservedStock > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reservado:</span>
              <span className="font-medium text-orange-600">{reservedStock}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Físico:</span>
              <span className="font-medium text-blue-600">{physicalStock}</span>
            </div>
          </>
        )}
        
        {reservedStock === 0 && physicalStock !== availableStock && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Físico:</span>
            <span className="font-medium text-blue-600">{physicalStock}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface MultipleStockDisplayProps {
  product: Product;
  branches: Array<{ id: string; name: string }>;
  selectedBranch?: string;
}

export function MultipleStockDisplay({ product, branches, selectedBranch }: MultipleStockDisplayProps) {
  if (selectedBranch && selectedBranch !== 'all') {
    return <StockDisplay product={product} branchId={selectedBranch} showDetailed />;
  }

  // Mostrar resumen de todas las sucursales
  const totalPhysical = Object.values(product.stock).reduce((sum, stock) => sum + stock, 0);
  const totalReserved = product.reservedStock ? 
    Object.values(product.reservedStock).reduce((sum, stock) => sum + stock, 0) : 0;
  const totalAvailable = totalPhysical - totalReserved;

  const getOverallStatus = () => {
    if (totalAvailable === 0) {
      return { color: '🔴', variant: 'destructive' as const, status: 'Agotado' };
    }
    if (totalAvailable <= 10) {
      return { color: '🟡', variant: 'secondary' as const, status: 'Stock Bajo' };
    }
    if (totalReserved > 0) {
      return { color: '🔵', variant: 'outline' as const, status: 'Con Reservas' };
    }
    return { color: '🟢', variant: 'default' as const, status: 'Disponible' };
  };

  const { color, variant, status } = getOverallStatus();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{color}</span>
        <Badge variant={variant}>{status}</Badge>
      </div>
      
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Disponible Total:</span>
          <span className="font-medium text-green-600">{totalAvailable}</span>
        </div>
        
        {totalReserved > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reservado Total:</span>
              <span className="font-medium text-orange-600">{totalReserved}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Físico Total:</span>
              <span className="font-medium text-blue-600">{totalPhysical}</span>
            </div>
          </>
        )}
      </div>

      {branches.length > 1 && (
        <div className="border-t pt-2">
          <div className="text-xs text-muted-foreground font-medium mb-2">Por Sucursal:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {branches.map(branch => {
              const branchAvailable = StockReservationService.getAvailableStock(product, branch.id);
              const branchReserved = product.reservedStock?.[branch.id] || 0;
              const branchStatus = branchAvailable === 0 ? '🔴' : 
                                 branchAvailable <= 3 ? '🟡' : 
                                 branchReserved > 0 ? '🔵' : '🟢';
              
              return (
                <div key={branch.id} className="flex items-center justify-between">
                  <span className="truncate">{branchStatus} {branch.name}:</span>
                  <span className="font-medium">{branchAvailable}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
