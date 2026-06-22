// Allow importing .tflite model files as assets
declare module '*.tflite' {
    const value: number; // Expo asset ID
    export default value;
}
