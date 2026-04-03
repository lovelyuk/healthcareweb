from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse

# REALSENSE_DEPENDENCY: RealSense 카메라 상태 및 프레임 사용
# - get_camera_status() → has_depth_frame 포함
# - get_latest_frame_snapshot() → (color, depth) 반환
from core.camera_manager import (
    ensure_capture_thread,
    get_camera_status,  # REALSENSE_DEPENDENCY: RealSense 상태 확인
    get_latest_frame_snapshot,  # REALSENSE_DEPENDENCY: RealSense frame
)
from core.pose_engine import extract_pose_landmarks
from core.mesh_manager import (
    DEFAULT_DEPTH_WINDOW_M,
    DEFAULT_TARGET_DISTANCE_M,
    DEFAULT_VOXEL_SIZE_M,
    MESH_DIR,
    add_frame_to_session,
    build_preview_payload,
    create_point_cloud_from_arrays,
    get_session_status,
    list_mesh_sessions,
    start_mesh_capture,
    stop_mesh_capture,
)


logger = logging.getLogger("mesh_routes")

router = APIRouter(prefix="/api/mesh", tags=["mesh"])


# REALSENSE_REMOVE_CANDIDATE: 3D Mesh 캡처 API (RealSense depth 필수)
# - depth frame 없는 웹캡에서는 동작 불가
# - Option A: 완전 비활성화 Option B: RGB-only point cloud로 축소
@router.post("/start")
def mesh_start(
    target_distance_m: float = Query(DEFAULT_TARGET_DISTANCE_M, ge=0.8, le=3.0),
    depth_window_m: float = Query(DEFAULT_DEPTH_WINDOW_M, ge=0.25, le=1.5),
    voxel_size_m: float = Query(DEFAULT_VOXEL_SIZE_M, ge=0.004, le=0.03),
    frame_stride: int = Query(2, ge=1, le=10),
    max_points_per_frame: int = Query(40000, ge=5000, le=120000),
    bodycheck_data: Optional[Dict[str, Any]] = Body(None),
) -> Dict[str, Any]:
    logger.info("POST /api/mesh/start called")

    # REALSENSE_DEPENDENCY: RealSense 카메라 상태 확인
    status = get_camera_status()
    if not status.get("capture_running", False):
        ensure_capture_thread()
        time.sleep(0.5)

    waited = 0.0
    while waited < 5.0:
        status = get_camera_status()
        # REALSENSE_REMOVE_CANDIDATE: has_depth_frame 체크 → 웹캡에서는 제거/변경 필요
        if status.get("has_color_frame") and status.get("has_depth_frame"):
            break
        time.sleep(0.2)
        waited += 0.2
    else:
        logger.error("Timeout waiting for camera frames. Final status: %s", status)
        return {
            "ok": False,
            "error": "Camera frames not available. Check the RealSense connection.",  # REALSENSE_REMOVE_CANDIDATE: RealSense 에러 메시지
            "status": status,
        }

    status = get_camera_status()
    # REALSENSE_REMOVE_CANDIDATE: depth frame 요구 → 웹캡에서는 제거
    if not status.get("has_color_frame") or not status.get("has_depth_frame"):
        return {
            "ok": False,
            "error": "Camera initialized but frames are still unavailable.",  # REALSENSE_REMOVE_CANDIDATE
            "status": status,
        }

    return start_mesh_capture(
        target_distance_m=target_distance_m,
        depth_window_m=depth_window_m,
        voxel_size_m=voxel_size_m,
        frame_stride=frame_stride,
        max_points_per_frame=max_points_per_frame,
        bodycheck_data=bodycheck_data,
    )


def _session_file_urls(session_id: str) -> Dict[str, str]:
    session_path = MESH_DIR / session_id
    files: Dict[str, str] = {}
    if not session_path.exists():
        return files

    for file in session_path.glob("*"):
        files[file.name] = f"/frames/mesh/{session_id}/{file.name}"
    return files


