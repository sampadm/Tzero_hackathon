from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import get_settings
from app.routers import auth, assets, extractions, compliance, contracts, deployments

settings = get_settings()

app = FastAPI(title="Tzero BYOA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(extractions.router)
app.include_router(compliance.router)
app.include_router(contracts.router)
app.include_router(deployments.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "tzero-byoa-api"}
