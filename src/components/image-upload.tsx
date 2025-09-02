"use client"

import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageUploadService } from '@/services/image-upload-service';
import Image from 'next/image';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (imageUrl: string | null) => void;
  accountId: string;
  productId?: string;
  disabled?: boolean;
}

export function ImageUpload({ 
  currentImageUrl, 
  onImageChange, 
  accountId, 
  productId, 
  disabled = false 
}: ImageUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Validaciones básicas
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor selecciona un archivo de imagen válido');
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB
        throw new Error('La imagen no puede ser mayor a 5MB');
      }

      // Mostrar preview inmediatamente
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Redimensionar imagen si es muy grande
      let fileToUpload = file;
      if (file.size > 1024 * 1024) { // Si es mayor a 1MB, redimensionar
        try {
          fileToUpload = await ImageUploadService.resizeImage(file, 800, 600, 0.8);
        } catch (resizeError) {
          console.warn('No se pudo redimensionar la imagen, usando original:', resizeError);
          // Continuar con la imagen original si falla el redimensionado
        }
      }

      // Generar path único y subir imagen directamente
      const downloadUrl = await ImageUploadService.uploadImage(fileToUpload, accountId, productId);

      // Limpiar preview temporal
      URL.revokeObjectURL(previewUrl);
      
      // Actualizar con la URL real
      setPreview(downloadUrl);
      onImageChange(downloadUrl);

      toast({
        title: "Imagen subida",
        description: "La imagen del producto se ha subido correctamente."
      });

    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Limpiar preview en caso de error
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
      setPreview(currentImageUrl || null);
      
      toast({
        title: "Error al subir imagen",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Limpiar input
      event.target.value = '';
    }
  }, [accountId, productId, currentImageUrl, preview, onImageChange, toast]);

  const handleRemoveImage = useCallback(async () => {
    try {
      // Si hay una imagen actual de Firebase Storage, intentar eliminarla
      const isFirebaseStorage = currentImageUrl && 
        (currentImageUrl.includes('firebasestorage.googleapis.com') || 
         currentImageUrl.includes('.firebasestorage.app'));
         
      if (isFirebaseStorage) {
        await ImageUploadService.deleteImage(currentImageUrl);
      }

      // Limpiar preview temporal si existe
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      setPreview(null);
      onImageChange(null);

      toast({
        title: "Imagen eliminada",
        description: "La imagen del producto se ha eliminado."
      });

    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Error al eliminar imagen",
        description: "No se pudo eliminar la imagen completamente, pero se ha removido del producto.",
        variant: "destructive"
      });
      
      // Aún así limpiar localmente
      setPreview(null);
      onImageChange(null);
    }
  }, [currentImageUrl, preview, onImageChange, toast]);

  return (
    <div className="space-y-4">
      <Label>Imagen del Producto</Label>
      
      {/* Preview de la imagen */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden">
            {preview ? (
              <div className="relative w-full h-full">
                <Image
                  src={preview}
                  alt="Preview del producto"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-2" />
                <p className="text-sm">Sin foto</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controles de subida */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => document.getElementById('image-upload')?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo...' : (preview ? 'Cambiar imagen' : 'Subir imagen')}
          </Button>
          
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
      )}

      {/* Información sobre formatos aceptados */}
      <p className="text-xs text-muted-foreground">
        Formatos soportados: JPG, PNG, GIF, WebP. Tamaño máximo: 5MB.
        Las imágenes grandes se redimensionarán automáticamente.
      </p>
    </div>
  );
}
