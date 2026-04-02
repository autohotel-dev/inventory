/**
 * Utility for conditional class names in NativeWind/Tailwind.
 */
export function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