# REALSENSE_REMOVE_CANDIDATE: depth frame 필요 → 웹캡에서는 동작 불가
@router.post("/frame")
def mesh_frame(
    session_id: str = Query(...),
    include_preview: bool = Query(False),
    preview_max_points: int = Query(2500, ge=200, le=8000),
) -> Dict[str, Any]:
    logger.info("POST /api/mesh/frame called with session_id=%s", session_id)
    ensure_capture_thread()

    status = get_session_status(session_id)
    if not status.get("ok"):
        return status

    # REALSENSE_DEPENDENCY: RealSense depth frame 필요
    color_image, depth_image = get_latest_frame_snapshot()
    if color_image is None or depth_image is None:  # REALSENSE_REMOVE_CANDIDATE: depth None 체크
        return {"ok": False, "error": "No frame available"}

    cfg = status["status"]
    try:
        _, landmarks = extract_pose_landmarks(color_image)
        points, colors = create_point_cloud_from_arrays(
            color_image=color_image,
            depth_image=depth_image,
            target_distance_m=cfg.get("target_distance_m", DEFAULT_TARGET_DISTANCE_M),
            depth_window_m=cfg.get("depth_window_m", DEFAULT_DEPTH_WINDOW_M),
            landmarks=landmarks,
        )
    except Exception as exc:
        logger.exception("Failed to create point cloud")
        return {"ok": False, "error": f"Point cloud creation failed: {exc}"}

    result = add_frame_to_session(session_id, points, colors)
    if include_preview and result.get("ok"):
        result["preview"] = build_preview_payload(
            points=points,
            colors=colors,
            max_points=preview_max_points,
        )
    return result


@router.post("/stop")
def mesh_stop(session_id: str = Query(...)) -> Dict[str, Any]:
    logger.info("POST /api/mesh/stop called with session_id=%s", session_id)
    result = stop_mesh_capture(session_id)
    if result.get("ok"):
        result["files"] = _session_file_urls(session_id)
        # Depth 정보 포함한 diagnostics 추가
        if result.get("diagnostics"):
            result["diagnostics"]["depth_available"] = True
            result["diagnostics"]["source"] = "bodycheck_integration"
    else:
        result["files"] = _session_file_urls(session_id)
        result["diagnostics"] = {"error": "Mesh generation failed", "source": "bodycheck_integration"}
    return result


@router.get("/status")
def mesh_status(session_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    logger.info("GET /api/mesh/status called with session_id=%s", session_id)
    if session_id:
        return get_session_status(session_id)
    return {"ok": True, "sessions": list_mesh_sessions()}


@router.get("/files/{session_id}")
def mesh_files(session_id: str) -> Dict[str, Any]:
    logger.info("GET /api/mesh/files/%s called", session_id)

    session_path = MESH_DIR / session_id
    if not session_path.exists():
        return {"ok": False, "error": "Session files not found"}

    return {
        "ok": True,
        "session_id": session_id,
        "files": _session_file_urls(session_id),
    }


@router.get("/download/{session_id}/{filename}")
def mesh_download(session_id: str, filename: str) -> FileResponse:
    logger.info("GET /api/mesh/download/%s/%s called", session_id, filename)

    file_path = MESH_DIR / session_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )


# REALSENSE_REMOVE_CANDIDATE: depth frame 필요 → 웹캡에서는 동작 불가
@router.post("/capture")
def mesh_capture() -> Dict[str, Any]:
    logger.info("POST /api/mesh/capture called")
    ensure_capture_thread()

    # REALSENSE_DEPENDENCY: RealSense depth frame 필요
    color_image, depth_image = get_latest_frame_snapshot()
    if color_image is None or depth_image is None:  # REALSENSE_REMOVE_CANDIDATE: depth None 체크
        return {"ok": False, "error": "No frame available"}

    try:
        _, landmarks = extract_pose_landmarks(color_image)
        points, colors = create_point_cloud_from_arrays(
            color_image,
            depth_image,
            landmarks=landmarks,
        )
    except Exception as exc:
        logger.exception("Failed to create point cloud")
        return {"ok": False, "error": f"Point cloud creation failed: {exc}"}

    return {
        "ok": True,
        "point_count": len(points),
        "points_shape": list(points.shape),
        "colors_shape": list(colors.shape),
    }
