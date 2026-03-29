"use client";

import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaCard } from './media-card';
import { useMediaLibrary } from '@/hooks/use-media-library';
import type { MediaFile, MediaCategory } from '@/lib/types/media';
import { Skeleton } from '@/components/ui/skeleton';

interface MediaPickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (media: MediaFile) => void;
    category?: MediaCategory; // Filtrar por categoría específica
    accept?: 'image' | 'document' | 'all'; // Tipo de archivo a aceptar
}

export function MediaPicker({ open, onClose, onSelect, category, accept = 'all' }: MediaPickerProps) {
    const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { media, loading, filters, updateFilters } = useMediaLibrary({
        category,
        file_type: accept !== 'all' ? accept : undefined
    });

    const handleSelect = (item: MediaFile) => {
        setSelectedMedia(item);
    };

    const handleConfirm = () => {
        if (selectedMedia) {
            onSelect(selectedMedia);
            onClose();
            setSelectedMedia(null);
        }
    };

    const handleSearch = () => {
        updateFilters({ search: searchTerm });
    };

    const handleCategoryFilter = (cat: string) => {
        updateFilters({ category: cat === 'all' ? undefined : cat as MediaCategory });
    };

    // Reset al cerrar
    useEffect(() => {
        if (!open) {
            setSelectedMedia(null);
            setSearchTerm('');
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Seleccionar Archivo</DialogTitle>
                    <DialogDescription>
                        Elige un archivo de la biblioteca de medios
                    </DialogDescription>
                </DialogHeader>

                {/* Filters */}
                <div className="flex gap-2 border-b pb-4">
                    <div className="flex-1 flex gap-2">
                        <Input
                            placeholder="Buscar archivos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} variant="secondary" size="icon">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    {!category && (
                        <Select
                            value={filters.category || 'all'}
                            onValueChange={handleCategoryFilter}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="logo">Logos</SelectItem>
                                <SelectItem value="banner">Banners</SelectItem>
                                <SelectItem value="document">Documentos</SelectItem>
                                <SelectItem value="other">Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Media Grid */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="aspect-video w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : media.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <p className="text-muted-foreground mb-2">No se encontraron archivos</p>
                            <p className="text-sm text-muted-foreground">
                                Intenta ajustar los filtros o sube nuevos archivos
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {media.map((item) => (
                                <MediaCard
                                    key={item.id}
                                    media={item}
                                    onDelete={() => { }} // No permitir eliminar desde el picker
                                    onSelect={handleSelect}
                                    selected={selectedMedia?.id === item.id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                        {selectedMedia ? (
                            <span className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-primary" />
                                Seleccionado: {selectedMedia.filename}
                            </span>
                        ) : (
                            'Selecciona un archivo'
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirm} disabled={!selectedMedia}>
                            Confirmar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
