import { createClient } from '@/lib/supabase/client';
import type { MediaFile, MediaUploadOptions, MediaFilters } from '@/lib/types/media';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'media-files';
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
    // Extraer extensión de forma segura
    const parts = originalName.split('.');
    const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';

    // Sanitizar nombre base
    const nameWithoutExt = parts.join('.') || 'file';
    const safeName = nameWithoutExt
        .slice(0, MAX_FILENAME_LENGTH)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_') // Reemplazar múltiples underscores
        .replace(/^_|_$/g, ''); // Remover underscores al inicio/final

    // Generar ID único criptográficamente seguro
    const uniqueId = uuidv4();

    // Formato: nombre_uuid.ext
    return `${safeName || 'file'}_${uniqueId}.${extension}`;
}

/**
 * Valida que el usuario esté autenticado
 */
async function validateAuthentication(supabase: any) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        throw new Error('Usuario no autenticado. Por favor inicia sesión.');
    }
    return user;
}

/**
 * Sube un archivo a Supabase Storage y crea el registro en la base de datos
 */
export async function uploadMedia(options: MediaUploadOptions): Promise<MediaFile | null> {
    const { file, category = 'other', description } = options;
    const supabase = createClient();

    try {
        // Validar autenticación
        const user = await validateAuthentication(supabase);

        // Validar tamaño
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`);
        }

        // Generar nombre único
        const uniqueFilename = generateUniqueFilename(file.name);
        const filePath = `${category}/${uniqueFilename}`;

        // Subir archivo a Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Error al subir archivo: ${uploadError.message}`);
        }

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        // Crear registro en la base de datos
        const mediaRecord = {
            filename: file.name.slice(0, 255), // Limitar longitud
            file_path: filePath,
            file_url: publicUrl,
            file_type: getFileType(file.type),
            mime_type: file.type,
            size_bytes: file.size,
            category,
            description: description?.slice(0, 500), // Limitar descripción
            uploaded_by: user.id
        };

        const { data, error: dbError } = await supabase
            .from('media_library')
            .insert(mediaRecord)
            .select()
            .single();

        if (dbError) {
            // Rollback: Si falla la inserción en BD, eliminar el archivo subido
            console.error('Database error, rolling back upload:', dbError);
            try {
                await supabase.storage.from(BUCKET_NAME).remove([filePath]);
            } catch (cleanupError) {
                console.error('Failed to cleanup orphaned file:', cleanupError);
            }
            throw new Error(`Error al guardar información del archivo: ${dbError.message}`);
        }

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
    const supabase = createClient();

    try {
        // Validar autenticación
        const user = await validateAuthentication(supabase);

        // Obtener información del archivo y verificar propiedad
        const { data: media, error: fetchError } = await supabase
            .from('media_library')
            .select('file_path, uploaded_by')
            .eq('id', mediaId)
            .single();

        if (fetchError) {
            throw new Error(`Error al buscar archivo: ${fetchError.message}`);
        }

        if (!media) {
            throw new Error('Archivo no encontrado');
        }

        // Verificar que el usuario sea el dueño del archivo
        if (media.uploaded_by !== user.id) {
            throw new Error('No tienes permiso para eliminar este archivo');
        }

        // Primero eliminar de base de datos (para mantener consistencia)
        const { error: dbError } = await supabase
            .from('media_library')
            .delete()
            .eq('id', mediaId);

        if (dbError) {
            throw new Error(`Error al eliminar registro: ${dbError.message}`);
        }

        // Luego eliminar de storage (si falla, ya se eliminó de BD que es lo importante)
        try {
            const { error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([media.file_path]);

            if (storageError) {
                console.warn('Error eliminando archivo de storage (archivo huérfano creado):', storageError);
                // No lanzar error, el registro ya se eliminó
            }
        } catch (storageErr) {
            console.warn('Failed to delete from storage:', storageErr);
            // No es crítico, el registro ya se removió
        }

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
    const supabase = createClient();

    try {
        let query = supabase
            .from('media_library')
            .select('*')
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters?.category) {
            query = query.eq('category', filters.category);
        }

        if (filters?.file_type) {
            query = query.eq('file_type', filters.file_type);
        }

        if (filters?.search) {
            query = query.ilike('filename', `%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];

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
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('media_library')
            .update(updates)
            .eq('id', mediaId)
            .select()
            .single();

        if (error) throw error;

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
    // Validar tamaño
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return { valid: false, error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB` };
    }

    // Validar tipos permitidos
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no permitido' };
    }

    return { valid: true };
}
