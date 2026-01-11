"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTraining } from '@/contexts/training-context';

export function TourAutoStart() {
    const searchParams = useSearchParams();
    const { startModule, stopTraining, isTrainingActive } = useTraining();
    const hasStartedRef = useRef<string | null>(null);

    useEffect(() => {
        const tourId = searchParams.get('startTour');
        
        // Only start if we have a tourId and haven't already started this tour
        if (tourId && hasStartedRef.current !== tourId) {
            hasStartedRef.current = tourId;
            
            // Stop any existing training first
            if (isTrainingActive) {
                stopTraining();
            }
            
            // Wait a bit for page to fully render
            setTimeout(() => {
                startModule(tourId, 'interactive');

                // Special handling for tours that need auto-open action wheel
                if (tourId === 'room-checkin' || tourId === 'room-status') {
                    // Wait for tour to initialize, then click first free room to open action wheel
                    setTimeout(() => {
                        // Find first room with status LIBRE
                        const roomCard = document.querySelector('[data-room-status="LIBRE"]');
                        
                        if (roomCard) {
                            (roomCard as HTMLElement).click();
                        }
                    }, 1000);
                }
            }, 300);
        }
        
        // Reset when tourId is removed from URL
        if (!tourId) {
            hasStartedRef.current = null;
        }
    }, [searchParams, startModule, stopTraining, isTrainingActive]);

    return null;
}
