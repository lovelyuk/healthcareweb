from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import numpy as np

# REALSENSE_REMOVE_CANDIDATE: RealSense SDK Python bindings
# - 제거 시 camera_manager.py 웹캠 모듈로 전면 재작성 필요
# - 현재 파일은 OpenCV 웹캡으로 대체될 예정
try:
    import pyrealsense2 as rs  # type: ignore
except Exception:
    rs = None


# REALSENSE_REMOVE_CANDIDATE: RealSense pipeline 전역 상태
# - RS_PIPELINE, RS_ALIGN, RS_DEVICE, DEPTH_SCALE → 웹캡 초기화로 대체
RS_PIPELINE = None
RS_ALIGN = None
RS_DEVICE = None
DEPTH_SCALE = None

# REALSENSE_DEPENDENCY: 프레임 버퍼 (RealSense depth frame 포함)
# - LATEST_COLOR_FRAME → 웹캡 color frame으로 대체 가능
# - LATEST_DEPTH_FRAME → 웹캡에서는 None, depth 불필요 로직으로 우회 필요
# - LATEST_CALIBRATION → 웹캡 intrinsic 기본값으로 대체 가능
FRAME_LOCK = threading.Lock()
LATEST_COLOR_FRAME = None
LATEST_DEPTH_FRAME = None
LATEST_CALIBRATION = None

CAPTURE_THREAD = None
CAPTURE_RUNNING = False


@dataclass
class CameraIntrinsics:
    width: int
    height: int
    fx: float
    fy: float
    ppx: float
    ppy: float
    model: str
    coeffs: tuple[float, ...]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "fx": self.fx,
            "fy": self.fy,
            "ppx": self.ppx,
            "ppy": self.ppy,
            "model": self.model,
            "coeffs": list(self.coeffs),
        }


@dataclass
class CameraExtrinsics:
    rotation: tuple[float, ...]
    translation: tuple[float, ...]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rotation": list(self.rotation),
            "translation": list(self.translation),
        }

    def rotation_matrix(self) -> np.ndarray:
        return np.asarray(self.rotation, dtype=np.float32).reshape(3, 3)

    def translation_vector(self) -> np.ndarray:
        return np.asarray(self.translation, dtype=np.float32)


@dataclass
class CameraCalibration:
    depth_scale: float
    color_intrinsics: CameraIntrinsics
    depth_intrinsics: CameraIntrinsics
    aligned_depth_intrinsics: CameraIntrinsics
    depth_to_color: CameraExtrinsics
    color_to_depth: CameraExtrinsics

    def to_dict(self) -> Dict[str, Any]:
        return {
            "depth_scale": self.depth_scale,
            "color_intrinsics": self.color_intrinsics.to_dict(),
            "depth_intrinsics": self.depth_intrinsics.to_dict(),
            "aligned_depth_intrinsics": self.aligned_depth_intrinsics.to_dict(),
            "depth_to_color": self.depth_to_color.to_dict(),
            "color_to_depth": self.color_to_depth.to_dict(),
        }


def _intrinsics_from_rs(intrinsics) -> CameraIntrinsics:
    return CameraIntrinsics(
        width=int(intrinsics.width),
        height=int(intrinsics.height),
        fx=float(intrinsics.fx),
        fy=float(intrinsics.fy),
        ppx=float(intrinsics.ppx),
        ppy=float(intrinsics.ppy),
        model=str(intrinsics.model),
        coeffs=tuple(float(v) for v in intrinsics.coeffs),
    )


def _extrinsics_from_rs(extrinsics) -> CameraExtrinsics:
    return CameraExtrinsics(
        rotation=tuple(float(v) for v in extrinsics.rotation),
        translation=tuple(float(v) for v in extrinsics.translation),
    )


