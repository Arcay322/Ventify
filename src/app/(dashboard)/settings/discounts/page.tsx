"use client"

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import { Percent, Gift, Settings, Users, AlertTriangle } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DiscountSettings {
  cashierMaxDiscount: number;
  cashierMaxDiscountType: 'amount' | 'percentage';
  managerMaxDiscount: number;
  managerMaxDiscountType: 'amount' | 'percentage';
  requireApprovalAbove: number;
  allowNegativeInventory: boolean;
  trackDiscountReasons: boolean;
}

interface PromotionRule {
  id: string;
  name: string;
  type: 'quantity_discount' | 'total_discount' | 'product_gift' | 'percentage_off';
  active: boolean;
  conditions: {
    minQuantity?: number;
    minTotal?: number;
    productIds?: string[];
  };
  rewards: {
    discountAmount?: number;
    discountPercentage?: number;
    freeProductId?: string;
    freeQuantity?: number;
  };
  validFrom: string;
  validTo: string;
  description: string;
}

export default function DiscountsSettingsPage() {
  const { toast } = useToast();
  const { isOwner, isAdmin } = usePermissions();
  const { userDoc } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [discountSettings, setDiscountSettings] = useState<DiscountSettings>({
    cashierMaxDiscount: 20,
    cashierMaxDiscountType: 'amount',
    managerMaxDiscount: 50,
    managerMaxDiscountType: 'percentage',
    requireApprovalAbove: 100,
    allowNegativeInventory: false,
    trackDiscountReasons: true
  });

  const [promotions, setPromotions] = useState<PromotionRule[]>([]);

  const loadSettings = useCallback(async () => {
    if (loading) return; // Evitar múltiples llamadas
    
    try {
      if (!userDoc?.accountId) return;
      
      setLoading(true);
      const settingsRef = doc(db, 'accounts', userDoc.accountId, 'settings', 'discounts');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        setDiscountSettings(settingsDoc.data() as DiscountSettings);
      }
      
      // TODO: Cargar promociones desde Firestore
      setPromotions([]);
      
    } catch (error) {
      console.error('Error loading discount settings:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [loading, userDoc?.accountId, toast]);

  useEffect(() => {
    if (!userDoc?.accountId) return;
    
    if (!isOwner() && !isAdmin()) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores y propietarios pueden acceder a esta sección.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    
    loadSettings();
  }, [userDoc?.accountId, isOwner, isAdmin, toast, loadSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      if (!userDoc?.accountId) return;
      
      const settingsRef = doc(db, 'accounts', userDoc.accountId, 'settings', 'discounts');
      await setDoc(settingsRef, discountSettings);
      
      toast({
        title: "Configuración guardada",
        description: "Las configuraciones de descuentos se han actualizado correctamente."
      });
      
    } catch (error) {
      console.error('Error saving discount settings:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las configuraciones.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner() && !isAdmin()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Acceso restringido</h3>
          <p className="text-muted-foreground">Solo los administradores y propietarios pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando configuraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Descuentos y Promociones</h1>
        <p className="text-muted-foreground">
          Configura límites de descuentos por rol y gestiona promociones automáticas.
        </p>
      </div>

      <Tabs defaultValue="discounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="discounts">
            <Percent className="h-4 w-4 mr-2" />
            Límites de Descuento
          </TabsTrigger>
          <TabsTrigger value="promotions">
            <Gift className="h-4 w-4 mr-2" />
            Promociones
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Configuración General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Límites por Rol
              </CardTitle>
              <CardDescription>
                Define los límites máximos de descuento que puede aplicar cada rol de usuario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Límites para Cajeros */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Cajero</Badge>
                  <span className="text-sm text-muted-foreground">Límites para cajeros</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de límite</Label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={discountSettings.cashierMaxDiscountType}
                      onChange={(e) => setDiscountSettings(prev => ({
                        ...prev,
                        cashierMaxDiscountType: e.target.value as 'amount' | 'percentage'
                      }))}
                    >
                      <option value="amount">Monto fijo (S/)</option>
                      <option value="percentage">Porcentaje (%)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>
                      Límite máximo {discountSettings.cashierMaxDiscountType === 'amount' ? '(S/)' : '(%)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step={discountSettings.cashierMaxDiscountType === 'amount' ? '0.01' : '1'}
                      value={discountSettings.cashierMaxDiscount}
                      onChange={(e) => setDiscountSettings(prev => ({
                        ...prev,
                        cashierMaxDiscount: parseFloat(e.target.value) || 0
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Vista previa</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {discountSettings.cashierMaxDiscountType === 'amount' 
                        ? `Máximo S/${discountSettings.cashierMaxDiscount}`
                        : `Máximo ${discountSettings.cashierMaxDiscount}% del total`
                      }
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Límites para Managers */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Manager</Badge>
                  <span className="text-sm text-muted-foreground">Límites para gerentes</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de límite</Label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={discountSettings.managerMaxDiscountType}
                      onChange={(e) => setDiscountSettings(prev => ({
                        ...prev,
                        managerMaxDiscountType: e.target.value as 'amount' | 'percentage'
                      }))}
                    >
                      <option value="amount">Monto fijo (S/)</option>
                      <option value="percentage">Porcentaje (%)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>
                      Límite máximo {discountSettings.managerMaxDiscountType === 'amount' ? '(S/)' : '(%)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step={discountSettings.managerMaxDiscountType === 'amount' ? '0.01' : '1'}
                      value={discountSettings.managerMaxDiscount}
                      onChange={(e) => setDiscountSettings(prev => ({
                        ...prev,
                        managerMaxDiscount: parseFloat(e.target.value) || 0
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Vista previa</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {discountSettings.managerMaxDiscountType === 'amount' 
                        ? `Máximo S/${discountSettings.managerMaxDiscount}`
                        : `Máximo ${discountSettings.managerMaxDiscount}% del total`
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Promociones Automáticas</CardTitle>
              <CardDescription>
                Configura promociones que se aplicarán automáticamente según las condiciones establecidas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Próximamente</h3>
                <p className="text-muted-foreground mb-4">
                  La gestión de promociones automáticas estará disponible en una próxima actualización.
                </p>
                <Button variant="outline" disabled>
                  Crear Promoción
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>
                Configuraciones adicionales para el sistema de descuentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir aprobación para descuentos grandes</Label>
                  <p className="text-sm text-muted-foreground">
                    Descuentos mayores a este monto requerirán aprobación de un supervisor.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">S/</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountSettings.requireApprovalAbove}
                    onChange={(e) => setDiscountSettings(prev => ({
                      ...prev,
                      requireApprovalAbove: parseFloat(e.target.value) || 0
                    }))}
                    className="w-24"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Rastrear motivos de descuento</Label>
                  <p className="text-sm text-muted-foreground">
                    Requerir que los usuarios especifiquen el motivo del descuento.
                  </p>
                </div>
                <Switch
                  checked={discountSettings.trackDiscountReasons}
                  onCheckedChange={(checked) => setDiscountSettings(prev => ({
                    ...prev,
                    trackDiscountReasons: checked
                  }))}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}