import { apiClient } from '@/lib/api/client';
import type { MediaFile, MediaUploadOptions, MediaFilters } from '@/lib/types/media';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from 'aws-amplify/auth';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILENAME_LENGTH = 100;

/**
 * Determina el tipo de archivo basado en el MIME type
 */
function getFileType(mimeType: string): 'image' | 'document' | 'other' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'other';
}

/**
 * Genera un nombre único y seguro para el archivo usando UUID
 */
function generateUniqueFilename(originalName: string): string {
    const parts = originalName.split('.');
    const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';
    const nameWithoutExt = parts.join('.') || 'file';
    const safeName = nameWithoutExt
        .slice(0, MAX_FILENAME_LENGTH)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    const uniqueId = uuidv4();
    return `${safeName || 'file'}_${uniqueId}.${extension}`;
}

/**
 * Valida que el usuario esté autenticado
 */
async function validateAuthentication() {
    try {
        const user = await getCurrentUser();
        return user;
    } catch {
        throw new Error('Usuario no autenticado. Por favor inicia sesión.');
    }
}

/**
 * Sube un archivo vía la API del backend y crea el registro en la base de datos
 */
export async function uploadMedia(options: MediaUploadOptions): Promise<MediaFile | null> {
    const { file, category = 'other', description } = options;

    try {
        const user = await validateAuthentication();

        // Validar tamaño
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`);
        }

        // Upload file via backend API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        if (description) formData.append('description', description);

        const { data } = await apiClient.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        return data;
    } catch (error) {
        console.error('Error uploading media:', error);
        throw error;
    }
}

/**
 * Elimina un archivo de la biblioteca y del storage
 */
export async function deleteMedia(mediaId: string): Promise<boolean> {
    try {
        await validateAuthentication();
        await apiClient.delete(`/system/crud/media_library/${mediaId}`);
        return true;
    } catch (error) {
        console.error('Error deleting media:', error);
        throw error;
    }
}

/**
 * Obtiene la lista de archivos con filtros opcionales
 */
export async function listMedia(filters?: MediaFilters): Promise<MediaFile[]> {
    try {
        const params: Record<string, any> = {};
        if (filters?.category) params.category = filters.category;
        if (filters?.file_type) params.file_type = filters.file_type;
        if (filters?.search) params.search = filters.search;

        const { data } = await apiClient.get('/system/crud/media_library', { params });
        const results = Array.isArray(data) ? data : (data?.items || data?.results || []);
        return results;
    } catch (error) {
        console.error('Error listing media:', error);
        throw error;
    }
}

/**
 * Obtiene archivos por categoría
 */
export async function getMediaByCategory(category: string): Promise<MediaFile[]> {
    return listMedia({ category: category as any });
}

/**
 * Actualiza los metadatos de un archivo
 */
export async function updateMediaMetadata(
    mediaId: string,
    updates: { filename?: string; description?: string; category?: string }
): Promise<MediaFile | null> {
    try {
        const { data } = await apiClient.patch(`/system/crud/media_library/${mediaId}`, updates);
        return data;
    } catch (error) {
        console.error('Error updating media metadata:', error);
        throw error;
    }
}

/**
 * Formatea el tamaño de archivo a formato legible
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Valida si un archivo es válido para subir
 */
export function validateFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return { valid: false, error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB` };
    }
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no permitido' };
    }
    return { valid: true };
}
