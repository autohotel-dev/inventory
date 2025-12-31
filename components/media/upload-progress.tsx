"use client";

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface UploadProgressProps {
    progress: number;
    fileName: string;
}

export function UploadProgress({ progress, fileName }: UploadProgressProps) {
    return (
        <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                    <p className="text-sm font-medium">Subiendo archivo...</p>
                    <p className="text-xs text-muted-foreground truncate">{fileName}</p>
                </div>
                <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
        </div>
    );
}
