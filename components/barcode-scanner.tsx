"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Scan } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [codeReader] = useState(() => new BrowserMultiFormatReader());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    initializeScanner();
    return () => {
      stopScanning();
    };
  }, []);

  const initializeScanner = async () => {
    try {
      setError("");
      
      // Obtener dispositivos de video disponibles
      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setError("No se encontraron cámaras disponibles.");
        return;
      }

      // Preferir cámara trasera si está disponible
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      const deviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;
      setSelectedDeviceId(deviceId);
      
      await startScanning(deviceId);
    } catch (err) {
      setError("Error al inicializar el escáner. Verifica los permisos de cámara.");
      console.error("Error initializing scanner:", err);
    }
  };

  const startScanning = async (deviceId: string) => {
    try {
      if (!videoRef.current) return;

      setIsScanning(true);
      
      await codeReader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const code = result.getText();
            onScan(code);
            stopScanning();
            onClose();
          }
          
          if (error && !(error instanceof NotFoundException)) {
            console.error("Scanning error:", error);
          }
        }
      );
    } catch (err) {
      setError("Error al acceder a la cámara. Verifica los permisos.");
      console.error("Error starting scan:", err);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    try {
      codeReader.reset();
      setIsScanning(false);
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  };

  const handleManualInput = () => {
    const code = prompt("Ingresa el código de barras manualmente:");
    if (code && code.trim()) {
      onScan(code.trim());
      stopScanning();
      onClose();
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Escanear Código de Barras</h3>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="relative mb-4">
          <video
            ref={videoRef}
            className="w-full h-64 bg-gray-100 rounded object-cover"
            playsInline
            muted
          />
          
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-red-500 w-48 h-32 rounded-lg">
                <div className="w-full h-full border border-red-300 rounded-lg animate-pulse" />
              </div>
            </div>
          )}

          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
              <div className="text-center">
                <Scan className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Iniciando cámara...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleManualInput}
            className="flex-1"
          >
            Ingresar Manual
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          {isScanning 
            ? "Apunta la cámara hacia el código de barras. Se detectará automáticamente."
            : "Configurando escáner..."
          }
        </p>
      </div>
    </div>
  );
}
