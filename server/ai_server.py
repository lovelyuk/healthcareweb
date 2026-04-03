from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.body_summary_routes import router as body_summary_router

app = FastAPI(title="BodyCheck AI Summary Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://healthcare-web-seven.vercel.app",
        "https://healthcare-lab2.vercel.app",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5000",
        "http://localhost:5000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기존 /api/body/summary 라우터만 유지
app.include_router(body_summary_router)


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "BodyCheck AI summary server running",
        "endpoints": [
            "/health",
            "/api/body/summary",
        ],
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "body-summary",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000,
        reload=False,
        log_config=None,
        access_log=False,
    )