from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, orders, public


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Ecommerce API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(public.router)
    app.include_router(orders.router)
    app.include_router(admin.router)
    return app


app = create_app()
