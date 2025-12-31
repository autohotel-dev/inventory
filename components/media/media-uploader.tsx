"use client";

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateFile } from '@/lib/services/media-service';
import type { MediaCategory } from '@/lib/types/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UploadProgress } from './upload-progress';

interface MediaUploaderProps {
    onUpload: (file: File, category: MediaCategory, description?: string) => Promise<void>;
    uploading?: boolean;
}

export function MediaUploader({ onUpload, uploading = false }: MediaUploaderProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [category, setCategory] = useState<MediaCategory>('other');
    const [description, setDescription] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Cleanup preview para evitar memory leaks (Bug #3)
    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            const validation = validateFile(file);

            if (!validation.valid) {
                toast.error('Archivo inválido', {
                    description: validation.error
                });
                return;
            }

            // Limpiar preview anterior si existe
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }

            setSelectedFile(file);

            // Generar preview si es imagen
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setPreview(e.target?.result as string);
                reader.onerror = () => {
                    toast.error('Error al cargar vista previa');
                };
                reader.readAsDataURL(file);
            } else {
                setPreview(null);
            }
        }
    }, [preview]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        maxFiles: 1,
        disabled: uploading
    });

    const handleUpload = async () => {
        if (!selectedFile) return;

        // Simular progreso (UX1)
        setUploadProgress(0);
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) {
                    clearInterval(progressInterval);
                    return 90;
                }
                return prev + 10;
            });
        }, 100);

        try {
            await onUpload(selectedFile, category, description);
            setUploadProgress(100);
        } finally {
            clearInterval(progressInterval);
            setTimeout(() => {
                setUploadProgress(0);
            }, 500);
        }

        // Limpiar formulario y preview
        if (preview && preview.startsWith('data:')) {
            // No necesita revokeObjectURL para data URLs
        }
        setSelectedFile(null);
        setPreview(null);
        setDescription('');
        setCategory('other');
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setPreview(null);
        setDescription('');
    };

    return (
        <div className="space-y-4">
            {!selectedFile ? (
                <div
                    {...getRootProps()}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                        isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                        uploading && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <input {...getInputProps()} />
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    {isDragActive ? (
                        <p className="text-lg font-medium">Suelta el archivo aquí...</p>
                    ) : (
                        <>
                            <p className="text-lg font-medium mb-2">
                                Arrastra un archivo aquí o haz clic para seleccionar
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Imágenes (PNG, JPG, GIF, WebP) o documentos (PDF, DOC, DOCX)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Tamaño máximo: 10 MB
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <div className="border rounded-lg p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        {preview ? (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <FileText className="h-16 w-16 text-muted-foreground" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate mb-1">{selectedFile.name}</h4>
                            <p className="text-sm text-muted-foreground">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>

                            <div className="mt-4 space-y-3">
                                <div>
                                    <Label htmlFor="category">Categoría</Label>
                                    <Select value={category} onValueChange={(v) => setCategory(v as MediaCategory)}>
                                        <SelectTrigger id="category">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="logo">Logo</SelectItem>
                                            <SelectItem value="banner">Banner</SelectItem>
                                            <SelectItem value="document">Documento</SelectItem>
                                            <SelectItem value="other">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="description">Descripción (opcional)</Label>
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe el archivo..."
                                        maxLength={500}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {description.length}/500 caracteres
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancel}
                            disabled={uploading}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleCancel} variant="outline" disabled={uploading} className="flex-1">
                            Cancelar
                        </Button>
                        <Button onClick={handleUpload} disabled={uploading} className="flex-1">
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Subiendo...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Subir archivo
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Progress bar (UX1) */}
            {uploading && uploadProgress > 0 && selectedFile && (
                <UploadProgress progress={uploadProgress} fileName={selectedFile.name} />
            )}
        </div>
    );
}
