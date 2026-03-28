"use client";

import { useCallback, useRef } from "react";

// Hook para sonidos de feedback usando Web Audio API
export function useSoundFeedback() {
    const audioContextRef = useRef<AudioContext | null>(null);

    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            // @ts-expect-error - Soporte para prefijo webkit
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    const playSuccess = useCallback(() => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
        } catch {
            // Silently fail if audio is not available
        }
    }, [getAudioContext]);

    const playError = useCallback(() => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);

            gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.25);
        } catch {
            // Silently fail if audio is not available
        }
    }, [getAudioContext]);

    const playClick = useCallback(() => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, ctx.currentTime);

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.05);
        } catch {
            // Silently fail if audio is not available
        }
    }, [getAudioContext]);

    const playVictory = useCallback(() => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            // Arpeggio Major Chord (C5, E5, G5, C6)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            const now = ctx.currentTime;

            notes.forEach((freq, i) => {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.type = 'triangle';
                oscillator.frequency.value = freq;

                gainNode.gain.setValueAtTime(0.2, now + (i * 0.1));
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.1) + 0.4);

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.start(now + (i * 0.1));
                oscillator.stop(now + (i * 0.1) + 0.4);
            });
        } catch {
            // Silently fail
        }
    }, [getAudioContext]);

    return { playSuccess, playError, playClick, playVictory };
}
