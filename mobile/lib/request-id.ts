/**
 * Id único por intento de cobro: se manda a la base para que un doble toque o un reintento
 * tras un error de red no cobre dos veces. (El APK instalado no trae expo-crypto.)
 */
export function newRequestId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
