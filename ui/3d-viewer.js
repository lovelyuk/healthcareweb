import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene;
let camera;
let renderer;
let controls;
let currentObject = null;

const canvas = document.getElementById('meshCanvas');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const meshInfo = document.getElementById('meshInfo');
const vertexCountEl = document.getElementById('vertexCount');
const faceCountEl = document.getElementById('faceCount');
const renderStateBadge = document.getElementById('renderStateBadge');
const renderStateText = document.getElementById('renderStateText');
const errorLog = document.getElementById('errorLog');
const errorLogBody = document.getElementById('errorLogBody');
const glbFileSelect = document.getElementById('glbFileSelect');
const btnLoadGLB = document.getElementById('btnLoadGLB');

const GLB_MODELS = [
    { label: 'Male', path: '/ui/models/male.glb' },
    { label: 'Female', path: '/ui/models/female.glb' },
];
const SELECTED_GLB_STORAGE_KEY = 'selectedGlbModelPath';

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
    camera.position.set(0, 1.1, 2.2);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.set(0, 0.95, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(4, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.42);
    fillLight.position.set(-4, 5, -2);
    scene.add(fillLight);

    scene.add(new THREE.GridHelper(4, 16, 0x355070, 0x1b2838));
    scene.add(new THREE.AxesHelper(0.45));

    customizeLegacyPanel();

    window.addEventListener('resize', onWindowResize);
    document.getElementById('btnViewFront')?.addEventListener('click', setViewFront);
    document.getElementById('btnViewSide')?.addEventListener('click', setViewSide);
    document.getElementById('btnViewTop')?.addEventListener('click', setViewTop);
    document.getElementById('btnResetView')?.addEventListener('click', resetView);
    initGlbControls();

    animate();
    setRenderState('idle', 'Loading Model');
    loadViewerModel();
}

function customizeLegacyPanel() {
    document.getElementById('btnStartCapture')?.remove();
    document.getElementById('btnStopCapture')?.remove();
    document.getElementById('btnLoadPLY')?.remove();
    document.getElementById('btnDownload')?.remove();
    document.getElementById('countdownOverlay')?.remove();

    const panelTitleIcon = document.querySelector('.control-panel .panel-title i');
    const panelTitleText = document.querySelector('.control-panel .panel-title span');
    if (panelTitleIcon) panelTitleIcon.className = 'fa-solid fa-user';
    if (panelTitleText) panelTitleText.textContent = 'Result Model';

    setStatusRowText('captureStatus', 'Source', 'SMPL');
    setStatusRowText('frameCount', 'Height', '-');
    setStatusRowText('captureTime', 'Profile', '-');
}

function setStatusRowText(valueId, labelText, valueText) {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
    const row = valueEl.closest('.status-item');
    const label = row?.querySelector('.status-label');
    if (label) label.textContent = `${labelText}:`;
    valueEl.textContent = valueText;
}

function initGlbControls() {
    if (!glbFileSelect) return;
    glbFileSelect.innerHTML = '<option value="">GLB Model</option>';
    for (const model of GLB_MODELS) {
        const option = document.createElement('option');
        option.value = model.path;
        option.textContent = model.label;
        glbFileSelect.appendChild(option);
    }

    const savedPath = localStorage.getItem(SELECTED_GLB_STORAGE_KEY) || '';
    if (savedPath) {
        glbFileSelect.value = savedPath;
    }

    btnLoadGLB?.addEventListener('click', async () => {
        const selectedPath = glbFileSelect.value;
        if (!selectedPath) return;
        await loadViewerGlb(selectedPath);
    });
}

function onWindowResize() {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (currentObject) {
        currentObject.rotation.y += 0.0035;
    }
    controls.update();
    renderer.render(scene, camera);
}

function showLoading(text) {
    if (loadingText) loadingText.textContent = text;
    loadingOverlay?.classList.add('visible');
}

function hideLoading() {
    loadingOverlay?.classList.remove('visible');
}

function showErrorLog(message) {
    if (errorLogBody) errorLogBody.textContent = message;
    errorLog?.classList.add('visible');
}

function hideErrorLog() {
    errorLog?.classList.remove('visible');
    if (errorLogBody) errorLogBody.textContent = '';
}

function setRenderState(state, text) {
    if (renderStateBadge) renderStateBadge.className = `status-badge ${state}`;
    if (renderStateText) renderStateText.textContent = text;
}

function clearCurrentObject() {
    if (!currentObject) return;
    scene.remove(currentObject);
    currentObject.traverse?.((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
            child.material.forEach((material) => material?.dispose?.());
        } else {
            child.material?.dispose?.();
        }
    });
    currentObject.geometry?.dispose?.();
    currentObject.material?.dispose?.();
    currentObject = null;
}

function collectObjectStats(object) {
    let vertices = 0;
    let faces = 0;
    object.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const geom = child.geometry;
        const positionCount = geom.attributes?.position?.count || 0;
        vertices += positionCount;

        if (geom.index) {
            faces += Math.floor(geom.index.count / 3);
        } else if (positionCount > 0) {
            faces += Math.floor(positionCount / 3);
        }
    });
    return { vertices, faces };
}

function applyViewerMaterial(root) {
    root.traverse((child) => {
        if (!child.isMesh) return;
        child.material = new THREE.MeshStandardMaterial({
            color: 0x97dffc,
            roughness: 0.86,
            metalness: 0.03,
            side: THREE.DoubleSide,
        });
    });
}

