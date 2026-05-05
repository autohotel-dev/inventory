import os
import requests
import jwt
from jwt.algorithms import RSAAlgorithm
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

COGNITO_JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"

security = HTTPBearer()

class CurrentUser(BaseModel):
    id: str
    email: str
    groups: list[str] = []

def get_cognito_public_keys():
    # En producción esto debe ser cacheado
    if not COGNITO_USER_POOL_ID:
        # Modo desarrollo, sin validación estricta si no hay User Pool configurado
        return {}
    try:
        response = requests.get(COGNITO_JWKS_URL)
        response.raise_for_status()
        return response.json().get("keys", [])
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        return []

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> CurrentUser:
    token = credentials.credentials
    
    if not COGNITO_USER_POOL_ID:
        # MODO DESARROLLO (Si no hay variables de entorno, regresamos un usuario dummy o ignoramos)
        # Esto nos permite probar localmente sin haber levantado Cognito todavía
        return CurrentUser(id="dev-user-id", email="dev@luxor.com", groups=["admin"])

    try:
        # Obtenemos los keys de Cognito
        keys = get_cognito_public_keys()
        
        # Obtenemos el header del token para saber qué key usar
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        
        # Buscamos la public key correspondiente
        key_index = -1
        for i in range(len(keys)):
            if kid == keys[i]["kid"]:
                key_index = i
                break
                
        if key_index == -1:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Public key not found in jwks.json")
            
        public_key = RSAAlgorithm.from_jwk(keys[key_index])
        
        # Validamos el token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
            issuer=f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
        )
        
        return CurrentUser(
            id=payload.get("sub"),
            email=payload.get("email", ""),
            groups=payload.get("cognito:groups", [])
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
