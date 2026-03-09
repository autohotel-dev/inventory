// Tipos para el sistema de gestión de medios

export type MediaCategory = 'logo' | 'banner' | 'document' | 'other';
export type MediaFileType = 'image' | 'document' | 'other';

export interface MediaFile {
    id: string;
    filename: string;
    file_path: string;
    file_url: string;
    file_type: MediaFileType;
    mime_type: string;
    size_bytes: number;
    category: MediaCategory;
    description?: string;
    uploaded_by?: string;
    created_at: string;
    updated_at: string;
}

export interface MediaUploadOptions {
    file: File;
    category?: MediaCategory;
    description?: string;
}

export interface MediaFilters {
    category?: MediaCategory;
    file_type?: MediaFileType;
    search?: string;
}

export interface UploadProgress {
    loading: boolean;
    progress: number;
    error?: string;
}
