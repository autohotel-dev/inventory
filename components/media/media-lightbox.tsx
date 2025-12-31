"use client";

import { useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MediaFile } from '@/lib/types/media';
import { formatFileSize } from '@/lib/services/media-service';
import { cn } from '@/lib/utils';

interface MediaLightboxProps {
    media: MediaFile | null;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

const categoryLabels = {
    logo: 'Logo',
    banner: 'Banner',
    document: 'Documento',
    other: 'Otro',
};

export function MediaLightbox({
    media,
    onClose,
    onPrevious,
    onNext,
    hasPrevious,
    hasNext
}: MediaLightboxProps) {
    // Cerrar con ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) onPrevious();
            if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
        };

        if (media) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [media, onClose, onPrevious, onNext, hasPrevious, hasNext]);

    if (!media) return null;

    const handleDownload = async () => {
        try {
            const response = await fetch(media.file_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = media.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading:', error);
        }
    };

    const isImage = media.file_type === 'image';

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Botón cerrar */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={onClose}
            >
                <X className="h-6 w-6" />
            </Button>

            {/* Botón anterior */}
            {hasPrevious && onPrevious && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPrevious();
                    }}
                >
                    <ChevronLeft className="h-8 w-8" />
                </Button>
            )}

            {/* Botón siguiente */}
            {hasNext && onNext && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNext();
                    }}
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>
            )}

            {/* Contenido */}
            <div
                className="max-w-7xl max-h-[90vh] w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Imagen */}
                {isImage ? (
                    <div className="relative flex items-center justify-center mb-4">
                        <img
                            src={media.file_url}
                            alt={media.filename}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center bg-muted rounded-lg p-12">
                        <div className="text-center">
                            <p className="text-muted-foreground mb-4">Vista previa no disponible</p>
                            <Button onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar archivo
                            </Button>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="bg-background rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">{media.filename}</h3>
                            <p className="text-sm text-muted-foreground">
                                {formatFileSize(media.size_bytes)} • {media.mime_type}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            {categoryLabels[media.category]}
                        </Badge>
                        {isImage && (
                            <Badge variant="outline">Imagen</Badge>
                        )}
                    </div>

                    {media.description && (
                        <p className="text-sm text-muted-foreground pt-2 border-t">
                            {media.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Indicador de navegación */}
            {(hasPrevious || hasNext) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                    Usa ← → para navegar
                </div>
            )}
        </div>
    );
}
