from __future__ import annotations

import math
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    import open3d as o3d
except Exception:
    o3d = None

# REALSENSE_DEPENDENCY: camera_manager 함수들이 RealSense calibration 사용
# - depth_raw_to_meters() → RealSense depth_scale 사용
# - deproject_pixels_to_points() → RealSense intrinsic/extrinsic 사용
# - get_camera_calibration() → RealSense calibration 반환
from core.camera_manager import (
    deproject_pixels_to_points,  # REALSENSE_DEPENDENCY
    depth_raw_to_meters,  # REALSENSE_DEPENDENCY
    get_camera_calibration,  # REALSENSE_DEPENDENCY
)
from core.storage_manager import FRAMES_DIR


MESH_DIR = FRAMES_DIR / "mesh"
MESH_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_TARGET_DISTANCE_M = 1.8
DEFAULT_DEPTH_WINDOW_M = 0.7
DEFAULT_VOXEL_SIZE_M = 0.012
DEFAULT_FRAME_STRIDE = 2
DEFAULT_MAX_POINTS_PER_FRAME = 40000
DEFAULT_BODY_RADIUS_M = 0.8


@dataclass
class FrameCapture:
    points: np.ndarray
    colors: np.ndarray
    centroid: np.ndarray
    captured_at: float


class MeshCaptureSession:
    def __init__(
        self,
        session_id: str,
        target_distance_m: float = DEFAULT_TARGET_DISTANCE_M,
        depth_window_m: float = DEFAULT_DEPTH_WINDOW_M,
        voxel_size_m: float = DEFAULT_VOXEL_SIZE_M,
        frame_stride: int = DEFAULT_FRAME_STRIDE,
        max_points_per_frame: int = DEFAULT_MAX_POINTS_PER_FRAME,
        bodycheck_data: Optional[Dict[str, Any]] = None,
    ):
        self.session_id = session_id
        self.started_at = time.time()
        self.ended_at: Optional[float] = None
        self.active = True

        self.target_distance_m = max(0.8, target_distance_m)
        self.depth_window_m = min(max(depth_window_m, 0.25), 1.5)
        self.voxel_size_m = min(max(voxel_size_m, 0.004), 0.03)
        self.frame_stride = max(1, frame_stride)
        self.max_points_per_frame = max(1000, max_points_per_frame)

        self.frames: List[FrameCapture] = []
        self.frame_count = 0
        self.accepted_frame_count = 0

        # Bodycheck 데이터 저장 (관절 기반 모델 생성에 활용)
        self.bodycheck_data = bodycheck_data or {}

        self._lock = threading.Lock()

    def add_point_cloud(self, points: np.ndarray, colors: np.ndarray) -> bool:
        with self._lock:
            if not self.active:
                return False

            self.frame_count += 1
            if self.frame_count % self.frame_stride != 0:
                return True

            if points.size == 0:
                return True

            if len(points) > self.max_points_per_frame:
                indices = np.linspace(
                    0,
                    len(points) - 1,
                    self.max_points_per_frame,
                    dtype=np.int32,
                )
                points = points[indices]
                colors = colors[indices]

            centroid = np.median(points, axis=0).astype(np.float32)
            self.frames.append(
                FrameCapture(
                    points=points,
                    colors=colors,
                    centroid=centroid,
                    captured_at=time.time(),
                )
            )
            self.accepted_frame_count += 1
            return True

    def stop(self) -> None:
        with self._lock:
            self.active = False
            self.ended_at = time.time()

    def get_status(self) -> Dict:
        with self._lock:
            duration = (
                time.time() - self.started_at
                if self.active
                else (self.ended_at - self.started_at)
                if self.ended_at
                else 0
            )
            return {
                "session_id": self.session_id,
                "active": self.active,
                "frame_count": self.frame_count,
                "accepted_frame_count": self.accepted_frame_count,
                "started_at": self.started_at,
                "duration": duration,
                "target_distance_m": self.target_distance_m,
                "depth_window_m": self.depth_window_m,
                "voxel_size_m": self.voxel_size_m,
            }


SESSION_LOCK = threading.Lock()
ACTIVE_SESSIONS: Dict[str, MeshCaptureSession] = {}


