from __future__ import annotations

import sys
import time
from pathlib import Path

import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles


def get_runtime_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent

        internal_dir = exe_dir / "_internal"
        if internal_dir.exists():
            return internal_dir

        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(meipass)

        return exe_dir

    return Path(__file__).resolve().parent.parent


SERVER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = get_runtime_base_dir()

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

# REALSENSE_DEPENDENCY: camera_manager import
# - ensure_capture_thread() → RealSense 캡처 스레드 시작 (웹캡 초기화로 대체 필요)
# - get_camera_status() → RealSense 상태 포함 (웹캡 모드适配 필요)
from core.camera_manager import (
    ensure_capture_thread,
    stop_capture_thread,
    get_camera_calibration,
    get_camera_status,
    get_latest_frame_snapshot,
)
import core.pose_engine as pose_engine
from core.storage_manager import APP_DATA_DIR, FRAMES_DIR
from routes.body_routes import router as body_router
from routes.body_summary_routes import router as body_summary_router
from routes.rom_routes import router as rom_router
from routes.movement_routes import router as movement_router
from routes.history_routes import router as history_router
from routes.mesh_routes import router as mesh_router
from core.supabase_client import get_supabase

UI_DIR = PROJECT_ROOT / "ui"

app = FastAPI(title="BodyCheck Scanner Server")

# LOCAL_SERVER_DEPENDENCY: CORS allow_origins에 localhost 하드코딩
# - Vercel 배포 시 별도 도메인으로 교체 필요
# - localhost 항목: 개발 환경용 (프론트엔드가 같은 서버 호출 시)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://healthcare-web-seven.vercel.app",
        "https://healthcare-lab2.vercel.app",
        "http://127.0.0.1:5000",     # LOCAL_SERVER_DEPENDENCY: 로컬 개발 서버
        "http://localhost:5000",    # LOCAL_SERVER_DEPENDENCY: 로컬 개발 서버
        "http://127.0.0.1:5500",    # LOCAL_SERVER_DEPENDENCY: 로컬 개발 서버
        "http://localhost:5500",     # LOCAL_SERVER_DEPENDENCY: 로컬 개발 서버
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/frames", StaticFiles(directory=str(FRAMES_DIR)), name="frames")
if UI_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(UI_DIR)), name="ui")


@app.get("/settings.js")
def get_settings_js():
    return FileResponse(str(PROJECT_ROOT / "settings.js"))


@app.get("/dashboard.js")
def get_dashboard_js():
    return FileResponse(str(PROJECT_ROOT / "dashboard.js"))


@app.get("/dashboard.html")
def get_dashboard_html():
    return FileResponse(str(PROJECT_ROOT / "dashboard.html"))


@app.get("/logo.svg")
def get_logo():
    return FileResponse(str(PROJECT_ROOT / "logo.svg"))


app.include_router(body_router)
app.include_router(body_summary_router)
app.include_router(rom_router)
app.include_router(movement_router)
app.include_router(history_router)
app.include_router(mesh_router)


# REALSENSE_DEPENDENCY: startup 시 RealSense 캡처 스레드 시작
# - 웹캡 초기화로 대체 필요
@app.on_event("startup")
def on_startup():
    ensure_capture_thread()  # REALSENSE_DEPENDENCY: RealSense 캡처 스레드 시작
    pose_engine.init_pose_landmarker()

    print("[DEBUG] scanner_server file =", __file__)
    print("[DEBUG] cwd =", Path.cwd())
    print("[DEBUG] python executable =", sys.executable)

    try:
        supabase = get_supabase()
        print("[Supabase] connected:", supabase is not None)
    except Exception as e:
        print("[Supabase] connection failed:", e)


@app.on_event("shutdown")
def on_shutdown():
    stop_capture_thread()


@app.get("/")
def root():
    index_path = UI_DIR / "health-check.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {
        "ok": True,
        "message": "BodyCheck server running",
        "ui_dir": str(UI_DIR),
        "ui_exists": UI_DIR.exists(),
    }


# LOCAL_SERVER_DEPENDENCY: health check 엔드포인트
# - camera_status에 RealSense 상태 포함 (pipeline_initialized, has_depth_frame 등)
# - 프론트엔드 디버그/상태 표시용으로 활용 중
@app.get("/health")
def health():
    camera_status = get_camera_status()  # REALSENSE_DEPENDENCY: RealSense 상태 포함
    return {
        "ok": True,
        **camera_status,
        "camera_calibration": get_camera_calibration(),
        "mediapipe_available": pose_engine.MEDIAPIPE_AVAILABLE,
        "mediapipe_error": pose_engine.MEDIAPIPE_ERROR,
        "pose_task_path": pose_engine.find_pose_task_file(),
        "app_data_dir": str(APP_DATA_DIR),
        "base_dir": str(PROJECT_ROOT),
        "ui_dir": str(UI_DIR),
        "ui_exists": UI_DIR.exists(),
    }


@app.get("/api/debug/frame")
def debug_frame():
    return {
        "ok": True,
        "camera": get_camera_status(),
    }


# LOCAL_SERVER_DEPENDENCY: video_feed 스트림 엔드포인트
# - RealSense → 웹캡 MJPEG 스트림으로 대체 필요
# - 프론트엔드 ui/health-check.js에서 photoEl.src = `${API_BASE}/video_feed`로 호출
@app.get("/video_feed")
def video_feed():
    def generate():
        ensure_capture_thread()  # REALSENSE_DEPENDENCY: RealSense 캡처 스레드 시작
        while True:
            color, _ = get_latest_frame_snapshot()  # REALSENSE_DEPENDENCY: RealSense frame 가져오기
            if color is None:
                time.sleep(0.03)
                continue

            ok, buffer = cv2.imencode(".jpg", color)
            if not ok:
                time.sleep(0.03)
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Cache-Control: no-cache, no-store, must-revalidate\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )
            time.sleep(0.03)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


# LOCAL_SERVER_DEPENDENCY: 개발용 로컬 서버 실행 ( Production에서는 uvicorn 직접 실행)
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",  # LOCAL_SERVER_DEPENDENCY: 로컬호스트 바인딩 (환경 변수로 교체 권장)
        port=5000,
        reload=False,
        log_config=None,
        access_log=False,
    )