def _update_calibration(color_frame, depth_frame) -> None:
    global LATEST_CALIBRATION
    if rs is None or color_frame is None or depth_frame is None:
        return

    color_profile = color_frame.profile.as_video_stream_profile()
    depth_profile = depth_frame.profile.as_video_stream_profile()

    color_intrinsics = _intrinsics_from_rs(color_profile.intrinsics)
    aligned_depth_intrinsics = _intrinsics_from_rs(depth_profile.intrinsics)

    native_depth_intrinsics = aligned_depth_intrinsics
    native_color_intrinsics = color_intrinsics
    depth_to_color = CameraExtrinsics(
        rotation=(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0),
        translation=(0.0, 0.0, 0.0),
    )
    color_to_depth = depth_to_color

    try:
        if RS_PIPELINE is not None:
            active_profile = RS_PIPELINE.get_active_profile()
            depth_stream = active_profile.get_stream(rs.stream.depth).as_video_stream_profile()
            color_stream = active_profile.get_stream(rs.stream.color).as_video_stream_profile()
            native_depth_intrinsics = _intrinsics_from_rs(depth_stream.get_intrinsics())
            native_color_intrinsics = _intrinsics_from_rs(color_stream.get_intrinsics())
            depth_to_color = _extrinsics_from_rs(depth_stream.get_extrinsics_to(color_stream))
            color_to_depth = _extrinsics_from_rs(color_stream.get_extrinsics_to(depth_stream))
    except Exception:
        pass

    depth_scale = float(DEPTH_SCALE or 0.001)
    with FRAME_LOCK:
        LATEST_CALIBRATION = CameraCalibration(
            depth_scale=depth_scale,
            color_intrinsics=native_color_intrinsics,
            depth_intrinsics=native_depth_intrinsics,
            aligned_depth_intrinsics=aligned_depth_intrinsics,
            depth_to_color=depth_to_color,
            color_to_depth=color_to_depth,
        )


# REALSENSE_REMOVE_CANDIDATE: RealSense 디바이스 초기화 함수
# - init_webcam()으로 대체 필요
def init_realsense():
    global RS_PIPELINE, RS_ALIGN, RS_DEVICE, DEPTH_SCALE
    if rs is None:
        raise RuntimeError("pyrealsense2 not installed")
    if RS_PIPELINE is not None:
        return
    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_stream(rs.stream.color, 640, 480, rs.format.bgr8, 30)
    config.enable_stream(rs.stream.depth, 640, 480, rs.format.z16, 30)
    profile = pipeline.start(config)
    try:
        RS_DEVICE = profile.get_device()
        depth_sensor = RS_DEVICE.first_depth_sensor()
        DEPTH_SCALE = float(depth_sensor.get_depth_scale())
    except Exception:
        DEPTH_SCALE = 0.001
    RS_PIPELINE = pipeline
    RS_ALIGN = rs.align(rs.stream.color)


# REALSENSE_REMOVE_CANDIDATE: RealSense 프레임 캡처 (color + depth)
# - capture_frame_webcam()으로 대체 필요 (depth_image는 None 반환)
def capture_frame_realsense() -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    if RS_PIPELINE is None:
        init_realsense()
    frames = RS_PIPELINE.wait_for_frames(timeout_ms=3000)
    aligned = RS_ALIGN.process(frames) if RS_ALIGN is not None else frames
    color_frame = aligned.get_color_frame()
    depth_frame = aligned.get_depth_frame()
    if not color_frame:
        raise RuntimeError("RealSense color frame unavailable")
    _update_calibration(color_frame, depth_frame)
    color_image = np.asanyarray(color_frame.get_data())
    depth_image = np.asanyarray(depth_frame.get_data()) if depth_frame else None
    return color_image, depth_image


# REALSENSE_REMOVE_CANDIDATE: RealSense 캡처 루프 (백그라운드 스레드)
# - 웹캡용 OpenCV 캡처 스레드로 대체 필요
def capture_loop():
    global LATEST_COLOR_FRAME, LATEST_DEPTH_FRAME, CAPTURE_RUNNING, RS_PIPELINE, RS_ALIGN
    while CAPTURE_RUNNING:
        try:
            # REALSENSE_DEPENDENCY: capture_frame_realsense() 호출
            color_image, depth_image = capture_frame_realsense()
            with FRAME_LOCK:
                LATEST_COLOR_FRAME = color_image.copy()
                LATEST_DEPTH_FRAME = depth_image.copy() if depth_image is not None else None
        except Exception:
            try:
                if RS_PIPELINE is not None:
                    RS_PIPELINE.stop()
            except Exception:
                pass
            RS_PIPELINE = None
            RS_ALIGN = None
            time.sleep(1.0)


def ensure_capture_thread():
    global CAPTURE_THREAD, CAPTURE_RUNNING
    if CAPTURE_THREAD is not None and CAPTURE_THREAD.is_alive():
        return
    CAPTURE_RUNNING = True
    CAPTURE_THREAD = threading.Thread(target=capture_loop, daemon=True)
    CAPTURE_THREAD.start()