def start_mesh_capture(
    target_distance_m: float = DEFAULT_TARGET_DISTANCE_M,
    depth_window_m: float = DEFAULT_DEPTH_WINDOW_M,
    voxel_size_m: float = DEFAULT_VOXEL_SIZE_M,
    frame_stride: int = DEFAULT_FRAME_STRIDE,
    max_points_per_frame: int = DEFAULT_MAX_POINTS_PER_FRAME,
    bodycheck_data: Optional[Dict[str, Any]] = None,
) -> Dict:
    session_id = str(uuid.uuid4())
    session = MeshCaptureSession(
        session_id=session_id,
        target_distance_m=target_distance_m,
        depth_window_m=depth_window_m,
        voxel_size_m=voxel_size_m,
        frame_stride=frame_stride,
        max_points_per_frame=max_points_per_frame,
    )

    with SESSION_LOCK:
        ACTIVE_SESSIONS[session_id] = session

    return {
        "ok": True,
        "session_id": session_id,
        "message": "Mesh capture session started",
        "config": {
            "target_distance_m": session.target_distance_m,
            "depth_window_m": session.depth_window_m,
            "voxel_size_m": session.voxel_size_m,
            "frame_stride": session.frame_stride,
            "max_points_per_frame": session.max_points_per_frame,
        },
    }


def stop_mesh_capture(session_id: str) -> Dict:
    with SESSION_LOCK:
        session = ACTIVE_SESSIONS.get(session_id)

    if session is None:
        return {"ok": False, "error": "Session not found"}

    session.stop()

    try:
        files, diagnostics = generate_mesh_files(session)
        return {
            "ok": True,
            "session_id": session_id,
            "frame_count": session.frame_count,
            "accepted_frame_count": session.accepted_frame_count,
            "duration": session.get_status()["duration"],
            "files": files,
            "diagnostics": diagnostics,
            "message": f"Mesh generated from {session.accepted_frame_count} filtered frames",
        }
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Mesh generation failed: {exc}",
            "diagnostics": {
                "accepted_frame_count": session.accepted_frame_count,
                "frame_count": session.frame_count,
                "reason": str(exc),
            },
        }


def add_frame_to_session(session_id: str, points: np.ndarray, colors: np.ndarray) -> Dict:
    with SESSION_LOCK:
        session = ACTIVE_SESSIONS.get(session_id)

    if session is None:
        return {"ok": False, "error": "Session not found"}

    success = session.add_point_cloud(points, colors)
    if not success:
        return {"ok": False, "error": "Session is not active"}

    return {
        "ok": True,
        "session_id": session_id,
        "frame_count": session.frame_count,
        "accepted_frame_count": session.accepted_frame_count,
    }


def build_preview_payload(
    points: np.ndarray,
    colors: np.ndarray,
    max_points: int = 2500,
) -> Dict[str, List[List[float]]]:
    if points.size == 0 or colors.size == 0:
        return {"points": [], "colors": []}

    count = len(points)
    if count > max_points:
        indices = np.linspace(0, count - 1, max_points, dtype=np.int32)
        points = points[indices]
        colors = colors[indices]

    return {
        "points": points.astype(np.float32).tolist(),
        "colors": colors.astype(np.float32).tolist(),
    }


def get_session_status(session_id: str) -> Dict:
    with SESSION_LOCK:
        session = ACTIVE_SESSIONS.get(session_id)

    if session is None:
        return {"ok": False, "error": "Session not found"}

    return {"ok": True, "status": session.get_status()}


def list_mesh_sessions() -> List[Dict]:
    with SESSION_LOCK:
        return [session.get_status() for session in ACTIVE_SESSIONS.values()]


