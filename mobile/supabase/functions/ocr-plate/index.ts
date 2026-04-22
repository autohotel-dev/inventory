// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

serve(async (req) => {
    // CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    try {
        if (!GEMINI_API_KEY) {
            return new Response(
                JSON.stringify({ error: "GEMINI_API_KEY no configurada" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const { image } = await req.json();

        if (!image) {
            return new Response(
                JSON.stringify({ error: "No se recibió imagen" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Limpiar base64 (quitar prefijo data:image/... si existe)
        const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

        console.log("🔍 [OCR] Procesando imagen para placa y vehículo...");

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Eres un sistema OCR especializado en placas vehiculares mexicanas.

TAREA PRINCIPAL: Lee con precisión el número de placa del vehículo en esta imagen.

CÓMO LEER LA PLACA:
1. Localiza la placa metálica rectangular del vehículo
2. Lee cada carácter de IZQUIERDA a DERECHA, uno por uno
3. Las placas mexicanas tienen estos formatos comunes:
   - 3 letras + guión + 2 números + guión + 2 números (ej: UKF-69-04)
   - 3 letras + guión + 3 o 4 números (ej: ABC-1234)
   - 2 letras + guión + 3 números + guión + 1 letra (ej: AB-123-C)
4. TOTAL: Generalmente 6 a 7 caracteres alfanuméricos

CARACTERES QUE SE CONFUNDEN - ten cuidado:
- 0 (cero) vs O (letra O)
- 1 (uno) vs I (letra I) vs L (letra L)
- 6 (seis) vs G
- 8 (ocho) vs B
- 5 (cinco) vs S
- F vs E vs P
- K vs X

TAMBIÉN DETECTA (si el vehículo es visible):
- MARCA: Logo o insignia del fabricante (Nissan, Toyota, VW, Chevrolet, Ford, Honda, Kia, Hyundai, etc.)
- MODELO: Nombre del modelo visible en el vehículo

REGLAS:
- Ignora texto como "QUERÉTARO", "MÉXICO", "TRANSPORTE PRIVADO", años, stickers
- La placa son los caracteres GRANDES y prominentes
- Devuelve la placa SIN guiones ni espacios, en MAYÚSCULAS
- Si no puedes leer algo, usa "UNKNOWN"

RESPONDE SOLO con este JSON (sin markdown, sin explicación):
{"plate":"UKF6904","brand":"Nissan","model":"Versa"}`
                            },
                            {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: cleanBase64,
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 256,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            plate: { type: "STRING" },
                            brand: { type: "STRING" },
                            model: { type: "STRING" }
                        },
                        required: ["plate", "brand", "model"]
                    }
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("🔍 [OCR] Gemini API error:", errorText);
            return new Response(
                JSON.stringify({ error: "Error en Gemini API", details: errorText }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const geminiData = await geminiResponse.json();

        // Gemini 2.5 Flash devuelve múltiples parts:
        // - parts con thought:true → pensamientos internos del modelo (ignorar)
        // - parts sin thought → la respuesta real con el JSON
        const allParts = geminiData?.candidates?.[0]?.content?.parts || [];
        let rawText = "";
        
        // Buscar el part que NO es thought y contiene la respuesta
        for (const part of allParts) {
            if (part.thought) continue; // Ignorar pensamientos
            if (part.text) {
                rawText = part.text.trim();
            }
        }
        
        // Si no encontramos nada sin thought, usar el último part como fallback
        if (!rawText && allParts.length > 0) {
            const lastPart = allParts[allParts.length - 1];
            rawText = lastPart?.text?.trim() || "";
        }

        // Log detallado de cada part
        for (let i = 0; i < allParts.length; i++) {
            const p = allParts[i];
            console.log(`🔍 [OCR] Part[${i}] thought=${!!p.thought} text=${(p.text || '').substring(0, 100)}`);
        }
        console.log("🔍 [OCR] rawText final:", rawText);

        // Intentar parsear como JSON
        let plate = null;
        let brand = null;
        let model = null;

        try {
            // Extraer solo la parte del JSON entre llaves para evitar errores de parseo por texto adicional
            let jsonString = rawText;
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                jsonString = rawText.substring(firstBrace, lastBrace + 1);
            } else {
                // Fallback a limpiar markdown
                jsonString = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            }
            
            const parsed = JSON.parse(jsonString);
            
            // Extraer placa
            if (parsed.plate && parsed.plate !== "UNKNOWN") {
                plate = parsed.plate
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .trim();
                if (plate.length < 3 || plate.length > 10 || plate === "NOPLATE" || plate === "UNKNOWN") {
                    plate = null;
                }
            }

            // Extraer marca
            if (parsed.brand && parsed.brand !== "UNKNOWN") {
                brand = parsed.brand.trim();
            }

            // Extraer modelo
            if (parsed.model && parsed.model !== "UNKNOWN") {
                model = parsed.model.trim();
            }
        } catch (parseErr) {
            console.log("🔍 [OCR] No se pudo parsear JSON, intentando extraer placa del texto:", rawText);
            // Intento desesperado: buscar algo que parezca una placa (ej: UMV-412-C o UMV412C)
            const plateRegex = /[A-Z]{2,3}-?\d{2,4}-?[A-Z]?/;
            const match = rawText.toUpperCase().match(plateRegex);
            if (match) {
                const cleanedPlate = match[0].replace(/[^A-Z0-9]/g, "");
                if (cleanedPlate.length >= 3 && cleanedPlate.length <= 10) {
                    plate = cleanedPlate;
                }
            }
        }

        const hasAnyData = plate || brand || model;

        if (!hasAnyData) {
            console.log("🔍 [OCR] No se detectó información del vehículo");
            return new Response(
                JSON.stringify({ plate: null, brand: null, model: null, raw: rawText, message: "No se pudo detectar información del vehículo" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`🔍 [OCR] Detectado → Placa: ${plate}, Marca: ${brand}, Modelo: ${model}`);

        return new Response(
            JSON.stringify({ plate, brand, model, raw: rawText }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("🔍 [OCR] Exception:", error);
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
