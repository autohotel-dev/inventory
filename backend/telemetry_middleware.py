import time
import json
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime

from database import SessionLocal
from models.system import SystemTelemetry

logger = logging.getLogger("telemetry")

class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Procesar petición
        try:
            response = await call_next(request)
            is_success = 200 <= response.status_code < 400
            error_details = None
            if not is_success:
                error_details = {"status_code": response.status_code}
        except Exception as exc:
            # Log the real error for debugging
            logger.error(f"[TelemetryMiddleware] UNHANDLED EXCEPTION on {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
            import traceback
            traceback.print_exc()
            # Must return a Response (not raise) so CORS headers are applied by outer middleware
            response = JSONResponse(
                status_code=500,
                content={"detail": f"{type(exc).__name__}: {str(exc)}"}
            )
            is_success = False
            error_details = {"exception": str(exc), "type": type(exc).__name__}

        duration_ms = int((time.time() - start_time) * 1000)

        # Tratar de obtener al usuario autenticado
        user_id = None
        if hasattr(request.state, "user"):
            user_id = getattr(request.state.user, "id", None)

        # Loggear telemetría en background/db
        try:
            db: Session = SessionLocal()
            try:
                telemetry = SystemTelemetry(
                    user_id=user_id,
                    module=request.url.path.split("/")[1] if len(request.url.path.split("/")) > 1 else "root",
                    page=None,
                    action_type='API_REQUEST',
                    action_name=request.method,
                    duration_ms=duration_ms,
                    endpoint=request.url.path,
                    is_success=is_success,
                    error_details=error_details,
                    payload={},
                    created_at=datetime.utcnow()
                )
                db.add(telemetry)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception:
            pass

        return response