# REALSENSE_REMOVE_CANDIDATE: RealSense depth 기반 3D 포인트 클라우드 생성
# - 웹캡에서는 depth_image=None → 항상 _empty_cloud() 반환
# - 3D mesh 캡처 기능 비활성화 또는 RGB-only cloud로 대체 필요
def create_point_cloud_from_arrays(
    color_image: np.ndarray,
    depth_image: np.ndarray,  # REALSENSE_DEPENDENCY: RealSense depth image
    target_distance_m: float = DEFAULT_TARGET_DISTANCE_M,
    depth_window_m: float = DEFAULT_DEPTH_WINDOW_M,
    landmarks: Optional[List[Dict[str, float]]] = None,
    bodycheck_data: Optional[Dict[str, Any]] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    if color_image is None or depth_image is None:  # REALSENSE_REMOVE_CANDIDATE: depth None 체크
        return _empty_cloud()

    h, w = depth_image.shape[:2]
    if h == 0 or w == 0:
        return _empty_cloud()

    # Bodycheck 데이터에서 depth fitting 정보 추출
    body_torso_depth = None
    if bodycheck_data:
        torso_depth = bodycheck_data.get("torso_depth")
        if torso_depth and isinstance(torso_depth, (int, float)):
            # bodycheck의 torso_depth를 사용하여 depth window 조정
            body_torso_depth = float(torso_depth)
            depth_window_m = max(0.25, body_torso_depth * 0.9)

    calibration = get_camera_calibration()
    depth_m = depth_raw_to_meters(depth_image, calibration)
    valid = depth_m > 0
    valid &= depth_m >= max(0.3, target_distance_m - depth_window_m)
    valid &= depth_m <= target_distance_m + depth_window_m

    roi_mask = _build_pose_guided_mask(
        width=w,
        height=h,
        depth_m=depth_m,
        landmarks=landmarks or [],
        target_distance_m=target_distance_m,
        depth_window_m=depth_window_m,
    )
    valid &= roi_mask

    if not np.any(valid):
        return _empty_cloud()

    subject_mask = _extract_subject_mask(valid, depth_m, target_distance_m)
    if not np.any(subject_mask):
        return _empty_cloud()

    ys, xs = np.where(subject_mask)
    zs = depth_m[ys, xs]
    if calibration is not None:
        points = deproject_pixels_to_points(
            pixel_x=xs.astype(np.float32),
            pixel_y=ys.astype(np.float32),
            depth_values=zs.astype(np.float32),
            calibration=calibration,
            output_space="color",
        )
    else:
        fx = 615.0
        fy = 615.0
        cx = w / 2.0
        cy = h / 2.0

        points = np.empty((len(xs), 3), dtype=np.float32)
        points[:, 0] = (xs.astype(np.float32) - cx) * zs / fx
        points[:, 1] = -(ys.astype(np.float32) - cy) * zs / fy
        points[:, 2] = zs

    colors = color_image[ys, xs][:, ::-1].astype(np.float32) / 255.0

    z_median = float(np.median(points[:, 2]))
    body_thickness = np.abs(points[:, 2] - z_median) <= 0.45
    points = points[body_thickness]
    colors = colors[body_thickness]

    if len(points) == 0:
        return _empty_cloud()

    return points, colors


def _build_pose_guided_mask(
    width: int,
    height: int,
    depth_m: np.ndarray,
    landmarks: List[Dict[str, float]],
    target_distance_m: float,
    depth_window_m: float,
) -> np.ndarray:
    valid_landmarks = [
        lm for lm in landmarks
        if float(lm.get("visibility", 0.0)) >= 0.35
        and float(lm.get("presence", 0.0)) >= 0.35
    ]

    mask = np.zeros((height, width), dtype=bool)

    if len(valid_landmarks) < 4:
        y1 = int(height * 0.05)
        y2 = int(height * 0.98)
        x1 = int(width * 0.15)
        x2 = int(width * 0.85)
        mask[y1:y2, x1:x2] = True
        return mask

    xs = np.array([float(lm["x"]) for lm in valid_landmarks], dtype=np.float32)
    ys = np.array([float(lm["y"]) for lm in valid_landmarks], dtype=np.float32)

    x_min = max(0, int(np.floor(xs.min() - width * 0.14)))
    x_max = min(width, int(np.ceil(xs.max() + width * 0.14)))
    y_min = max(0, int(np.floor(ys.min() - height * 0.10)))
    y_max = min(height, int(np.ceil(ys.max() + height * 0.16)))
    mask[y_min:y_max, x_min:x_max] = True

    torso_names = {
        "left_shoulder",
        "right_shoulder",
        "left_hip",
        "right_hip",
        "left_knee",
        "right_knee",
    }
    torso_depths = []
    for lm in valid_landmarks:
        if lm.get("name") not in torso_names:
            continue
        px = int(np.clip(round(float(lm["x"])), 0, width - 1))
        py = int(np.clip(round(float(lm["y"])), 0, height - 1))
        z = float(depth_m[py, px])
        if z > 0:
            torso_depths.append(z)

    if torso_depths:
        torso_depth = float(np.median(torso_depths))
    else:
        torso_depth = target_distance_m

    depth_mask = depth_m > 0
    depth_mask &= depth_m >= max(0.3, torso_depth - min(depth_window_m, 0.32))
    depth_mask &= depth_m <= torso_depth + min(depth_window_m, 0.38)

    kernel = np.ones((7, 7), dtype=np.uint8)
    final_mask = (mask & depth_mask).astype(np.uint8) * 255
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return final_mask.astype(bool)


def generate_mesh_files(session: MeshCaptureSession) -> Tuple[Dict[str, Optional[str]], Dict[str, object]]:
    if o3d is None:
        raise RuntimeError("open3d not installed")
    if len(session.frames) < 8:
        raise ValueError("Not enough usable frames captured")

    session_dir = MESH_DIR / session.session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    pcd_path = session_dir / "pointcloud.ply"
    mesh_path = session_dir / "mesh.ply"

    transformed_points, transformed_colors = _normalize_turntable_sequence(session.frames, session.bodycheck_data)

    diagnostics: Dict[str, object] = {
        "accepted_frame_count": session.accepted_frame_count,
        "raw_point_count": int(len(transformed_points)),
        "mesh_created": False,
        "bodycheck_data_used": bool(session.bodycheck_data),
    }

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(transformed_points)
    pcd.colors = o3d.utility.Vector3dVector(transformed_colors)

    pcd = pcd.voxel_down_sample(voxel_size=session.voxel_size_m)
    if len(pcd.points) == 0:
        raise ValueError("Point cloud became empty after downsampling")
    diagnostics["downsampled_point_count"] = int(len(pcd.points))

    pcd = _trim_to_body_volume(pcd, diagnostics)
    if len(pcd.points) == 0:
        raise ValueError("Point cloud became empty after body volume trimming")

    pcd = _remove_floor_plane(pcd, diagnostics, session.voxel_size_m)
    if len(pcd.points) == 0:
        raise ValueError("Point cloud became empty after floor removal")

    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=24, std_ratio=1.8)
    pcd, _ = pcd.remove_radius_outlier(nb_points=12, radius=session.voxel_size_m * 3.5)
    diagnostics["filtered_point_count"] = int(len(pcd.points))

    pcd = _keep_largest_cluster(pcd, diagnostics, session.voxel_size_m)
    if len(pcd.points) == 0:
        raise ValueError("Point cloud became empty after clustering")

    bbox = pcd.get_axis_aligned_bounding_box()
    extent = bbox.get_extent()
    if np.any(np.asarray(extent) <= 0):
        raise ValueError("Invalid point cloud extent")
    diagnostics["bbox_extent_m"] = [float(v) for v in extent]

    o3d.io.write_point_cloud(str(pcd_path), pcd)

    mesh = _build_mesh_from_point_cloud(pcd, session.voxel_size_m)
    saved_mesh = None
    if mesh is not None and len(mesh.vertices) > 0 and len(mesh.triangles) > 0:
        o3d.io.write_triangle_mesh(str(mesh_path), mesh, write_ascii=False)
        saved_mesh = str(mesh_path)
        diagnostics["mesh_created"] = True
        diagnostics["mesh_vertex_count"] = int(len(mesh.vertices))
        diagnostics["mesh_triangle_count"] = int(len(mesh.triangles))
    else:
        diagnostics["reason"] = "Mesh surface was not reconstructed; point cloud only"

    return (
        {
            "pointcloud_ply": str(pcd_path),
            "mesh_ply": saved_mesh,
        },
        diagnostics,
    )