function renderBodyModel(model) {
    clearCurrentObject();

    const vertices = new Float32Array(model.vertices.flat());
    const faces = new Uint32Array(model.faces.flat());

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(faces, 1));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
            color: 0x97dffc,
            roughness: 0.86,
            metalness: 0.03,
            side: THREE.DoubleSide,
        })
    );

    const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 28),
        new THREE.LineBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.18 })
    );

    currentObject = new THREE.Group();
    currentObject.add(mesh);
    currentObject.add(wire);
    scene.add(currentObject);

    fitCameraToObject(currentObject);

    if (vertexCountEl) vertexCountEl.textContent = geometry.attributes.position.count.toLocaleString();
    if (faceCountEl) faceCountEl.textContent = (faces.length / 3).toLocaleString();
    meshInfo?.classList.add('visible');
}

function renderGlbModel(sceneRoot) {
    clearCurrentObject();

    const root = sceneRoot.clone(true);
    applyViewerMaterial(root);

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.position.y -= box.min.y;

    currentObject = root;
    scene.add(currentObject);
    fitCameraToObject(currentObject);

    const stats = collectObjectStats(currentObject);
    if (vertexCountEl) vertexCountEl.textContent = stats.vertices.toLocaleString();
    if (faceCountEl) faceCountEl.textContent = stats.faces.toLocaleString();
    meshInfo?.classList.add('visible');
}

async function loadViewerGlb(path) {
    if (!path) return;

    showLoading('Loading GLB model...');
    hideErrorLog();

    try {
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
            loader.load(path, resolve, undefined, reject);
        });

        renderGlbModel(gltf.scene);
        setRenderState('preview', 'GLB Model');
        setStatusRowText('captureStatus', 'Source', 'GLB');
        setStatusRowText('captureTime', 'Profile', path.split('/').pop() || 'custom');
        localStorage.setItem(SELECTED_GLB_STORAGE_KEY, path);
    } catch (error) {
        setRenderState('idle', 'GLB Load Failed');
        showErrorLog(`GLB load error: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function fitCameraToObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const distance = maxDim * 1.72;

    camera.position.set(center.x, center.y + maxDim * 0.12, center.z + distance);
    controls.target.copy(center);
    controls.update();
}

function setViewFront() {
    if (!currentObject) return;
    const center = new THREE.Box3().setFromObject(currentObject).getCenter(new THREE.Vector3());
    camera.position.set(center.x, center.y + 0.15, center.z + 2.0);
    controls.target.copy(center);
    controls.update();
}

function setViewSide() {
    if (!currentObject) return;
    const center = new THREE.Box3().setFromObject(currentObject).getCenter(new THREE.Vector3());
    camera.position.set(center.x + 2.0, center.y + 0.15, center.z);
    controls.target.copy(center);
    controls.update();
}

function setViewTop() {
    if (!currentObject) return;
    const center = new THREE.Box3().setFromObject(currentObject).getCenter(new THREE.Vector3());
    camera.position.set(center.x, center.y + 2.6, center.z + 0.01);
    controls.target.copy(center);
    controls.update();
}

function resetView() {
    if (currentObject) {
        fitCameraToObject(currentObject);
    }
}

function updateSummary(meta) {
    setStatusRowText('captureStatus', 'Source', meta?.source_model || 'SMPL');
    setStatusRowText('frameCount', 'Height', meta?.height_cm ? `${meta.height_cm} cm` : '-');
    setStatusRowText('captureTime', 'Profile', meta?.gender || 'male');
}

function getStoredBodyCheckReport() {
    const raw = localStorage.getItem('bodyCheckReport');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error('Failed to parse bodyCheckReport:', error);
        return null;
    }
}

function inferGender(report) {
    const candidates = [
        report?.gender,
        report?.sex,
        report?.subject?.gender,
        report?.subject?.sex,
        report?.front?.subject?.gender,
        report?.front?.subject?.sex,
    ];
    for (const value of candidates) {
        const normalized = String(value || '').toLowerCase();
        if (normalized.startsWith('f')) return 'female';
        if (normalized.startsWith('m')) return 'male';
    }
    return 'male';
}

async function loadViewerModel() {
    const preferredGlb = localStorage.getItem(SELECTED_GLB_STORAGE_KEY);
    if (preferredGlb) {
        if (glbFileSelect) glbFileSelect.value = preferredGlb;
        await loadViewerGlb(preferredGlb);
        return;
    }

    showLoading('Loading SMPL result model...');
    hideErrorLog();

    const report = getStoredBodyCheckReport();
    if (!report?.mergedAnalysis) {
        hideLoading();
        setRenderState('idle', 'No Result');
        showErrorLog('bodyCheckReport.mergedAnalysis was not found in localStorage.');
        return;
    }

    try {
        const response = await fetch('/api/body/viewer-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gender: inferGender(report),
                analysis: report.mergedAnalysis,
            }),
        });
        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.error || 'Viewer model generation failed');
        }

        renderBodyModel(data);
        updateSummary(data.meta || {});
        setRenderState('mesh', 'Result Model');
    } catch (error) {
        const fallbackGlb = GLB_MODELS[0]?.path;
        if (fallbackGlb) {
            if (glbFileSelect) glbFileSelect.value = fallbackGlb;
            await loadViewerGlb(fallbackGlb);
        } else {
            setRenderState('idle', 'Load Failed');
            showErrorLog(`error: ${error.message}`);
        }
    } finally {
        hideLoading();
    }
}

init();
