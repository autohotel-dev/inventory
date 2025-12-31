"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { MediaFile, MediaUploadOptions, MediaFilters } from '@/lib/types/media';
import {
    uploadMedia,
    deleteMedia,
    listMedia
} from '@/lib/services/media-service';

export function useMediaLibrary(initialFilters?: MediaFilters) {
    const [media, setMedia] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [filters, setFilters] = useState<MediaFilters>(initialFilters || {});

    // Cargar medios
    const loadMedia = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listMedia(filters);
            setMedia(data);
        } catch (error) {
            console.error('Error loading media:', error);
            toast.error('Error al cargar archivos');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Subir archivo
    const uploadFile = useCallback(async (options: MediaUploadOptions): Promise<MediaFile | null> => {
        setUploading(true);
        try {
            const newMedia = await uploadMedia(options);
            if (newMedia) {
                setMedia(prev => [newMedia, ...prev]);
                toast.success('Archivo subido correctamente', {
                    description: newMedia.filename
                });
            }
            return newMedia;
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error al subir archivo');
            return null;
        } finally {
            setUploading(false);
        }
    }, []);

    // Eliminar archivo
    const deleteFile = useCallback(async (mediaId: string): Promise<boolean> => {
        try {
            await deleteMedia(mediaId);
            setMedia(prev => prev.filter(m => m.id !== mediaId));
            toast.success('Archivo eliminado');
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Error al eliminar archivo');
            return false;
        }
    }, []);

    // Refrescar lista
    const refresh = useCallback(() => {
        loadMedia();
    }, [loadMedia]);

    // Actualizar filtros
    const updateFilters = useCallback((newFilters: Partial<MediaFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    // Cargar al montar y cuando cambien los filtros
    useEffect(() => {
        loadMedia();
    }, [loadMedia]);

    return {
        media,
        loading,
        uploading,
        filters,
        uploadFile,
        deleteFile,
        refresh,
        updateFilters
    };
}