def _extract_subject_mask(
    valid_mask: np.ndarray,
    depth_m: np.ndarray,
    target_distance_m: float,
) -> np.ndarray:
    mask_u8 = (valid_mask.astype(np.uint8) * 255)
    kernel = np.ones((5, 5), dtype=np.uint8)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_OPEN, kernel, iterations=1)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel, iterations=2)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask_u8, connectivity=8)
    if count <= 1:
        return valid_mask

    h, w = valid_mask.shape
    center_x = w / 2.0
    best_label = 0
    best_score = -1.0

    for label in range(1, count):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < 2000:
            continue

        xs = np.where(labels == label)[1]
        ys = np.where(labels == label)[0]
        if len(xs) == 0:
            continue

        median_depth = float(np.median(depth_m[labels == label]))
        center_distance = abs(float(np.median(xs)) - center_x)
        score = area * 1.0 - center_distance * 45.0 - abs(median_depth - target_distance_m) * 2500.0

        top = int(np.min(ys))
        bottom = int(np.max(ys))
        height_ratio = (bottom - top) / max(h, 1)
        if height_ratio < 0.35:
            continue

        if score > best_score:
            best_score = score
            best_label = label

    if best_label == 0:
        return valid_mask

    return labels == best_label


def _normalize_turntable_sequence(frames: List[FrameCapture], bodycheck_data: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, np.ndarray]:
    centroids = np.vstack([frame.centroid for frame in frames])
    pivot_x = float(np.median(centroids[:, 0]))
    pivot_z = float(np.median(centroids[:, 2]))
    pivot = np.array([pivot_x, 0.0, pivot_z], dtype=np.float32)

    offsets_x = centroids[:, 0] - pivot_x
    offsets_z = centroids[:, 2] - pivot_z
    radii = np.sqrt(offsets_x ** 2 + offsets_z ** 2)
    use_measured_angles = float(np.median(radii)) > 0.04

    if use_measured_angles:
        measured_angles = np.unwrap(np.arctan2(offsets_x, offsets_z))
        reference_angle = float(np.median(measured_angles))
    else:
        total = max(len(frames) - 1, 1)

    rough_points: List[np.ndarray] = []
    all_colors: List[np.ndarray] = []

    for index, frame in enumerate(frames):
        if use_measured_angles:
            angle = float(measured_angles[index] - reference_angle)
        else:
            angle = (2.0 * math.pi * index) / total
        rotated = _rotate_y(frame.points, -angle, pivot)
        rough_points.append(rotated)
        all_colors.append(frame.colors)

    refined_points = _refine_sequence_with_icp(rough_points, all_colors)
    return np.vstack(refined_points), np.vstack(all_colors)


