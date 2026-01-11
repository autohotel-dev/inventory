"use client";

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTraining } from '@/contexts/training-context';

export function TourAutoStart() {
    const searchParams = useSearchParams();
    const { startModule } = useTraining();

    useEffect(() => {
        const tourId = searchParams.get('startTour');
        if (tourId) {
            // Wait a bit for page to fully render
            setTimeout(() => {
                startModule(tourId, 'interactive');

                // Special handling for room-checkin tour: auto-open action wheel
                if (tourId === 'room-checkin') {
                    // Wait for tour to initialize, then click first room card
                    setTimeout(() => {
                        const firstRoomCard = document.querySelector('#tour-room-card');
                        if (firstRoomCard) {
                            (firstRoomCard as HTMLElement).click();
                        }
                    }, 1000);
                }
            }, 300);
        }
    }, [searchParams, startModule]);

    return null;
}
