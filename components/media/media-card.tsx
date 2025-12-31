"use client";

import { useState } from 'react';
import { FileText, Image as ImageIcon, Copy, Trash2, MoreVertical, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { MediaFile } from '@/lib/types/media';
import { formatFileSize } from '@/lib/services/media-service';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

interface MediaCardProps {
    media: MediaFile;
    onDelete: (id: string) => void;
    onSelect?: (media: MediaFile) => void;
    selected?: boolean;
}

const categoryColors = {
    logo: 'bg-blue-500/10 text-blue-700 border-blue-200',
    banner: 'bg-purple-500/10 text-purple-700 border-purple-200',
    document: 'bg-orange-500/10 text-orange-700 border-orange-200',
    other: 'bg-gray-500/10 text-gray-700 border-gray-200',
};

const categoryLabels = {
    logo: 'Logo',
    banner: 'Banner',
    document: 'Documento',
    other: 'Otro',
};

export function MediaCard({ media, onDelete, onSelect, selected }: MediaCardProps) {
    const [copied, setCopied] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(media.file_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error copying URL:', error);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(media.file_url);

            if (!response.ok) {
                throw new Error('Error al descargar el archivo');
            }

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
            console.error('Error downloading file:', error);
            toast.error('Error al descargar archivo', {
                description: 'No se pudo descargar el archivo. Intenta de nuevo.'
            });
        }
    };

    const isImage = media.file_type === 'image';

    return (
        <div
            className={cn(
                "group relative border rounded-lg overflow-hidden hover:shadow-md transition-all bg-background",
                selected && "ring-2 ring-primary",
                onSelect && "cursor-pointer"
            )}
            onClick={() => onSelect?.(media)}
        >
            {/* Preview */}
            <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                {isImage ? (
                    <img
                        src={media.file_url}
                        alt={media.filename}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <FileText className="h-16 w-16 text-muted-foreground" />
                )}
            </div>

            {/* Info */}
            <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" title={media.filename}>
                            {media.filename}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            {formatFileSize(media.size_bytes)}
                        </p>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleCopyUrl();
                            }}>
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        ¡Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copiar URL
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload();
                                }}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Descargar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteDialog(true);
                                }}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", categoryColors[media.category])}>
                        {categoryLabels[media.category]}
                    </Badge>
                    {isImage && (
                        <Badge variant="outline" className="text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Imagen
                        </Badge>
                    )}
                </div>

                {media.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {media.description}
                    </p>
                )}
            </div>

            {selected && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-4 w-4" />
                </div>
            )}

            <DeleteConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                onConfirm={() => {
                    onDelete(media.id);
                    setShowDeleteDialog(false);
                }}
                fileName={media.filename}
            />
        </div>
    );
}