def _refine_sequence_with_icp(
    points_per_frame: List[np.ndarray],
    colors_per_frame: List[np.ndarray],
) -> List[np.ndarray]:
    if o3d is None or len(points_per_frame) < 2:
        return points_per_frame

    refined_points: List[np.ndarray] = []
    reference_pcd = None

    for index, points in enumerate(points_per_frame):
        colors = colors_per_frame[index]
        source = o3d.geometry.PointCloud()
        source.points = o3d.utility.Vector3dVector(points)
        source.colors = o3d.utility.Vector3dVector(colors)

        source_down = source.voxel_down_sample(voxel_size=0.018)
        if len(source_down.points) < 200:
            refined_points.append(points)
            continue

        source_down.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.05, max_nn=32)
        )

        if reference_pcd is None:
            reference_pcd = source_down
            refined_points.append(np.asarray(source.points).copy())
            continue

        reference_pcd.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.05, max_nn=32)
        )

        transform = np.eye(4)
        try:
            coarse = o3d.pipelines.registration.registration_icp(
                source_down,
                reference_pcd,
                0.08,
                transform,
                o3d.pipelines.registration.TransformationEstimationPointToPlane(),
            )
            fine = o3d.pipelines.registration.registration_icp(
                source_down,
                reference_pcd,
                0.03,
                coarse.transformation,
                o3d.pipelines.registration.TransformationEstimationPointToPlane(),
            )
            transform = fine.transformation
        except Exception:
            refined_points.append(points)
            reference_pcd += source_down
            reference_pcd = reference_pcd.voxel_down_sample(voxel_size=0.02)
            continue

        source.transform(transform)
        refined = np.asarray(source.points).copy()
        refined_points.append(refined)

        source_down.transform(transform)
        reference_pcd += source_down
        reference_pcd = reference_pcd.voxel_down_sample(voxel_size=0.02)

    return refined_points


