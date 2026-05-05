import os
import re
import json
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from schemas.services import OCRRequest, OCRResponse
from auth_utils import get_current_user

router = APIRouter(
    prefix="/services",
    tags=["Services"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/ocr-plate", response_model=OCRResponse)
def process_ocr_plate(request: OCRRequest):
    image_base64 = request.image

    if not image_base64:
        raise HTTPException(status_code=400, detail="No se recibió imagen")

    # Limpiar base64
    clean_base64 = re.sub(r"^data:image\/\w+;base64,", "", image_base64)

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": '''Eres un sistema OCR especializado en placas vehiculares mexicanas.

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
{"plate":"UKF6904","brand":"Nissan","model":"Versa"}'''
                    },
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": clean_base64,
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "plate": { "type": "STRING" },
                    "brand": { "type": "STRING" },
                    "model": { "type": "STRING" }
                },
                "required": ["plate", "brand", "model"]
            }
        }
    }

    try:
        response = requests.post(gemini_url, json=payload)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        error_text = response.text if response else str(e)
        raise HTTPException(status_code=500, detail=f"Error en Gemini API: {error_text}")

    gemini_data = response.json()
    all_parts = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    
    raw_text = ""
    for part in all_parts:
        # Ignore thought process
        if part.get("thought"):
            continue
        if part.get("text"):
            raw_text = part["text"].strip()
            
    if not raw_text and all_parts:
        raw_text = all_parts[-1].get("text", "").strip()

    plate, brand, model = None, None, None

    try:
        # Extract JSON block
        first_brace = raw_text.find('{')
        last_brace = raw_text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace >= first_brace:
            json_string = raw_text[first_brace:last_brace+1]
        else:
            json_string = re.sub(r"```json\s*", "", raw_text)
            json_string = re.sub(r"```\s*", "", json_string).strip()

        parsed = json.loads(json_string)

        if parsed.get("plate") and parsed["plate"] != "UNKNOWN":
            p = re.sub(r"[^A-Z0-9]", "", parsed["plate"].upper()).strip()
            if 3 <= len(p) <= 10 and p != "NOPLATE":
                plate = p

        if parsed.get("brand") and parsed["brand"] != "UNKNOWN":
            brand = parsed["brand"].strip()

        if parsed.get("model") and parsed["model"] != "UNKNOWN":
            model = parsed["model"].strip()

    except json.JSONDecodeError:
        # Fallback regex
        plate_regex = r"[A-Z]{2,3}-?\d{2,4}-?[A-Z]?"
        match = re.search(plate_regex, raw_text.upper())
        if match:
            cleaned_plate = re.sub(r"[^A-Z0-9]", "", match.group(0))
            if 3 <= len(cleaned_plate) <= 10:
                plate = cleaned_plate

    if not plate and not brand and not model:
        return OCRResponse(plate=None, brand=None, model=None, raw=raw_text, message="No se pudo detectar información del vehículo")

    return OCRResponse(plate=plate, brand=brand, model=model, raw=raw_text)

from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from schemas.services import PushNotificationRequest, PushNotificationResponse

@router.post("/push", response_model=PushNotificationResponse)
def send_push_notification(request: PushNotificationRequest, db: Session = Depends(get_db)):
    """
    Envía notificaciones push usando Expo Push API.
    Puede dirigirse a un user_id específico o hacer broadcast a un rol.
    """
    tokens = []

    if request.user_id:
        # Buscar token del usuario específico
        result = db.execute(
            text("SELECT push_token FROM employees WHERE auth_user_id = :user_id AND push_token IS NOT NULL"),
            {"user_id": request.user_id}
        ).fetchone()
        if result and result.push_token:
            tokens.append(result.push_token)
    elif request.role:
        # Broadcast a todos los empleados activos del rol
        results = db.execute(
            text("SELECT push_token FROM employees WHERE role = :role AND is_active = true AND push_token IS NOT NULL"),
            {"role": request.role}
        ).fetchall()
        tokens = [row.push_token for row in results if row.push_token]

    if not tokens:
        return PushNotificationResponse(success=True, sent=0, result={"message": "No tokens found"})

    messages = []
    for token in tokens:
        messages.append({
            "to": token,
            "sound": "default",
            "title": request.title,
            "body": request.body,
            "data": request.data or {},
            "priority": "high",
            "channelId": "default"
        })

    try:
        expo_response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Content-Type": "application/json"}
        )
        expo_response.raise_for_status()
        expo_result = expo_response.json()
        return PushNotificationResponse(success=True, sent=len(tokens), result=expo_result)
    except requests.exceptions.RequestException as e:
        error_text = expo_response.text if 'expo_response' in locals() and expo_response else str(e)
        raise HTTPException(status_code=500, detail=f"Error Expo API: {error_text}")

