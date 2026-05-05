import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI(title="Luxor API", version="1.0.0")

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a Luxor Backend API (FastAPI + Serverless)"}

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": os.getenv("STAGE", "dev")}

# Este es el handler que invoca AWS Lambda
handler = Mangum(app)