def _trim_to_body_volume(pcd, diagnostics: Dict[str, object]):
    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors)
    if len(points) == 0:
        return pcd

    center_x = float(np.median(points[:, 0]))
    center_z = float(np.median(points[:, 2]))
    floor_y_guess = float(np.quantile(points[:, 1], 0.02))
    head_y_guess = float(np.quantile(points[:, 1], 0.998))

    radial_distance = np.sqrt((points[:, 0] - center_x) ** 2 + (points[:, 2] - center_z) ** 2)
    keep_mask = radial_distance <= DEFAULT_BODY_RADIUS_M
    keep_mask &= points[:, 1] >= floor_y_guess - 0.06
    keep_mask &= points[:, 1] <= head_y_guess + 0.05

    # If the cylinder crop would discard too much, fall back to a looser quantile crop.
    keep_ratio = float(np.count_nonzero(keep_mask)) / float(len(points))
    if keep_ratio < 0.45:
        x_low, x_high = np.quantile(points[:, 0], [0.02, 0.98])
        z_low, z_high = np.quantile(points[:, 2], [0.02, 0.98])
        keep_mask = (
            (points[:, 0] >= x_low)
            & (points[:, 0] <= x_high)
            & (points[:, 2] >= z_low)
            & (points[:, 2] <= z_high)
            & (points[:, 1] >= floor_y_guess - 0.06)
            & (points[:, 1] <= head_y_guess + 0.05)
        )

    trimmed = o3d.geometry.PointCloud()
    trimmed.points = o3d.utility.Vector3dVector(points[keep_mask])
    trimmed.colors = o3d.utility.Vector3dVector(colors[keep_mask])

    diagnostics["body_volume_point_count"] = int(len(trimmed.points))
    diagnostics["body_center_xz"] = [center_x, center_z]
    diagnostics["body_keep_ratio"] = keep_ratio
    return trimmed


def _remove_floor_plane(pcd, diagnostics: Dict[str, object], voxel_size_m: float):
    if len(pcd.points) < 500:
        return pcd

    try:
        plane_model, inliers = pcd.segment_plane(
            distance_threshold=max(0.008, voxel_size_m * 1.4),
            ransac_n=3,
            num_iterations=1000,
        )
    except Exception:
        return pcd

    a, b, c, d = plane_model
    normal = np.array([a, b, c], dtype=np.float64)
    normal_norm = np.linalg.norm(normal)
    if normal_norm == 0:
        return pcd
    normal /= normal_norm

    vertical_alignment = abs(float(np.dot(normal, np.array([0.0, 1.0, 0.0]))))
    if vertical_alignment < 0.85:
        return pcd

    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors)
    distances = np.abs((points @ normal) + (d / normal_norm))
    signed = (points @ normal) + (d / normal_norm)
    floor_level = float(np.median(points[inliers, 1])) if len(inliers) else float(np.min(points[:, 1]))

    floor_mask = (distances <= max(0.01, voxel_size_m * 1.6)) & (points[:, 1] <= floor_level + 0.03)
    keep_mask = ~floor_mask

    filtered = o3d.geometry.PointCloud()
    filtered.points = o3d.utility.Vector3dVector(points[keep_mask])
    filtered.colors = o3d.utility.Vector3dVector(colors[keep_mask])

    diagnostics["floor_removed_point_count"] = int(np.count_nonzero(floor_mask))
    diagnostics["floor_level_y"] = floor_level
    return filtered


