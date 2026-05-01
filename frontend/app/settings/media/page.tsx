"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, RefreshCw, Image as ImageIcon, FileText, Folder, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaUploader } from '@/components/media/media-uploader';
import { MediaCard } from '@/components/media/media-card';
import { MediaLightbox } from '@/components/media/media-lightbox';
import { useMediaLibrary } from '@/hooks/use-media-library';
import { useUserRole } from '@/hooks/use-user-role';
import type { MediaCategory } from '@/lib/types/media';
import { Skeleton } from '@/components/ui/skeleton';

export default function MediaLibraryPage() {
    const router = useRouter();
    const { canAccessAdmin, isLoading: roleLoading } = useUserRole();
    const { media, loading, uploading, filters, uploadFile, deleteFile, refresh, updateFilters } = useMediaLibrary();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<typeof media[0] | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Búsqueda con debounce (UX6) - DEBE estar ANTES de early returns
    useEffect(() => {
        const timer = setTimeout(() => {
            updateFilters({ search: searchTerm });
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm, updateFilters]);

    // Ordenamiento de medios (UX5) - DEBE estar ANTES de early returns
    const sortedMedia = useMemo(() => {
        const sorted = [...media].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'name':
                    comparison = a.filename.localeCompare(b.filename);
                    break;
                case 'size':
                    comparison = a.size_bytes - b.size_bytes;
                    break;
                case 'date':
                default:
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [media, sortBy, sortOrder]);

    // Protección de acceso solo para administradores
    useEffect(() => {
        if (!roleLoading && !canAccessAdmin) {
            router.push('/dashboard');
        }
    }, [canAccessAdmin, roleLoading, router]);

    // Mostrar loading mientras se verifica el rol
    if (roleLoading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-muted-foreground">Verificando permisos...</p>
                    </div>
                </div>
            </div>
        );
    }

    // No mostrar nada si no es admin (mientras redirige)
    if (!canAccessAdmin) {
        return null;
    }

    const handleUpload = async (file: File, category: MediaCategory, description?: string) => {
        await uploadFile({ file, category, description });
    };


    const handleCategoryFilter = (category: string) => {
        updateFilters({ category: category === 'all' ? undefined : category as MediaCategory });
    };

    // Navegación del lightbox
    const handleMediaClick = (mediaItem: typeof media[0]) => {
        setSelectedMedia(mediaItem);
    };

    const handlePreviousMedia = () => {
        if (!selectedMedia) return;
        const currentIndex = sortedMedia.findIndex(m => m.id === selectedMedia.id);
        if (currentIndex > 0) {
            setSelectedMedia(sortedMedia[currentIndex - 1]);
        }
    };

    const handleNextMedia = () => {
        if (!selectedMedia) return;
        const currentIndex = sortedMedia.findIndex(m => m.id === selectedMedia.id);
        if (currentIndex < sortedMedia.length - 1) {
            setSelectedMedia(sortedMedia[currentIndex + 1]);
        }
    };

    const currentMediaIndex = selectedMedia ? sortedMedia.findIndex(m => m.id === selectedMedia.id) : -1;

    const stats = {
        total: media.length,
        logos: media.filter(m => m.category === 'logo').length,
        banners: media.filter(m => m.category === 'banner').length,
        documents: media.filter(m => m.category === 'document').length,
        images: media.filter(m => m.file_type === 'image').length,
    };


    return (
        <div className="container mx-auto px-2 sm:px-4 md:p-6 max-w-7xl space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-3xl font-bold mb-2">Biblioteca de Medios</h1>
                <p className="text-muted-foreground">
                    Gestiona tus logos, imágenes y documentos
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Total</CardDescription>
                        <CardTitle className="text-2xl">{stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Logos</CardDescription>
                        <CardTitle className="text-2xl">{stats.logos}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Banners</CardDescription>
                        <CardTitle className="text-2xl">{stats.banners}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Documentos</CardDescription>
                        <CardTitle className="text-2xl">{stats.documents}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Imágenes</CardDescription>
                        <CardTitle className="text-2xl">{stats.images}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Tabs defaultValue="library" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="library">
                        <Folder className="h-4 w-4 mr-2" />
                        Biblioteca
                    </TabsTrigger>
                    <TabsTrigger value="upload">
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Subir Archivo
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subir Archivo</CardTitle>
                            <CardDescription>
                                Arrastra un archivo o haz clic para seleccionar
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MediaUploader onUpload={handleUpload} uploading={uploading} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="library" className="space-y-4">
                    {/* Filters */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Buscar archivos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Búsqueda automática
                                    </p>
                                </div>

                                <Select
                                    value={filters.category || 'all'}
                                    onValueChange={handleCategoryFilter}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <Filter className="h-4 w-4 mr-2" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las categorías</SelectItem>
                                        <SelectItem value="logo">Logos</SelectItem>
                                        <SelectItem value="banner">Banners</SelectItem>
                                        <SelectItem value="document">Documentos</SelectItem>
                                        <SelectItem value="other">Otros</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Ordenamiento (UX5) */}
                                <Select
                                    value={`${sortBy}-${sortOrder}`}
                                    onValueChange={(value) => {
                                        const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder];
                                        setSortBy(newSortBy);
                                        setSortOrder(newSortOrder);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <ArrowUpDown className="h-4 w-4 mr-2" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date-desc">Más recientes</SelectItem>
                                        <SelectItem value="date-asc">Más antiguos</SelectItem>
                                        <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                                        <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                                        <SelectItem value="size-desc">Más grande</SelectItem>
                                        <SelectItem value="size-asc">Más pequeño</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button onClick={refresh} variant="outline" size="icon">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Media Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Card key={i}>
                                    <Skeleton className="aspect-video w-full" />
                                    <CardContent className="pt-3 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : media.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                <h3 className="text-lg font-medium mb-2">No hay archivos</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Comienza subiendo tu primer archivo
                                </p>
                                <Button onClick={() => document.querySelector<HTMLElement>('[data-value="upload"]')?.click()}>
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Subir Archivo
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {sortedMedia.map((item) => (
                                <MediaCard
                                    key={item.id}
                                    media={item}
                                    onDelete={deleteFile}
                                    onSelect={handleMediaClick}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Lightbox (UX2) */}
            <MediaLightbox
                media={selectedMedia}
                onClose={() => setSelectedMedia(null)}
                onPrevious={handlePreviousMedia}
                onNext={handleNextMedia}
                hasPrevious={currentMediaIndex > 0}
                hasNext={currentMediaIndex >= 0 && currentMediaIndex < sortedMedia.length - 1}
            />
        </div>
    );
}
