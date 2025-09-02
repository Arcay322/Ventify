import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '@/lib/firebase';

const storage = getStorage(app);

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Sube una imagen al Storage de Firebase
 * @param file Archivo a subir
 * @param path Ruta donde se guardará el archivo (ej: 'products/account-id/image.jpg')
 * @param accountId ID de la cuenta para organizar los archivos
 * @returns Promise con la URL de descarga y la ruta del archivo
 */
export async function uploadImage(file: File, path: string, accountId: string): Promise<UploadResult> {
  try {
    // Si el path no incluye el accountId, lo agregamos
    const fullPath = path.includes(accountId) ? path : `products/${accountId}/${path.split('/').pop()}`;
    
    const storageRef = ref(storage, fullPath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      url: downloadURL,
      path: fullPath
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Error al subir la imagen. Por favor, inténtalo de nuevo.');
  }
}

/**
 * Elimina una imagen del Storage de Firebase
 * @param path Ruta del archivo a eliminar
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // No lanzamos error aquí porque es opcional eliminar la imagen anterior
  }
}

/**
 * Genera un nombre único para un archivo
 * @param originalName Nombre original del archivo
 * @param accountId ID de la cuenta
 * @param folder Carpeta donde se guardará (por defecto 'products')
 * @returns Ruta completa del archivo
 */
export function generateImagePath(originalName: string, accountId: string, folder: string = 'products'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop();
  const fileName = `${timestamp}-${random}.${extension}`;
  
  return `${folder}/${accountId}/${fileName}`;
}

/**
 * Valida si un archivo es una imagen válida
 * @param file Archivo a validar
 * @returns true si es una imagen válida
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!validTypes.includes(file.type)) {
    throw new Error('Tipo de archivo no válido. Solo se permiten JPEG, PNG y WebP.');
  }
  
  if (file.size > maxSize) {
    throw new Error('El archivo es demasiado grande. Máximo 5MB.');
  }
  
  return true;
}