def _keep_largest_cluster(pcd, diagnostics: Dict[str, object], voxel_size_m: float):
    if len(pcd.points) < 500:
        return pcd

    labels = np.asarray(
        pcd.cluster_dbscan(
            eps=max(0.04, voxel_size_m * 4.5),
            min_points=40,
            print_progress=False,
        )
    )
    if labels.size == 0 or np.all(labels < 0):
        return pcd

    non_noise = labels[labels >= 0]
    if non_noise.size == 0:
        return pcd

    unique_labels, counts = np.unique(non_noise, return_counts=True)
    largest_label = int(unique_labels[np.argmax(counts)])
    keep_mask = labels == largest_label
    keep_ratio = float(np.max(counts)) / float(len(labels))

    # If clustering collapses the scan into a tiny fragment, keep the full cloud.
    if keep_ratio < 0.35:
        diagnostics["cluster_count"] = int(len(unique_labels))
        diagnostics["largest_cluster_point_count"] = int(np.max(counts))
        diagnostics["largest_cluster_ratio"] = keep_ratio
        diagnostics["clustering_skipped"] = True
        return pcd

    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors)
    clustered = o3d.geometry.PointCloud()
    clustered.points = o3d.utility.Vector3dVector(points[keep_mask])
    clustered.colors = o3d.utility.Vector3dVector(colors[keep_mask])

    diagnostics["cluster_count"] = int(len(unique_labels))
    diagnostics["largest_cluster_point_count"] = int(np.max(counts))
    diagnostics["largest_cluster_ratio"] = keep_ratio
    return clustered


def _rotate_y(points: np.ndarray, angle_rad: float, pivot: np.ndarray) -> np.ndarray:
    shifted = points - pivot
    c = math.cos(angle_rad)
    s = math.sin(angle_rad)
    rotated = shifted.copy()
    rotated[:, 0] = shifted[:, 0] * c + shifted[:, 2] * s
    rotated[:, 2] = -shifted[:, 0] * s + shifted[:, 2] * c
    return rotated + pivot


def _build_mesh_from_point_cloud(pcd, voxel_size_m: float):
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=voxel_size_m * 4.0,
            max_nn=48,
        )
    )
    pcd.orient_normals_consistent_tangent_plane(20)

    mesh = _build_poisson_mesh(pcd)
    if mesh is None or len(mesh.vertices) == 0 or len(mesh.triangles) == 0:
        mesh = _build_ball_pivot_mesh(pcd, voxel_size_m)
    if mesh is None or len(mesh.vertices) == 0 or len(mesh.triangles) == 0:
        return None

    bbox = mesh.get_axis_aligned_bounding_box()
    extent = np.asarray(bbox.get_extent())
    if np.any(extent < np.array([0.15, 0.5, 0.12])):
        return None

    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    triangle_clusters, cluster_n_triangles, _ = mesh.cluster_connected_triangles()
    if len(cluster_n_triangles) > 0:
        cluster_n_triangles = np.asarray(cluster_n_triangles)
        triangle_clusters = np.asarray(triangle_clusters)
        largest_cluster_size = int(cluster_n_triangles.max())
        small_cluster_mask = cluster_n_triangles[triangle_clusters] < max(128, largest_cluster_size * 0.08)
        mesh.remove_triangles_by_mask(small_cluster_mask)
        mesh.remove_unreferenced_vertices()
    mesh = mesh.filter_smooth_taubin(number_of_iterations=8)
    mesh.compute_vertex_normals()
    return mesh


def _build_poisson_mesh(pcd):
    try:
        mesh, densities = o3d.geometry.TriangleMesh.create_from_poisson(
            pcd,
            depth=9,
            width=0,
            scale=1.05,
            linear_fit=False,
        )
    except Exception:
        return None

    density_values = np.asarray(densities)
    if density_values.size == 0:
        return None

    cutoff = np.quantile(density_values, 0.03)
    mesh.remove_vertices_by_mask(density_values < cutoff)
    return mesh


def _build_ball_pivot_mesh(pcd, voxel_size_m: float):
    try:
        radii = o3d.utility.DoubleVector([
            voxel_size_m * 1.5,
            voxel_size_m * 2.5,
            voxel_size_m * 4.0,
        ])
        return o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(pcd, radii)
    except Exception:
        return None


def _empty_cloud() -> Tuple[np.ndarray, np.ndarray]:
    return (
        np.empty((0, 3), dtype=np.float32),
        np.empty((0, 3), dtype=np.float32),
    )