def stop_capture_thread():
    global CAPTURE_RUNNING
    CAPTURE_RUNNING = False


def get_latest_frame_snapshot():
    with FRAME_LOCK:
        color = None if LATEST_COLOR_FRAME is None else LATEST_COLOR_FRAME.copy()
        depth = None if LATEST_DEPTH_FRAME is None else LATEST_DEPTH_FRAME.copy()
    return color, depth


def get_camera_calibration() -> Optional[Dict[str, Any]]:
    with FRAME_LOCK:
        if LATEST_CALIBRATION is None:
            return None
        return LATEST_CALIBRATION.to_dict()


def depth_raw_to_meters(depth_image: np.ndarray, calibration: Optional[Dict[str, Any]] = None) -> np.ndarray:
    calibration = calibration or get_camera_calibration()
    depth_scale = float((calibration or {}).get("depth_scale", DEPTH_SCALE or 0.001))
    return depth_image.astype(np.float32) * depth_scale


def _intrinsics_from_dict(intrinsics: Dict[str, Any]) -> CameraIntrinsics:
    return CameraIntrinsics(
        width=int(intrinsics["width"]),
        height=int(intrinsics["height"]),
        fx=float(intrinsics["fx"]),
        fy=float(intrinsics["fy"]),
        ppx=float(intrinsics["ppx"]),
        ppy=float(intrinsics["ppy"]),
        model=str(intrinsics.get("model", "unknown")),
        coeffs=tuple(float(v) for v in intrinsics.get("coeffs", [])),
    )


def deproject_pixels_to_points(
    pixel_x: np.ndarray,
    pixel_y: np.ndarray,
    depth_values: np.ndarray,
    calibration: Optional[Dict[str, Any]] = None,
    input_space: str = "aligned_depth",
    output_space: str = "color",
    viewer_coordinates: bool = True,
) -> np.ndarray:
    calibration = calibration or get_camera_calibration()
    if calibration is None:
        raise RuntimeError("Camera calibration is unavailable")

    if input_space == "aligned_depth":
        intrinsics_dict = calibration.get("aligned_depth_intrinsics")
    elif input_space == "depth":
        intrinsics_dict = calibration.get("depth_intrinsics")
    else:
        intrinsics_dict = calibration.get("color_intrinsics")
    intrinsics = _intrinsics_from_dict(intrinsics_dict)

    x = pixel_x.astype(np.float32)
    y = pixel_y.astype(np.float32)
    z = depth_values.astype(np.float32)

    points = np.empty((len(x), 3), dtype=np.float32)
    points[:, 0] = (x - intrinsics.ppx) * z / intrinsics.fx
    points[:, 1] = (y - intrinsics.ppy) * z / intrinsics.fy
    points[:, 2] = z

    if input_space == "depth" and output_space == "color":
        points = transform_points(
            points,
            calibration["depth_to_color"],
            viewer_coordinates=False,
        )

    if viewer_coordinates:
        points[:, 1] *= -1.0
    return points


def transform_points(
    points: np.ndarray,
    extrinsics: Dict[str, Any],
    viewer_coordinates: bool = False,
) -> np.ndarray:
    rotation = np.asarray(extrinsics["rotation"], dtype=np.float32).reshape(3, 3)
    translation = np.asarray(extrinsics["translation"], dtype=np.float32)
    transformed = (points @ rotation.T) + translation
    if viewer_coordinates:
        transformed[:, 1] *= -1.0
    return transformed


# REALSENSE_DEPENDENCY: RealSense 파이프라인 상태 확인
# - pipeline_initialized → 카메라 초기화 상태로 일반화 필요
# - has_depth_frame → 웹캡 모드에서는 항상 False
def get_camera_status():
    with FRAME_LOCK:
        has_color = LATEST_COLOR_FRAME is not None
        has_depth = LATEST_DEPTH_FRAME is not None
        calibration_ready = LATEST_CALIBRATION is not None
    return {
        "has_color_frame": has_color,
        "has_depth_frame": has_depth,
        "capture_running": CAPTURE_RUNNING,
        "pipeline_initialized": RS_PIPELINE is not None,  # REALSENSE_DEPENDENCY
        "calibration_ready": calibration_ready,
        "depth_scale": float(DEPTH_SCALE or 0.001),  # REALSENSE_DEPENDENCY
    }
