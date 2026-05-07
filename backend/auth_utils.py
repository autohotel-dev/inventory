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

# Cache for JWKS keys - pre-seeded with known keys to avoid network issues
_jwks_cache: list = [
    {"alg":"RS256","e":"AQAB","kid":"TLMD/dCsK+hhLrgaL+wT5r17fYKnLv0EagWHk72YC2I=","kty":"RSA","n":"vAQkVpGYA-QFNrePX9Vb_Ef_5fBqll_9VHhdVZ6SE6qeesnTmpu1WCI0J79JAnYATP-0jrIcQ0k6YEqHqQ-1AF4XmGLO_NgkBtYjaG1rE49KI7e2AymM95Z87IEOLo8SNnqZytV3HmfVBnHE9XhLUfTnna_kfBB2bXLJJ4BjxpWFL1xPfQW5KE1l15SZnKKfrbkO-FzFF3iXOo1IP-WAY_buK-f6QLOiWLuJK6tQ_WON5iJ33qKabmgRb1w2ELHhXOuGZ5dxbO0iF2V-yCNWjYfZV5Mb05yGMRw8J7PGO5gOdUElI2NcMcw-w6kgWkIJ8nVOPpRTHIZUVPSml2nMRw","use":"sig"},
    {"alg":"RS256","e":"AQAB","kid":"/6Di/PnisDi6l7bXpiOQIiA5qsf9WlW/AuD8bfnxBpw=","kty":"RSA","n":"xhue465AIpWlK-ZQL8vIgw3U4xdNMO5ANbfaDTdpV4DoXnBnD_L1B-C2CrtDC-OefTijxeiOPX3PQeBFXJr2yFOIVoPenExHiIXdxq6B0KOpPdIhap_CLlZWx_NPKqHf3stvslWYdR_jhXEM8kgKZ-xx9Nie4Rd4ZBMDWNYaqMt75yjuP7sNAhGU8o0b8aVWz-zcjQkxNA45Zh3V63eeFfd4MFQTsnv_i_HocDi1sW3YqgIw1TfSUhllf9aGeLjTohAWmOVdZRrsNRsJD4PBZJQ9m0wI9N1YSoyQ-jygryykaM4bmT0PJVzEpnXJ33B8TqcPPP_KxUUecQQMAtrRZw","use":"sig"}
]

def get_cognito_public_keys():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    if not COGNITO_USER_POOL_ID:
        return []
    try:
        response = requests.get(COGNITO_JWKS_URL, timeout=10)
        response.raise_for_status()
        keys = response.json().get("keys", [])
        if keys:
            _jwks_cache = keys
        return keys
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        return []

def verify_token(token: str) -> CurrentUser:
    if not COGNITO_USER_POOL_ID:
        # Fallback a Supabase JWT si Cognito no está configurado
        supabase_secret = os.getenv("SUPABASE_JWT_SECRET")
        if supabase_secret:
            try:
                payload = jwt.decode(token, supabase_secret, algorithms=["HS256"], audience="authenticated")
                return CurrentUser(
                    id=payload.get("sub"),
                    email=payload.get("email", ""),
                    groups=[payload.get("role", "")]
                )
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Supabase token: {str(e)}")
        
        # MODO DESARROLLO (Si no hay variables de entorno, regresamos un usuario dummy)
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
        # Cognito access tokens don't have 'aud', they have 'client_id'.
        # So we skip audience validation in jwt.decode and check manually.
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}",
            options={"verify_aud": False}
        )
        
        # Verify client_id for access tokens or aud for id tokens
        token_client_id = payload.get("client_id") or payload.get("aud")
        if COGNITO_CLIENT_ID and token_client_id != COGNITO_CLIENT_ID:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token client_id mismatch")
        
        # Access tokens have 'username', ID tokens have 'email'
        email = payload.get("email", payload.get("username", ""))
        
        return CurrentUser(
            id=payload.get("sub"),
            email=email,
            groups=payload.get("cognito:groups", [])
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> CurrentUser:
    token = credentials.credentials
    return verify_token(token)

