import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export class ImageUploadService {
  /**
   * Sube una imagen a Firebase Storage
   * @param file - Archivo de imagen a subir
   * @param accountId - ID de la cuenta
   * @param productId - ID del producto (opcional)
   * @returns Promise con la URL de descarga de la imagen
   */
  static async uploadImage(file: File, accountId: string, productId?: string): Promise<string> {
    try {
      // Validar que sea un archivo de imagen
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen');
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('La imagen no puede ser mayor a 5MB');
      }

      // Redimensionar imagen
      const resizedFile = await this.resizeImage(file);
      
      // Generar path único para la imagen
      const imagePath = this.generateProductImagePath(accountId, productId, file.name);
      
      // Crear referencia en Storage
      const storageRef = ref(storage, imagePath);
      
      // Subir archivo
      const snapshot = await uploadBytes(storageRef, resizedFile);
      
      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error instanceof Error ? error : new Error('Error al subir la imagen');
    }
  }

  /**
   * Elimina una imagen de Firebase Storage
   * @param imageUrl - URL de la imagen a eliminar
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Verificar si es una URL de Firebase Storage (soportar ambos dominios)
      const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com') || 
                               imageUrl.includes('.firebasestorage.app');
      
      if (!isFirebaseStorage) {
        return; // No es una imagen de Firebase Storage
      }

      // Crear referencia desde la URL
      const storageRef = ref(storage, imageUrl);
      
      // Eliminar archivo
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      // No lanzamos error aquí para que no interrumpa otras operaciones
    }
  }

  /**
   * Genera un path único para una imagen de producto
   * @param accountId - ID de la cuenta
   * @param productId - ID del producto (opcional, se genera si no se proporciona)
   * @param fileName - Nombre del archivo original
   * @returns Path único para la imagen
   */
  static generateProductImagePath(accountId: string, productId: string | undefined, fileName: string): string {
    const timestamp = Date.now();
    // Limpiar nombre del archivo y evitar doble extensión
    const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalFileName = productId 
      ? `${productId}_${timestamp}_${cleanName}.webp`
      : `new_${timestamp}_${cleanName}.webp`;
    
    return `products/${accountId}/${finalFileName}`;
  }

  /**
   * Redimensiona una imagen antes de subirla (opcional, requiere canvas)
   * @param file - Archivo de imagen original
   * @param maxWidth - Ancho máximo
   * @param maxHeight - Alto máximo
   * @param quality - Calidad de compresión (0-1)
   * @returns Promise con el archivo redimensionado
   */
  static async resizeImage(
    file: File, 
    maxWidth: number = 800, 
    maxHeight: number = 600, 
    quality: number = 0.8
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calcular nuevas dimensiones manteniendo el aspect ratio
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Dibujar imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height);

        // Convertir a blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            } else {
              reject(new Error('Error al redimensionar la imagen'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = URL.createObjectURL(file);
    });
  }
}
