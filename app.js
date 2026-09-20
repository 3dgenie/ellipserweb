/*! ELlipserWeb | Copyright (c) 2026 ai2-3D. All rights reserved. Unauthorized copying, modification, or redistribution is prohibited. */
"use strict";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $("#measurementCanvas");
const ctx = canvas.getContext("2d");
const PREFS_KEY = "ellipserweb.prefs.v1";
const defaultPrefs = {
styles: {
scale: { color: "#f09a35", lineWidth: 2, units: "mm" },
point: { color: "#19c9d2", lineWidth: 2, pointStyle: "cross", size: 8 },
distance: { color: "#19c9d2", lineWidth: 2 },
angle: { color: "#19c9d2", lineWidth: 2 },
circle: { color: "#19c9d2", lineWidth: 2, showPoints: true },
ellipse: { color: "#19c9d2", lineWidth: 2, showPoints: true },
halfEllipse: { color: "#19c9d2", lineWidth: 2, showPoints: true },
polyline: { color: "#19c9d2", lineWidth: 2 },
polygon: { color: "#19c9d2", lineWidth: 2 },
text: { color: "#19c9d2", lineWidth: 2, fontSize: 18 },
stainCount: { color: "#19c9d2", lineWidth: 2 },
},
};
const styleSettingRows = [
{ type: "scale", name: "Scale", extras: ["units"] },
{ type: "point", name: "Point", extras: ["pointStyle", "size"] },
{ type: "distance", name: "Distance" },
{ type: "angle", name: "Angle" },
{ type: "circle", name: "Circle", extras: ["showPoints"] },
{ type: "ellipse", name: "Ellipse", extras: ["showPoints"] },
{ type: "halfEllipse", name: "Half Ellipse", extras: ["showPoints"] },
{ type: "polyline", name: "Polyline" },
{ type: "polygon", name: "Polygon" },
{ type: "text", name: "Text", extras: ["fontSize"] },
];
function clonePrefs(source = defaultPrefs) {
return JSON.parse(JSON.stringify(source));
}
function mergePrefs(saved) {
const prefs = clonePrefs();
if (!saved || typeof saved !== "object" || !saved.styles || typeof saved.styles !== "object") return prefs;
for (const type of Object.keys(prefs.styles)) {
const incoming = saved.styles[type];
if (incoming && typeof incoming === "object") prefs.styles[type] = { ...prefs.styles[type], ...incoming };
}
return prefs;
}
function loadPrefs() {
try {
return mergePrefs(JSON.parse(localStorage.getItem(PREFS_KEY)));
} catch {
return clonePrefs();
}
}
function savePrefs() {
try {
localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
} catch {}
}
function stylePrefs(type) {
return state.prefs.styles[type] || defaultPrefs.styles.distance;
}
const state = {
project: freshProject(),
projectStarted: false,
activeImageId: null,
selectedObjectId: null,
tool: "select",
prefs: loadPrefs(),
draft: null,
textPoint: null,
dragging: null,
panning: null,
stainMode: null,
dpr: window.devicePixelRatio || 1,
};
function freshProject() {
return { format: "ELlipserWeb Project", version: 1, name: "Untitled Project", caseNumber: "", notes: "", images: [] };
}
function uid(prefix = "id") {
return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function activeImage() {
return state.project.images.find((image) => image.id === state.activeImageId) || null;
}
function selectedObject() {
return activeImage()?.objects.find((object) => object.id === state.selectedObjectId) || null;
}
function unitScale(image = activeImage()) {
if (!image?.calibration) return null;
const pixelLength = distance(image.calibration.p1, image.calibration.p2);
return pixelLength > 0 ? image.calibration.knownLength / pixelLength : null;
}
function distance(a, b) {
return Math.hypot(b.x - a.x, b.y - a.y);
}
function polylineLength(points, closed = false) {
let sum = 0;
for (let i = 1; i < points.length; i++) sum += distance(points[i - 1], points[i]);
if (closed && points.length > 2) sum += distance(points.at(-1), points[0]);
return sum;
}
function polygonArea(points) {
if (points.length < 3) return 0;
return Math.abs(points.reduce((sum, p, i) => {
const q = points[(i + 1) % points.length];
return sum + p.x * q.y - q.x * p.y;
}, 0) / 2);
}
function angleDegrees(a, vertex, c) {
const u = { x: a.x - vertex.x, y: a.y - vertex.y };
const v = { x: c.x - vertex.x, y: c.y - vertex.y };
const denom = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
if (!denom) return 0;
return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / denom))) * 180 / Math.PI;
}
const ELLIPSE_WIDTH_RATIO = .4;
function isEllipseLike(type) {
return ["ellipse", "circle", "halfEllipse"].includes(type);
}
function ellipseAlphaDegrees(object) {
const major = Math.max(Math.abs(object.rx), Math.abs(object.ry));
const minor = Math.min(Math.abs(object.rx), Math.abs(object.ry));
return Math.asin(Math.min(1, minor / Math.max(major, .00001))) * 180 / Math.PI;
}
function ellipseGammaDegrees(object) {
return ((((object.rotation || 0) * 180 / Math.PI) - 90) % 360 + 360) % 360;
}
function rotationFromGammaDegrees(gamma) {
return normalizeAngle((Number(gamma) + 90) * Math.PI / 180);
}
function objectValue(object, image = activeImage()) {
const scale = unitScale(image);
const units = image?.calibration?.units || "px";
const lengthLabel = (pixels) => scale ? `${(pixels * scale).toFixed(2)} ${units}` : `${pixels.toFixed(1)} px`;
if (object.type === "scale") return `${object.knownLength} ${object.units}`;
if (object.type === "distance" || object.type === "reference") return lengthLabel(distance(object.p1, object.p2));
if (object.type === "angle") return `${angleDegrees(object.p1, object.p2, object.p3).toFixed(1)}°`;
if (object.type === "ellipse") {
const major = Math.max(object.rx, object.ry) * 2;
const minor = Math.min(object.rx, object.ry) * 2;
return `${lengthLabel(major)} × ${lengthLabel(minor)} · α ${ellipseAlphaDegrees(object).toFixed(1)}° · γ ${ellipseGammaDegrees(object).toFixed(1)}°`;
}
if (object.type === "halfEllipse") {
return `½L ${lengthLabel(object.rx)} · L ${lengthLabel(object.rx * 2)} × W ${lengthLabel(object.ry * 2)} · α ${ellipseAlphaDegrees(object).toFixed(1)}° · γ ${ellipseGammaDegrees(object).toFixed(1)}°`;
}
if (object.type === "circle") {
const diameter = Math.abs(object.rx) * 2;
return `Ø ${lengthLabel(diameter)}`;
}
if (object.type === "polyline" && !object.closed) return lengthLabel(polylineLength(object.points));
if ((object.type === "polyline" && object.closed) || object.type === "polygon") {
const perimeter = polylineLength(object.points, true);
const areaPx = polygonArea(object.points);
const area = scale ? `${(areaPx * scale * scale).toFixed(2)} ${units}²` : `${areaPx.toFixed(0)} px²`;
return `P ${lengthLabel(perimeter)} · A ${area}`;
}
if (object.type === "point") return `${Math.round(object.p.x)}, ${Math.round(object.p.y)} px`;
if (object.type === "text") return object.text;
if (object.type === "stainCount") {
const count = sessionStains(object, image).length;
return `${count} stain${count === 1 ? "" : "s"}`;
}
return "—";
}
function imagePoint(event) {
const image = activeImage();
const rect = canvas.getBoundingClientRect();
if (!image) return { x: 0, y: 0 };
return {
x: (event.clientX - rect.left - image.view.panX) / image.view.zoom,
y: (event.clientY - rect.top - image.view.panY) / image.view.zoom,
};
}
function fitActiveImage() {
const image = activeImage();
if (!image || !canvas.clientWidth || !canvas.clientHeight) return;
const padding = 32;
image.view.zoom = Math.min((canvas.clientWidth - padding * 2) / image.width, (canvas.clientHeight - padding * 2) / image.height);
image.view.zoom = Math.max(.01, image.view.zoom);
image.view.panX = (canvas.clientWidth - image.width * image.view.zoom) / 2;
image.view.panY = (canvas.clientHeight - image.height * image.view.zoom) / 2;
draw();
}
function resizeCanvas() {
const rect = canvas.getBoundingClientRect();
state.dpr = window.devicePixelRatio || 1;
canvas.width = Math.max(1, Math.round(rect.width * state.dpr));
canvas.height = Math.max(1, Math.round(rect.height * state.dpr));
draw();
}
function draw(targetCtx = ctx, image = activeImage(), exportMode = false) {
const targetCanvas = targetCtx.canvas;
const dpr = exportMode ? 1 : state.dpr;
targetCtx.setTransform(1, 0, 0, 1, 0, 0);
targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
if (!image?.element) return;
const zoom = exportMode ? 1 : image.view.zoom;
const panX = exportMode ? 0 : image.view.panX;
const panY = exportMode ? 0 : image.view.panY;
targetCtx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr);
targetCtx.drawImage(image.element, 0, 0, image.width, image.height);
if (!exportMode && image.id === state.activeImageId && (state.tool === "stainCount" || state.stainMode || selectedObject()?.type === "stainCount")) drawStainMask(targetCtx, image);
for (const object of image.objects) {
if (object.visible === false) continue;
drawObject(targetCtx, object, zoom, object.id === state.selectedObjectId, exportMode);
}
if (state.draft && image.id === state.activeImageId) drawDraft(targetCtx, state.draft, zoom);
}
function lineStyle(drawCtx, object, zoom) {
drawCtx.strokeStyle = object.color || "#19c9d2";
drawCtx.fillStyle = object.color || "#19c9d2";
drawCtx.lineWidth = (object.lineWidth || 2) / zoom;
drawCtx.lineCap = "round";
drawCtx.lineJoin = "round";
drawCtx.setLineDash([]);
}
function drawObject(drawCtx, object, zoom, isSelected, exportMode) {
const showLabel = exportMode || isSelected;
const showHandles = isSelected && !exportMode;
drawCtx.save();
lineStyle(drawCtx, object, zoom);
if (object.type === "distance" || object.type === "scale" || object.type === "reference") {
drawCtx.beginPath(); drawCtx.moveTo(object.p1.x, object.p1.y); drawCtx.lineTo(object.p2.x, object.p2.y); drawCtx.stroke();
if (showLabel) drawLabel(drawCtx, objectValue(object), midpoint(object.p1, object.p2), zoom);
if (showHandles) drawHandles(drawCtx, [object.p1, object.p2], zoom);
} else if (object.type === "angle") {
drawCtx.beginPath(); drawCtx.moveTo(object.p1.x, object.p1.y); drawCtx.lineTo(object.p2.x, object.p2.y); drawCtx.lineTo(object.p3.x, object.p3.y); drawCtx.stroke();
if (showLabel) drawLabel(drawCtx, objectValue(object), object.p2, zoom);
if (showHandles) drawHandles(drawCtx, [object.p1, object.p2, object.p3], zoom);
} else if (object.type === "halfEllipse") {
drawCtx.beginPath();
drawCtx.ellipse(object.cx, object.cy, Math.abs(object.rx), Math.abs(object.ry), object.rotation || 0, -Math.PI / 2, Math.PI / 2);
drawCtx.closePath();
drawCtx.stroke();
if (object.stainNumber) drawLabel(drawCtx, String(object.stainNumber), rotateEllipsePoint(object, object.rx, 0), zoom);
if (showLabel) drawLabel(drawCtx, objectValue(object), rotateEllipsePoint(object, object.rx, -object.ry), zoom);
if (showHandles) drawEllipseControls(drawCtx, object, zoom);
} else if (object.type === "stainCount") {
drawCtx.setLineDash([8 / zoom, 6 / zoom]);
drawCtx.strokeStyle = "#19c9d2";
drawPolygonPath(drawCtx, object.detectRegion, true);
drawCtx.strokeStyle = "#e06a6a";
(object.excludeRegions || []).forEach((region) => drawPolygonPath(drawCtx, region, true));
drawCtx.setLineDash([]);
} else if (object.type === "ellipse" || object.type === "circle") {
drawCtx.beginPath(); drawCtx.ellipse(object.cx, object.cy, Math.abs(object.rx), Math.abs(object.ry), object.rotation || 0, 0, Math.PI * 2); drawCtx.stroke();
const labelPoint = rotateEllipsePoint(object, object.rx, -object.ry);
if (showLabel) drawLabel(drawCtx, objectValue(object), labelPoint, zoom);
if (showHandles) drawEllipseControls(drawCtx, object, zoom);
} else if (object.type === "polyline" || object.type === "polygon") {
if (object.points.length) {
drawCtx.beginPath(); drawCtx.moveTo(object.points[0].x, object.points[0].y);
object.points.slice(1).forEach((point) => drawCtx.lineTo(point.x, point.y));
if (object.type === "polygon" || object.closed) drawCtx.closePath();
drawCtx.stroke();
if (showLabel) drawLabel(drawCtx, objectValue(object), object.points[0], zoom);
if (showHandles) drawHandles(drawCtx, object.points, zoom);
}
} else if (object.type === "point") {
drawPointMarker(drawCtx, object, zoom);
if (showLabel) drawLabel(drawCtx, objectValue(object), object.p, zoom);
if (showHandles) drawHandles(drawCtx, [object.p], zoom);
} else if (object.type === "text") {
drawCtx.font = `${(object.fontSize || 18) / zoom}px Inter, sans-serif`;
drawCtx.fillText(object.text, object.p.x, object.p.y);
if (showHandles) drawHandles(drawCtx, [object.p], zoom);
}
drawCtx.restore();
}
function drawDraft(drawCtx, draft, zoom) {
drawCtx.save();
lineStyle(drawCtx, { color: "#f09a35", lineWidth: 2 }, zoom);
drawCtx.setLineDash([7 / zoom, 5 / zoom]);
const points = draft.points || [];
if (draft.type === "ellipse" && draft.start && draft.current) {
const geometry = ellipseFromDrag(draft.start, draft.current, false);
drawCtx.beginPath();
drawCtx.ellipse(geometry.cx, geometry.cy, geometry.rx, geometry.ry, geometry.rotation, 0, Math.PI * 2);
drawCtx.stroke();
} else if (draft.type === "halfEllipse" && draft.start && draft.current) {
const geometry = ellipseFromDrag(draft.start, draft.current, true);
drawCtx.beginPath();
drawCtx.ellipse(geometry.cx, geometry.cy, geometry.rx, geometry.ry, geometry.rotation, -Math.PI / 2, Math.PI / 2);
drawCtx.closePath();
drawCtx.stroke();
} else if (draft.type === "circle" && draft.start && draft.current) {
const radius = distance(draft.start, draft.current);
drawCtx.beginPath(); drawCtx.arc(draft.start.x, draft.start.y, radius, 0, Math.PI * 2); drawCtx.stroke();
} else if (draft.type === "stainSample" && draft.start && draft.current) {
drawCtx.beginPath();
drawCtx.moveTo(draft.start.x, draft.start.y);
drawCtx.lineTo(draft.current.x, draft.current.y);
drawCtx.stroke();
} else if (points.length) {
drawCtx.beginPath(); drawCtx.moveTo(points[0].x, points[0].y);
points.slice(1).forEach((point) => drawCtx.lineTo(point.x, point.y));
if (draft.closeCandidate && points.length > 2) drawCtx.lineTo(points[0].x, points[0].y);
else if (draft.current) drawCtx.lineTo(draft.current.x, draft.current.y);
drawCtx.stroke();
drawHandles(drawCtx, points, zoom);
}
drawCtx.restore();
}
function drawPointMarker(drawCtx, object, zoom) {
const reach = Math.max(2, object.size || 8) / zoom;
const { x, y } = object.p;
const style = object.pointStyle || "cross";
if (style === "dot") {
drawCtx.beginPath();
drawCtx.arc(x, y, reach * .55, 0, Math.PI * 2);
drawCtx.fill();
return;
}
drawCtx.beginPath();
drawCtx.moveTo(x - reach, y); drawCtx.lineTo(x + reach, y);
drawCtx.moveTo(x, y - reach); drawCtx.lineTo(x, y + reach);
drawCtx.stroke();
if (style === "crosshair") {
drawCtx.beginPath();
drawCtx.arc(x, y, reach * .55, 0, Math.PI * 2);
drawCtx.stroke();
}
}
function drawHandles(drawCtx, points, zoom) {
const radius = 5 / zoom;
points.forEach((point) => {
drawCtx.beginPath(); drawCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
drawCtx.fillStyle = "#ffffff"; drawCtx.fill();
drawCtx.lineWidth = 2 / zoom; drawCtx.strokeStyle = "#f09a35"; drawCtx.stroke();
});
}
function drawLabel(drawCtx, text, point, zoom) {
if (!text) return;
const fontSize = 13 / zoom;
drawCtx.font = `600 ${fontSize}px Inter, sans-serif`;
const width = drawCtx.measureText(text).width;
const pad = 5 / zoom;
const x = point.x + 8 / zoom;
const y = point.y - 8 / zoom;
drawCtx.fillStyle = "rgba(0, 0, 0, .82)";
drawCtx.fillRect(x - pad, y - fontSize - pad / 2, width + pad * 2, fontSize + pad);
drawCtx.fillStyle = "#ffffff";
drawCtx.fillText(text, x, y);
}
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function rotateEllipsePoint(object, localX, localY) {
const angle = object.rotation || 0;
const cos = Math.cos(angle), sin = Math.sin(angle);
return { x: object.cx + localX * cos - localY * sin, y: object.cy + localX * sin + localY * cos };
}
function ellipseLocalPoint(object, point) {
const angle = -(object.rotation || 0);
const dx = point.x - object.cx, dy = point.y - object.cy;
const cos = Math.cos(angle), sin = Math.sin(angle);
return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}
function ellipseFromDrag(tip, back, half) {
const center = half ? back : midpoint(tip, back);
const rx = Math.max(1, distance(tip, center));
return {
cx: center.x, cy: center.y, rx, ry: Math.max(1, rx * ELLIPSE_WIDTH_RATIO),
rotation: Math.atan2(tip.y - center.y, tip.x - center.x),
};
}
function normalizeEllipse(object) {
object.rx = Math.max(1, Math.abs(object.rx));
object.ry = Math.max(1, Math.abs(object.ry));
if (object.type === "circle") {
const radius = Math.max(object.rx, object.ry);
object.rx = radius;
object.ry = radius;
object.rotation = 0;
return object;
}
if (object.type === "halfEllipse") {
object.ry = Math.min(object.ry, object.rx);
object.rotation = normalizeAngle(object.rotation || 0);
return object;
}
if (object.ry > object.rx) {
[object.rx, object.ry] = [object.ry, object.rx];
object.rotation = (object.rotation || 0) + Math.PI / 2;
}
object.rotation = normalizeAngle(object.rotation || 0);
return object;
}
function normalizeAngle(angle) {
while (angle > Math.PI) angle -= Math.PI * 2;
while (angle <= -Math.PI) angle += Math.PI * 2;
return angle;
}
function ellipseControls(object, zoom) {
const tailLength = 38 / Math.max(zoom, .01);
const half = object.type === "halfEllipse";
const controls = [
{ role: "center", ...rotateEllipsePoint(object, 0, 0) },
{ role: "major-end", ...rotateEllipsePoint(object, object.rx, 0) },
{ role: "minor-start", ...rotateEllipsePoint(object, 0, -object.ry) },
{ role: "minor-end", ...rotateEllipsePoint(object, 0, object.ry) },
];
if (!half) controls.splice(1, 0, { role: "major-start", ...rotateEllipsePoint(object, -object.rx, 0) });
if (object.type !== "circle") controls.push({ role: "rotation", ...rotateEllipsePoint(object, half ? -tailLength : -object.rx - tailLength, 0) });
return controls;
}
function drawEllipseControls(drawCtx, object, zoom) {
const controls = ellipseControls(object, zoom);
const majorStart = controls.find((control) => control.role === "major-start") || controls.find((control) => control.role === "center");
const rotation = controls.find((control) => control.role === "rotation");
drawCtx.save();
drawCtx.strokeStyle = "#f09a35";
drawCtx.lineWidth = 1.5 / zoom;
if (rotation) {
drawCtx.setLineDash([5 / zoom, 4 / zoom]);
drawCtx.beginPath();
drawCtx.moveTo(majorStart.x, majorStart.y);
drawCtx.lineTo(rotation.x, rotation.y);
drawCtx.stroke();
}
drawCtx.setLineDash([]);
controls.forEach((control) => {
const radius = control.role === "rotation" ? 6 / zoom : 5 / zoom;
drawCtx.beginPath();
drawCtx.arc(control.x, control.y, radius, 0, Math.PI * 2);
drawCtx.fillStyle = control.role === "center" ? "#f09a35" : control.role === "rotation" ? "#0b2238" : "#ffffff";
drawCtx.fill();
drawCtx.lineWidth = 2 / zoom;
drawCtx.strokeStyle = "#f09a35";
drawCtx.stroke();
if (control.role === "center") {
drawCtx.strokeStyle = "#0b2238";
drawCtx.lineWidth = 1.5 / zoom;
drawCtx.beginPath();
drawCtx.moveTo(control.x - 3 / zoom, control.y); drawCtx.lineTo(control.x + 3 / zoom, control.y);
drawCtx.moveTo(control.x, control.y - 3 / zoom); drawCtx.lineTo(control.x, control.y + 3 / zoom);
drawCtx.stroke();
}
});
drawCtx.restore();
}
async function addImageFiles(files) {
const valid = [...files].filter((file) => file.type.startsWith("image/"));
for (const file of valid) {
const bytes = new Uint8Array(await file.arrayBuffer());
const dataUrl = await fileToDataUrl(file);
try {
const element = await loadImage(dataUrl);
state.project.images.push({
id: uid("img"), name: file.name, mime: file.type || "image/jpeg", bytes,
width: element.naturalWidth, height: element.naturalHeight, element,
calibration: null, objects: [], view: { zoom: 1, panX: 0, panY: 0 },
});
} catch {
alert(`${file.name} could not be opened by this browser.`);
}
}
if (!state.activeImageId && state.project.images.length) state.activeImageId = state.project.images[0].id;
refreshUI();
requestAnimationFrame(fitActiveImage);
}
async function loadSampleImage() {
closeSettingsDialog();
if (!state.projectStarted) {
state.project = freshProject();
state.projectStarted = true;
state.project.name = "Sample Measurement Scene";
populateProjectMetadata();
}
const blob = await createSampleSceneBlob();
const file = new File([blob], "sample-scene.png", { type: "image/png" });
await addImageFiles([file]);
}
function createSampleSceneBlob() {
const width = 1200;
const height = 800;
const sample = document.createElement("canvas");
sample.width = width;
sample.height = height;
const drawCtx = sample.getContext("2d");
drawCtx.fillStyle = "#edf2f5";
drawCtx.fillRect(0, 0, width, height);
drawCtx.fillStyle = "#d8e1e7";
for (let x = 0; x <= width; x += 100) {
drawCtx.fillRect(x, 0, 1, height);
}
for (let y = 0; y <= height; y += 100) {
drawCtx.fillRect(0, y, width, 1);
}
drawCtx.fillStyle = "#1f4968";
drawCtx.fillRect(100, 100, 400, 400);
drawCtx.fillStyle = "#f7fafc";
drawCtx.font = "600 22px Inter, sans-serif";
drawCtx.fillText("400 px square", 180, 310);
drawCtx.beginPath();
drawCtx.arc(850, 250, 100, 0, Math.PI * 2);
drawCtx.fillStyle = "#c97115";
drawCtx.fill();
drawCtx.fillStyle = "#071522";
drawCtx.fillText("Ø 200 px", 800, 256);
drawCtx.strokeStyle = "#0b2238";
drawCtx.lineWidth = 4;
drawCtx.beginPath();
drawCtx.moveTo(700, 520);
drawCtx.lineTo(1000, 520);
drawCtx.lineTo(700, 720);
drawCtx.closePath();
drawCtx.stroke();
drawCtx.fillStyle = "#0b2238";
drawCtx.fillText("300 × 200 px triangle", 730, 500);
drawCtx.strokeStyle = "#f09a35";
drawCtx.lineWidth = 8;
drawCtx.beginPath();
drawCtx.moveTo(100, 760);
drawCtx.lineTo(600, 760);
drawCtx.stroke();
drawCtx.fillStyle = "#c97115";
drawCtx.fillRect(96, 752, 8, 16);
drawCtx.fillRect(596, 752, 8, 16);
drawCtx.font = "700 20px Inter, sans-serif";
drawCtx.fillText("SCALE 500 px  =  500 mm", 100, 740);
return new Promise((resolve) => sample.toBlob(resolve, "image/png"));
}
function fileToDataUrl(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = reject;
reader.readAsDataURL(file);
});
}
function loadImage(src) {
return new Promise((resolve, reject) => {
const image = new Image();
image.onload = () => resolve(image);
image.onerror = reject;
image.src = src;
});
}
const ellipseVariants = {
ellipse: { name: "Ellipse", title: "Ellipse (E)", icon: `<ellipse cx="16" cy="12" rx="12.5" ry="7.5"></ellipse>` },
halfEllipse: { name: "Half", title: "Half Ellipse (H)", icon: `<path d="M16 4.5A12.5 7.5 0 0 1 16 19.5Z"></path>` },
};
function setEllipseVariant(variant) {
const button = $("#ellipseTool");
const config = ellipseVariants[variant];
button.dataset.tool = variant;
button.title = config.title;
button.querySelector(".tool-icon").innerHTML = config.icon;
button.querySelector(".tool-name").textContent = config.name;
$$("#ellipseFlyout button").forEach((option) => option.classList.toggle("active", option.dataset.variant === variant));
}
const pointStyles = {
cross: { name: "Cross", icon: `<path d="M16 5v14M9 12h14"></path>` },
dot: { name: "Dot", icon: `<circle cx="16" cy="12" r="4.5" style="fill: currentColor; stroke: none"></circle>` },
crosshair: { name: "Crosshair", icon: `<circle cx="16" cy="12" r="5"></circle><path d="M16 4v16M8 12h16"></path>` },
};
function setPointStyle(style) {
const chosen = pointStyles[style] ? style : "cross";
state.prefs.styles.point.pointStyle = chosen;
savePrefs();
if ($("#measureTool")?.dataset.tool === "point") setMeasureVariant("point");
}
const measureVariants = {
point: { title: "Point (P)", shortcut: "P" },
distance: { title: "Distance (D)", shortcut: "D" },
angle: { title: "Angle (A)", shortcut: "A" },
};
function measureVariantIcon(variant) {
if (variant === "point") return (pointStyles[stylePrefs("point").pointStyle] || pointStyles.cross).icon;
if (variant === "angle") return `<path d="M5 19L13 5L25 19"></path><path d="M10 14.5a7 7 0 0 0 8 0"></path>`;
return `<path d="M7 16.5L17 7.5"></path><circle cx="7" cy="16.5" r="1.7" style="fill: currentColor; stroke: none"></circle><circle cx="17" cy="7.5" r="1.7" style="fill: currentColor; stroke: none"></circle>`;
}
function setMeasureVariant(variant) {
const button = $("#measureTool");
const config = measureVariants[variant];
if (!button || !config) return;
button.dataset.tool = variant;
button.title = `${config.title} — Measure`;
button.querySelector(".tool-icon").innerHTML = measureVariantIcon(variant);
$$("#measureFlyout button").forEach((option) => option.classList.toggle("active", option.dataset.variant === variant));
}
function toggleFlyout(toggle, open) {
const flyout = $(`#${toggle.getAttribute("aria-controls")}`);
const show = open ?? flyout.hidden;
if (show) {
$$(".tool-variant").forEach((other) => { if (other !== toggle) toggleFlyout(other, false); });
const rect = toggle.getBoundingClientRect();
flyout.hidden = false;
flyout.style.left = `${rect.right + 6}px`;
flyout.style.top = `${Math.min(rect.top - 24, window.innerHeight - flyout.offsetHeight - 12)}px`;
} else {
flyout.hidden = true;
}
toggle.setAttribute("aria-expanded", String(show));
}
function closeFlyouts() {
flyoutPinned.clear();
$$(".tool-variant").forEach((toggle) => toggleFlyout(toggle, false));
}
const flyoutHideTimers = new Map();
const flyoutPinned = new Set();
function bindFlyoutHover(toggle) {
const flyout = $(`#${toggle.getAttribute("aria-controls")}`);
const show = () => {
clearTimeout(flyoutHideTimers.get(toggle));
toggleFlyout(toggle, true);
};
const hide = () => {
if (flyoutPinned.has(toggle)) return;
clearTimeout(flyoutHideTimers.get(toggle));
flyoutHideTimers.set(toggle, setTimeout(() => toggleFlyout(toggle, false), 200));
};
toggle.addEventListener("pointerenter", show);
toggle.addEventListener("pointerleave", hide);
flyout.addEventListener("pointerenter", show);
flyout.addEventListener("pointerleave", hide);
}
function setTool(tool) {
if (tool === "stainCount" && !activeImage()?.calibration) {
updateHint("Create a scale on this image before counting stains.");
return;
}
if (tool !== "stainCount") state.stainMode = null;
const keepStainSession = tool === "stainCount";
const clearedSelection = tool !== "select" && !keepStainSession && state.selectedObjectId !== null;
if (clearedSelection) state.selectedObjectId = null;
state.tool = tool;
state.draft = null;
if (ellipseVariants[tool]) setEllipseVariant(tool);
if (measureVariants[tool]) setMeasureVariant(tool);
if (keepStainSession) {
const session = ensureStainSession();
if (session) state.selectedObjectId = session.id;
}
$$(".tool[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
canvas.style.cursor = tool === "select" ? "default" : "crosshair";
updateHint();
if (clearedSelection || keepStainSession) {
renderStructure();
renderProperties();
renderMeasurements();
}
draw();
}
function updateHint(message = "") {
const hints = {
scale: "Click two points, then enter the known length in Properties.",
point: "Click to place a point marker. The tool stays active; right-click or press Escape when finished.",
distance: "Click the start and end points.",
angle: "Click three points; the second point is the vertex.",
circle: "Click the center and drag to set the radius.",
ellipse: "Drag from the leading tip back to the trailing tip, then set the width with the side handles.",
halfEllipse: "Drag from the leading tip back to the middle of the width, then set the width with the side handles.",
polyline: "Click points. Click the first point to close, or right-click to finish open.",
polygon: "Click boundary points. Click the first point to close, or right-click to close when possible.",
text: "Click the image to place a text annotation. A window will ask for the wording, color, and size.",
stainCount: stainCountHint(),
};
const hint = message || hints[state.tool] || "";
$("#drawingHint").textContent = hint;
$("#drawingHint").hidden = !hint;
}
function makeObject(type, data) {
const image = activeImage();
const count = image.objects.filter((object) => object.type === type).length + 1;
const label = ({ scale: "Scale", point: "Point", distance: "Distance", angle: "Angle", circle: "Circle", ellipse: "Ellipse", halfEllipse: "Half Ellipse", polyline: "Polyline", polygon: "Polygon", text: "Text", stainCount: "Stains" })[type];
const style = stylePrefs(type);
return { id: uid(type), type, name: `${label} ${count}`, visible: true, locked: false, color: style.color, lineWidth: style.lineWidth, ...data };
}
function completeObject(object, keepTool = false) {
const image = activeImage();
image.objects.push(object);
if (object.type === "scale") {
object.knownLength = 100;
object.units = stylePrefs("scale").units || "mm";
image.calibration = object;
}
state.selectedObjectId = object.id;
state.draft = null;
if (!keepTool) setTool("select");
refreshUI();
}
const stainMaskCache = new Map();
function stainCountHint() {
if (state.stainMode === "stainColor") return "Click a typical stain body to sample its color.";
if (state.stainMode === "backgroundColor") return "Click the surface next to the stains to sample the background.";
if (state.stainMode === "smallSize") return "Drag across a typical small stain.";
if (state.stainMode === "largeSize") return "Drag across a typical large stain.";
if (state.stainMode === "detect") return "Click points around the search area. Click the first point or right-click to close.";
if (state.stainMode === "exclude") return "Click points around an area to skip. Click the first point or right-click to close.";
if (state.stainMode === "manual") return "Drag from the leading tip back to the width, like Half Ellipse. Right-click when finished.";
return "Sample stain and background colors, then Auto Detect. Use Manually Mark for stains the detector misses.";
}
function stainSession(image = activeImage()) {
return image?.objects.find((object) => object.type === "stainCount") || null;
}
function sessionStains(session, image = activeImage()) {
if (!session || !image) return [];
return image.objects.filter((object) => object.sessionId === session.id);
}
function ensureStainSession(image = activeImage()) {
if (!image) return null;
let session = stainSession(image);
if (session) return session;
session = makeObject("stainCount", {
stainColor: null,
backgroundColor: null,
smallSize: null,
largeSize: null,
detectRegion: [],
excludeRegions: [],
separation: 35,
sizeTune: 20,
fill: 40,
});
image.objects.push(session);
return session;
}
function setStainMode(mode) {
state.stainMode = mode;
state.draft = null;
updateHint();
draw();
}
function invalidateStainMask(session) {
if (session) stainMaskCache.delete(session.id);
}
function rgbFromHex(hex) {
const value = parseInt(String(hex || "").replace("#", ""), 16);
if (!Number.isFinite(value)) return null;
return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}
function hexFromRgb(rgb) {
return `#${[rgb.r, rgb.g, rgb.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
function colorDistance(a, b) {
return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}
function pointInPolygon(point, polygon) {
if (!polygon || polygon.length < 3) return false;
let inside = false;
for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
const a = polygon[i];
const b = polygon[j];
const crosses = (a.y > point.y) !== (b.y > point.y);
if (crosses && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
}
return inside;
}
function inDetectRegion(point, session) {
if (!session.detectRegion?.length) return true;
return pointInPolygon(point, session.detectRegion);
}
function inExcludeRegion(point, session) {
return (session.excludeRegions || []).some((region) => pointInPolygon(point, region));
}
function drawPolygonPath(drawCtx, points, closed) {
if (!points?.length) return;
drawCtx.beginPath();
drawCtx.moveTo(points[0].x, points[0].y);
points.slice(1).forEach((point) => drawCtx.lineTo(point.x, point.y));
if (closed) drawCtx.closePath();
drawCtx.stroke();
}
function ensureImagePixels(image) {
if (image._pixels) return image._pixels;
const buffer = document.createElement("canvas");
buffer.width = image.width;
buffer.height = image.height;
const bufferCtx = buffer.getContext("2d", { willReadFrequently: true });
bufferCtx.drawImage(image.element, 0, 0);
image._pixels = bufferCtx.getImageData(0, 0, image.width, image.height);
return image._pixels;
}
function sampleImageColor(image, point) {
const pixels = ensureImagePixels(image);
const x = Math.max(0, Math.min(image.width - 1, Math.round(point.x)));
const y = Math.max(0, Math.min(image.height - 1, Math.round(point.y)));
const i = (y * image.width + x) * 4;
return hexFromRgb({ r: pixels.data[i], g: pixels.data[i + 1], b: pixels.data[i + 2] });
}
function stainMaskKey(session) {
return JSON.stringify({
stainColor: session.stainColor,
backgroundColor: session.backgroundColor,
detectRegion: session.detectRegion,
excludeRegions: session.excludeRegions,
separation: session.separation,
});
}
function buildStainMask(image, session) {
const stain = rgbFromHex(session.stainColor);
const background = rgbFromHex(session.backgroundColor);
if (!stain || !background) return null;
const key = stainMaskKey(session);
const cached = stainMaskCache.get(session.id);
if (cached?.key === key) return cached;
const pixels = ensureImagePixels(image);
const scale = Math.min(1, 900 / Math.max(image.width, image.height));
const width = Math.max(1, Math.round(image.width * scale));
const height = Math.max(1, Math.round(image.height * scale));
const mask = new Uint8Array(width * height);
const pairDist = Math.max(1, colorDistance(stain, background));
const threshold = (Number(session.separation) || 0) / 100 * pairDist * 0.55;
for (let y = 0; y < height; y++) {
for (let x = 0; x < width; x++) {
const ix = Math.min(image.width - 1, Math.round(x / scale));
const iy = Math.min(image.height - 1, Math.round(y / scale));
const point = { x: ix, y: iy };
if (!inDetectRegion(point, session) || inExcludeRegion(point, session)) continue;
const i = (iy * image.width + ix) * 4;
const rgb = { r: pixels.data[i], g: pixels.data[i + 1], b: pixels.data[i + 2] };
if (colorDistance(rgb, background) - colorDistance(rgb, stain) > threshold) mask[y * width + x] = 1;
}
}
const overlay = document.createElement("canvas");
overlay.width = width;
overlay.height = height;
const overlayCtx = overlay.getContext("2d");
const overlayData = overlayCtx.createImageData(width, height);
for (let i = 0; i < mask.length; i++) {
if (!mask[i]) continue;
overlayData.data[i * 4] = 25;
overlayData.data[i * 4 + 1] = 201;
overlayData.data[i * 4 + 2] = 210;
overlayData.data[i * 4 + 3] = 90;
}
overlayCtx.putImageData(overlayData, 0, 0);
const result = { key, scale, width, height, mask, overlay };
stainMaskCache.set(session.id, result);
return result;
}
function drawStainMask(drawCtx, image) {
const session = stainSession(image);
if (!session) return;
const built = buildStainMask(image, session);
if (!built) return;
drawCtx.save();
drawCtx.imageSmoothingEnabled = false;
drawCtx.drawImage(built.overlay, 0, 0, image.width, image.height);
drawCtx.restore();
}
function connectedComponents(mask, width, height) {
const seen = new Uint8Array(mask.length);
const blobs = [];
const stack = [];
for (let start = 0; start < mask.length; start++) {
if (!mask[start] || seen[start]) continue;
const pixels = [];
stack.push(start);
seen[start] = 1;
let minX = width, minY = height, maxX = 0, maxY = 0;
while (stack.length) {
const index = stack.pop();
const x = index % width;
const y = (index - x) / width;
pixels.push({ x, y });
minX = Math.min(minX, x);
maxX = Math.max(maxX, x);
minY = Math.min(minY, y);
maxY = Math.max(maxY, y);
for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
const neighbor = ny * width + nx;
if (!mask[neighbor] || seen[neighbor]) continue;
seen[neighbor] = 1;
stack.push(neighbor);
}
}
blobs.push({ pixels, minX, minY, maxX, maxY, area: pixels.length });
}
return blobs;
}
function fitHalfLength(pixels) {
const n = pixels.length;
if (n < 12) return null;
let mx = 0, my = 0;
for (const p of pixels) { mx += p.x; my += p.y; }
mx /= n;
my /= n;
let xx = 0, xy = 0, yy = 0;
for (const p of pixels) {
const dx = p.x - mx, dy = p.y - my;
xx += dx * dx;
xy += dx * dy;
yy += dy * dy;
}
const theta = 0.5 * Math.atan2(2 * xy, xx - yy || 1e-9);
const ux = Math.cos(theta), uy = Math.sin(theta);
const vx = -uy, vy = ux;
let tMin = Infinity, tMax = -Infinity;
for (const p of pixels) {
const t = (p.x - mx) * ux + (p.y - my) * uy;
tMin = Math.min(tMin, t);
tMax = Math.max(tMax, t);
}
const span = tMax - tMin;
if (span < 4) return null;
const step = Math.max(1, span / 36);
const band = Math.max(1.2, step * 0.9);
const widthAt = (t0) => {
let sMin = Infinity, sMax = -Infinity, count = 0;
for (const p of pixels) {
const t = (p.x - mx) * ux + (p.y - my) * uy;
if (Math.abs(t - t0) > band) continue;
const s = (p.x - mx) * vx + (p.y - my) * vy;
sMin = Math.min(sMin, s);
sMax = Math.max(sMax, s);
count++;
}
return count < 3 ? 0 : sMax - sMin;
};
const wStart = widthAt(tMin + step);
const wEnd = widthAt(tMax - step);
if (!wStart && !wEnd) return null;
const tipIsMin = wStart <= wEnd;
const tTip = tipIsMin ? tMin : tMax;
const tBack = tipIsMin ? tMax : tMin;
const dir = tipIsMin ? 1 : -1;
const profile = [];
for (let t = tTip; dir > 0 ? t <= tBack : t >= tBack; t += dir * step) profile.push({ t, w: widthAt(t) });
if (profile.length < 6) return null;
const smooth = profile.map((item, i) => {
const prev = profile[Math.max(0, i - 1)].w;
const next = profile[Math.min(profile.length - 1, i + 1)].w;
return { t: item.t, w: (prev + item.w + next) / 3 };
});
const start = Math.max(2, Math.floor(smooth.length * 0.1));
const limit = Math.floor(smooth.length * 0.7);
let peak = -1;
for (let i = start; i < limit - 1; i++) {
if (smooth[i].w >= smooth[i - 1].w && smooth[i].w >= smooth[i + 1].w && smooth[i].w > smooth[start].w * 1.12) {
peak = i;
break;
}
}
if (peak < 0) {
let best = start;
for (let i = start; i < limit; i++) if (smooth[i].w > smooth[best].w) best = i;
if (smooth[best].w <= smooth[start].w * 1.08) return null;
peak = best;
}
const halfLen = Math.abs(smooth[peak].t - tTip);
const width = smooth[peak].w;
if (halfLen < 2 || width < 1.5) return null;
const ratio = width / (halfLen * 2);
if (ratio < 0.12 || ratio > 0.95) return null;
const tip = { x: mx + tTip * ux, y: my + tTip * uy };
const equator = { x: mx + smooth[peak].t * ux, y: my + smooth[peak].t * uy };
const center = midpoint(tip, equator);
return {
cx: center.x,
cy: center.y,
rx: Math.max(1, halfLen),
ry: Math.max(1, width / 2),
rotation: Math.atan2(tip.y - center.y, tip.x - center.x),
};
}
function stainSizeBand(session) {
let small = Number(session.smallSize);
let large = Number(session.largeSize);
if (!Number.isFinite(small) || !Number.isFinite(large)) return { min: 4, max: 400 };
if (small > large) [small, large] = [large, small];
const half = Math.max(1, (large - small) / 2);
const shrink = (Number(session.sizeTune) || 0) / 100 * half * 0.85;
return { min: Math.max(2, small + shrink), max: Math.max(small + 1, large - shrink) };
}
function autoDetectStains() {
const image = activeImage();
const session = stainSession(image);
if (!image || !session) return;
if (!session.stainColor || !session.backgroundColor) {
updateHint("Sample a stain color and a background color first.");
return;
}
const built = buildStainMask(image, session);
if (!built) return;
const band = stainSizeBand(session);
const minSolidity = 0.18 + (Number(session.fill) || 0) / 100 * 0.55;
const blobs = connectedComponents(built.mask, built.width, built.height);
const kept = [];
for (const blob of blobs) {
const bw = blob.maxX - blob.minX + 1;
const bh = blob.maxY - blob.minY + 1;
if (blob.area / Math.max(1, bw * bh) < minSolidity) continue;
const fit = fitHalfLength(blob.pixels.map((p) => ({ x: p.x / built.scale, y: p.y / built.scale })));
if (!fit) continue;
const size = Math.max(fit.rx * 2, fit.ry * 2);
if (size < band.min || size > band.max) continue;
kept.push(fit);
}
image.objects = image.objects.filter((object) => !(object.sessionId === session.id && object.source === "auto"));
for (const geometry of kept) addStain(session, geometry, "auto");
renumberStains(session);
state.selectedObjectId = session.id;
state.stainMode = null;
updateHint(kept.length ? `Detected ${kept.length} stain${kept.length === 1 ? "" : "s"}.` : "No stains matched the samples. Adjust sliders or mark stains by hand.");
refreshUI();
}
function addStain(session, geometry, source) {
const image = activeImage();
const object = normalizeEllipse(makeObject("halfEllipse", {
...geometry,
showPoints: false,
sessionId: session.id,
source,
stainNumber: 0,
}));
image.objects.push(object);
return object;
}
function completeManualStain(geometry) {
const session = ensureStainSession();
addStain(session, geometry, "manual");
renumberStains(session);
state.draft = null;
refreshUI();
}
function renumberStains(session, image = activeImage()) {
sessionStains(session, image).sort((a, b) => a.cy - b.cy || a.cx - b.cx).forEach((stain, index) => {
stain.stainNumber = index + 1;
stain.name = `Stain ${index + 1}`;
});
}
function finishStainPolygon() {
const session = stainSession();
if (!session || !state.draft?.points) return;
const points = state.draft.points.slice();
if (points.length < 3) {
state.draft = null;
draw();
return;
}
if (state.draft.type === "stainDetect") session.detectRegion = points;
if (state.draft.type === "stainExclude") session.excludeRegions = [...(session.excludeRegions || []), points];
invalidateStainMask(session);
state.draft = null;
state.stainMode = null;
refreshUI();
}
function handleStainPointerDown(event, point, image) {
const mode = state.stainMode;
if (!mode) return false;
if (mode === "stainColor" || mode === "backgroundColor") {
const session = ensureStainSession();
session[mode] = sampleImageColor(image, point);
invalidateStainMask(session);
state.stainMode = null;
updateHint(mode === "stainColor" ? "Stain color sampled." : "Background color sampled.");
refreshUI();
return true;
}
if (mode === "smallSize" || mode === "largeSize") {
state.draft = { type: "stainSample", mode, start: point, current: point };
canvas.setPointerCapture(event.pointerId);
return true;
}
if (mode === "manual") {
state.draft = { type: "halfEllipse", start: point, current: point, stainManual: true };
canvas.setPointerCapture(event.pointerId);
return true;
}
if (mode === "detect" || mode === "exclude") {
const type = mode === "detect" ? "stainDetect" : "stainExclude";
if (!state.draft) state.draft = { type, points: [point], current: point };
else if (nearFirstPoint(point, image)) finishStainPolygon();
else state.draft.points.push(point);
draw();
return true;
}
return false;
}
function canvasPointerDown(event) {
const image = activeImage();
if (!image) return;
if (event.button === 2) {
if (state.tool === "polyline" && state.draft?.type === "polyline") {
finishOpenPolyline();
return;
}
if (state.tool === "polygon" && state.draft?.type === "polygon") {
finishPolygonIfPossible();
return;
}
if (state.tool === "point") {
setTool("select");
return;
}
if (state.draft?.type === "stainDetect" || state.draft?.type === "stainExclude") {
finishStainPolygon();
return;
}
if (state.tool === "stainCount" && state.stainMode === "manual") {
state.stainMode = null;
state.draft = null;
updateHint();
draw();
return;
}
state.panning = { x: event.clientX, y: event.clientY, panX: image.view.panX, panY: image.view.panY };
canvas.setPointerCapture(event.pointerId);
return;
}
if (event.button !== 0) return;
const point = imagePoint(event);
if (handleStainPointerDown(event, point, image)) return;
if (!state.draft && !state.stainMode) {
const current = selectedObject();
const control = isEllipseLike(current?.type) && !current.locked ? hitEllipseControl(current, point, image.view.zoom) : null;
if (control) {
setTool("select");
state.dragging = { mode: "ellipse-control", role: control.role, object: current, start: point, snapshot: JSON.parse(JSON.stringify(current)) };
canvas.setPointerCapture(event.pointerId);
return;
}
const vertex = hitVertex(current, point, image.view.zoom);
if (vertex) {
setTool("select");
state.dragging = { mode: "vertex", vertex, object: current, start: point, snapshot: JSON.parse(JSON.stringify(current)) };
canvas.setPointerCapture(event.pointerId);
return;
}
const hit = hitTest(point);
if (hit) {
setTool("select");
state.selectedObjectId = hit.id;
if (!hit.locked) {
state.dragging = { mode: "translate", object: hit, start: point, snapshot: JSON.parse(JSON.stringify(hit)) };
canvas.setPointerCapture(event.pointerId);
}
refreshUI();
return;
}
}
if (state.tool === "select") {
state.selectedObjectId = null;
refreshUI();
return;
}
if (isEllipseLike(state.tool)) {
state.draft = { type: state.tool, start: point, current: point };
canvas.setPointerCapture(event.pointerId);
return;
}
if (state.tool === "point") {
completeObject(makeObject("point", { p: point, size: stylePrefs("point").size, pointStyle: stylePrefs("point").pointStyle }), true);
return;
}
if (state.tool === "text") {
openTextDialog(point);
return;
}
if (["scale", "distance"].includes(state.tool)) {
if (!state.draft) state.draft = { type: state.tool, points: [point], current: point };
else completeObject(makeObject(state.tool, { p1: state.draft.points[0], p2: point }));
draw();
return;
}
if (state.tool === "angle") {
if (!state.draft) state.draft = { type: "angle", points: [point], current: point };
else if (state.draft.points.length === 1) state.draft.points.push(point);
else completeObject(makeObject("angle", { p1: state.draft.points[0], p2: state.draft.points[1], p3: point }));
draw();
return;
}
if (["polyline", "polygon"].includes(state.tool)) {
if (!state.draft) state.draft = { type: state.tool, points: [point], current: point };
else if (nearFirstPoint(point, image)) {
if (state.tool === "polyline") {
completeObject(makeObject("polyline", { points: state.draft.points.slice(), closed: true }));
return;
}
askClosePolygon();
return;
} else state.draft.points.push(point);
draw();
}
}
function canvasPointerMove(event) {
const image = activeImage();
if (!image) return;
if (state.panning) {
image.view.panX = state.panning.panX + event.clientX - state.panning.x;
image.view.panY = state.panning.panY + event.clientY - state.panning.y;
draw();
return;
}
const point = imagePoint(event);
if (state.dragging) {
if (state.dragging.mode === "ellipse-control") adjustEllipseControl(state.dragging, point, image.view.zoom);
else if (state.dragging.mode === "vertex") {
setVertexPoint(state.dragging.object, state.dragging.vertex, { x: point.x, y: point.y });
renderMeasurements();
renderCalibration();
} else {
const dx = point.x - state.dragging.start.x;
const dy = point.y - state.dragging.start.y;
translateObject(state.dragging.object, state.dragging.snapshot, dx, dy);
}
draw();
return;
}
if (state.tool === "select") {
const object = selectedObject();
const control = isEllipseLike(object?.type) && !object.locked ? hitEllipseControl(object, point, image.view.zoom) : null;
const vertex = hitVertex(object, point, image.view.zoom);
canvas.style.cursor = control || vertex ? (control?.role === "rotation" ? "grab" : "pointer") : "default";
}
if (state.draft) {
state.draft.current = point;
state.draft.closeCandidate = nearFirstPoint(point, image);
draw();
}
}
function canvasPointerUp(event) {
if (state.panning) {
state.panning = null;
try { canvas.releasePointerCapture(event.pointerId); } catch {}
return;
}
if (state.dragging) {
state.dragging = null;
try { canvas.releasePointerCapture(event.pointerId); } catch {}
refreshUI();
return;
}
if (state.draft?.type === "stainSample") {
const session = ensureStainSession();
const sampleMode = state.draft.mode;
session[sampleMode] = Math.max(2, distance(state.draft.start, imagePoint(event)));
state.draft = null;
state.stainMode = null;
updateHint(sampleMode === "largeSize" ? "Large stain sampled." : "Small stain sampled.");
refreshUI();
try { canvas.releasePointerCapture(event.pointerId); } catch {}
return;
}
if (state.draft?.stainManual && state.draft?.start) {
const end = imagePoint(event);
if (distance(state.draft.start, end) > 4) completeManualStain(ellipseFromDrag(state.draft.start, end, true));
else { state.draft = null; draw(); }
try { canvas.releasePointerCapture(event.pointerId); } catch {}
return;
}
if ((state.tool === "ellipse" || state.tool === "halfEllipse") && state.draft?.start) {
const end = imagePoint(event);
if (distance(state.draft.start, end) > 4) {
const geometry = ellipseFromDrag(state.draft.start, end, state.tool === "halfEllipse");
completeObject(normalizeEllipse(makeObject(state.tool, { ...geometry, showPoints: stylePrefs(state.tool).showPoints !== false })));
}
else { state.draft = null; draw(); }
try { canvas.releasePointerCapture(event.pointerId); } catch {}
} else if (state.tool === "circle" && state.draft?.start) {
const end = imagePoint(event);
const radius = distance(state.draft.start, end);
if (radius > 2) completeObject(makeObject("circle", { cx: state.draft.start.x, cy: state.draft.start.y, rx: radius, ry: radius, rotation: 0, showPoints: stylePrefs("circle").showPoints !== false }));
else { state.draft = null; draw(); }
try { canvas.releasePointerCapture(event.pointerId); } catch {}
}
}
function canvasDoubleClick(event) {
if ((state.draft?.type === "stainDetect" || state.draft?.type === "stainExclude") && state.draft.points.length >= 3) {
event.preventDefault();
finishStainPolygon();
return;
}
if (!["polyline", "polygon"].includes(state.tool) || !state.draft) return;
event.preventDefault();
const minimum = state.tool === "polygon" ? 3 : 2;
const points = state.draft.points.slice();
if (points.length > 1 && distance(points.at(-1), points.at(-2)) < 2) points.pop();
if (points.length >= minimum) completeObject(makeObject(state.tool, { points, closed: state.tool === "polygon" }));
}
function nearFirstPoint(point, image = activeImage()) {
return Boolean(state.draft?.points?.length >= 3 && image && distance(point, state.draft.points[0]) <= 10 / image.view.zoom);
}
function finishOpenPolyline() {
if (state.draft?.type !== "polyline") return;
const points = state.draft.points.slice();
if (points.length >= 2) completeObject(makeObject("polyline", { points, closed: false }));
else {
state.draft = null;
setTool("select");
refreshUI();
}
}
function finishPolygonIfPossible() {
if (state.draft?.type !== "polygon") return;
const points = state.draft.points.slice();
if (points.length >= 3) completeObject(makeObject("polygon", { points, closed: true }));
else {
state.draft = null;
setTool("select");
refreshUI();
}
}
function askClosePolygon() {
if (state.draft?.type !== "polygon" || state.draft.points.length < 3) return;
const dialog = $("#closePolygonDialog");
const onClose = () => {
dialog.removeEventListener("close", onClose);
if (dialog.returnValue === "close") finishPolygonIfPossible();
};
dialog.returnValue = "keep";
dialog.addEventListener("close", onClose);
dialog.showModal();
}
function translateObject(object, snapshot, dx, dy) {
const move = (point) => ({ x: point.x + dx, y: point.y + dy });
if (snapshot.p1) object.p1 = move(snapshot.p1);
if (snapshot.p2) object.p2 = move(snapshot.p2);
if (snapshot.p3) object.p3 = move(snapshot.p3);
if (snapshot.p) object.p = move(snapshot.p);
if (snapshot.points) object.points = snapshot.points.map(move);
if (Number.isFinite(snapshot.cx)) { object.cx = snapshot.cx + dx; object.cy = snapshot.cy + dy; }
if (snapshot.detectRegion) object.detectRegion = snapshot.detectRegion.map(move);
if (snapshot.excludeRegions) object.excludeRegions = snapshot.excludeRegions.map((region) => region.map(move));
}
function objectVertices(object) {
if (!object || object.locked || object.visible === false) return [];
if (["distance", "scale", "reference"].includes(object.type)) return [{ key: "p1" }, { key: "p2" }];
if (object.type === "angle") return [{ key: "p1" }, { key: "p2" }, { key: "p3" }];
if (object.type === "text" || object.type === "point") return [{ key: "p" }];
if (object.type === "polyline" || object.type === "polygon") return object.points.map((point, index) => ({ index }));
return [];
}
function vertexPoint(object, vertex) {
return vertex.index === undefined ? object[vertex.key] : object.points[vertex.index];
}
function setVertexPoint(object, vertex, point) {
if (vertex.index === undefined) object[vertex.key] = point;
else object.points[vertex.index] = point;
}
function hitVertex(object, point, zoom) {
const threshold = 10 / Math.max(zoom, .01);
return objectVertices(object).find((vertex) => distance(vertexPoint(object, vertex), point) <= threshold) || null;
}
function hitEllipseControl(object, point, zoom) {
const threshold = 10 / Math.max(zoom, .01);
return ellipseControls(object, zoom).find((control) => distance(control, point) <= threshold) || null;
}
function adjustEllipseControl(drag, point, zoom) {
const object = drag.object;
const snapshot = drag.snapshot;
const minimum = Math.min(4 / Math.max(zoom, .01), snapshot.rx / 3);
if (drag.role === "center") {
object.cx = point.x;
object.cy = point.y;
return;
}
if (drag.role === "rotation") {
object.rotation = normalizeAngle(Math.atan2(point.y - object.cy, point.x - object.cx) - Math.PI);
return;
}
const local = ellipseLocalPoint(snapshot, point);
if (object.type === "circle") {
const radius = Math.max(minimum, drag.role.startsWith("major") ? Math.abs(local.x) : Math.abs(local.y));
object.rx = radius;
object.ry = radius;
return;
}
if (drag.role.startsWith("major")) object.rx = Math.max(snapshot.ry + minimum, Math.abs(local.x));
if (drag.role.startsWith("minor")) object.ry = Math.max(minimum, Math.min(snapshot.rx - minimum, Math.abs(local.y)));
}
function hitTest(point) {
const image = activeImage();
if (!image) return null;
const threshold = 10 / image.view.zoom;
return [...image.objects].reverse().find((object) => object.visible !== false && objectDistance(object, point) <= threshold) || null;
}
function objectDistance(object, point) {
if (["distance", "scale", "reference"].includes(object.type)) return pointSegmentDistance(point, object.p1, object.p2);
if (object.type === "angle") return Math.min(pointSegmentDistance(point, object.p1, object.p2), pointSegmentDistance(point, object.p2, object.p3));
if (object.type === "ellipse" || object.type === "circle") {
const dx = point.x - object.cx, dy = point.y - object.cy;
const r = Math.hypot(dx / Math.max(object.rx, 1), dy / Math.max(object.ry, 1));
return Math.abs(r - 1) * Math.min(object.rx, object.ry);
}
if (object.type === "halfEllipse") {
const chord = pointSegmentDistance(point, rotateEllipsePoint(object, 0, -object.ry), rotateEllipsePoint(object, 0, object.ry));
const local = ellipseLocalPoint(object, point);
if (local.x < 0) return chord;
const r = Math.hypot(local.x / Math.max(object.rx, 1), local.y / Math.max(object.ry, 1));
return Math.min(chord, Math.abs(r - 1) * Math.min(object.rx, object.ry));
}
if (object.type === "polyline" || object.type === "polygon") {
let best = Infinity;
const count = object.type === "polygon" || object.closed ? object.points.length : object.points.length - 1;
for (let i = 0; i < count; i++) best = Math.min(best, pointSegmentDistance(point, object.points[i], object.points[(i + 1) % object.points.length]));
return best;
}
if (object.type === "text" || object.type === "point") return distance(point, object.p);
if (object.type === "stainCount") {
let best = Infinity;
const regions = [object.detectRegion, ...(object.excludeRegions || [])].filter((region) => region?.length > 1);
for (const region of regions) {
for (let i = 0; i < region.length; i++) best = Math.min(best, pointSegmentDistance(point, region[i], region[(i + 1) % region.length]));
}
return best;
}
return Infinity;
}
function pointSegmentDistance(p, a, b) {
const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
if (!l2) return distance(p, a);
const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
function canvasWheel(event) {
const image = activeImage();
if (!image) return;
event.preventDefault();
const rect = canvas.getBoundingClientRect();
const mouseX = event.clientX - rect.left;
const mouseY = event.clientY - rect.top;
const before = { x: (mouseX - image.view.panX) / image.view.zoom, y: (mouseY - image.view.panY) / image.view.zoom };
const factor = event.deltaY < 0 ? 1.12 : .89;
image.view.zoom = Math.max(.01, Math.min(20, image.view.zoom * factor));
image.view.panX = mouseX - before.x * image.view.zoom;
image.view.panY = mouseY - before.y * image.view.zoom;
draw();
}
function refreshUI() {
const image = activeImage();
$("#emptyState").hidden = Boolean(image) || state.projectStarted;
["#exportImageBtn", "#exportCsvBtn", "#fitCanvasBtn"].forEach((selector) => $(selector).disabled = !image);
renderFilmstrip();
renderStructure();
renderProperties();
renderCalibration();
renderMeasurements();
draw();
}
function renderFilmstrip() {
$("#filmstrip").innerHTML = "";
state.project.images.forEach((image) => {
const button = document.createElement("button");
button.className = `thumb${image.id === state.activeImageId ? " active" : ""}`;
button.innerHTML = `<span></span><img alt="">`;
button.title = image.name;
button.querySelector("img").src = image.element.src;
button.querySelector("span").textContent = image.name;
button.querySelector("span").title = image.name;
button.addEventListener("click", () => {
state.activeImageId = image.id;
state.selectedObjectId = null;
state.draft = null;
refreshUI();
if (image.view.zoom === 1 && image.view.panX === 0 && image.view.panY === 0) requestAnimationFrame(fitActiveImage);
});
$("#filmstrip").appendChild(button);
});
}
function renderStructure() {
const image = activeImage();
$("#structureList").innerHTML = "";
$("#structureEmpty").hidden = Boolean(image);
if (!image) return;
const imageRow = document.createElement("div");
imageRow.className = "structure-item";
imageRow.innerHTML = `<span class="structure-icon"><img alt=""></span><span class="name"></span>`;
imageRow.querySelector("img").src = image.element.src;
imageRow.querySelector(".name").textContent = image.name;
$("#structureList").appendChild(imageRow);
image.objects.forEach((object) => {
const row = document.createElement("div");
row.className = `structure-item${object.id === state.selectedObjectId ? " selected" : ""}${object.sessionId ? " child" : ""}`;
row.dataset.id = object.id;
row.innerHTML = `<span class="structure-icon">${structureIcon(object)}</span><span class="name"></span>`;
row.querySelector(".name").textContent = object.name;
row.addEventListener("click", () => selectObject(object.id));
$("#structureList").appendChild(row);
});
}
function structureIcon(object) {
const icons = {
scale: `<svg viewBox="0 0 24 24"><path d="M4 17L17 4M7 19l-2-2m6-2-2-2m6-2-2-2m6-2-2-2"/></svg>`,
distance: `<svg viewBox="0 0 24 24"><path d="M4 18L20 6"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/></svg>`,
reference: `<svg viewBox="0 0 24 24"><path d="M4 18L20 6"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/></svg>`,
angle: `<svg viewBox="0 0 24 24"><path d="M4 19L11 7L20 19"/><path d="M9 15a5 5 0 0 0 5 0"/></svg>`,
circle: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>`,
ellipse: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-22 12 12)"/></svg>`,
halfEllipse: `<svg viewBox="0 0 24 24"><path d="M12 6.5A9 5.5 0 0 1 12 17.5Z" transform="rotate(-22 12 12)"/></svg>`,
polyline: `<svg viewBox="0 0 24 24"><polyline points="3,19 9,7 15,15 21,5"/></svg>`,
polygon: `<svg viewBox="0 0 24 24"><polygon points="12,3 21,10 18,21 6,21 3,10"/></svg>`,
"point-cross": `<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>`,
"point-dot": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" style="fill: currentColor; stroke: none"/></svg>`,
"point-crosshair": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5"/><path d="M12 3v18M3 12h18"/></svg>`,
text: `<svg viewBox="0 0 24 24"><path d="M5 5h14M12 5v14M8 19h8"/></svg>`,
stainCount: `<svg viewBox="0 0 24 24"><path d="M7 5.5A5 3 0 0 1 7 11.5Z"/><path d="M16 9.5A6 3.6 0 0 1 16 16.7Z"/></svg>`,
};
const key = object.type === "point" ? `point-${object.pointStyle || "cross"}` : object.type;
return icons[key] || icons.distance;
}
function selectObject(id) {
state.selectedObjectId = id;
setTool("select");
refreshUI();
}
function renderProperties() {
const object = selectedObject();
$("#propertiesEmpty").hidden = Boolean(object);
const form = $("#propertiesForm");
form.hidden = !object;
form.innerHTML = "";
if (!object) return;
form.append(fieldTitle(object.name));
form.append(textField("Name", object.name, (value) => object.name = value));
form.append(checkField("Visible", object.visible !== false, (checked) => object.visible = checked));
form.append(checkField("Locked", object.locked, (checked) => object.locked = checked));
form.append(colorField("Color", object.color, (value) => object.color = value));
if (object.type !== "text") form.append(numberField("Line width", object.lineWidth, (value) => object.lineWidth = value, { min: 1, max: 12, step: 1 }));
if (object.type === "scale") {
form.append(numberField("Known distance", object.knownLength, (value) => { object.knownLength = Math.max(.0001, value); activeImage().calibration = object; }, { min: .0001, step: .1 }));
form.append(selectField("Units", object.units, ["mm", "cm", "m", "in", "ft"], (value) => { object.units = value; activeImage().calibration = object; }));
form.append(readonlyField("Pixel distance", distance(object.p1, object.p2).toFixed(2)));
}
if (["distance", "reference", "polyline", "polygon", "angle"].includes(object.type)) form.append(readonlyField("Result", objectValue(object)));
if (object.type === "halfEllipse") {
const units = activeImage()?.calibration?.units || "px";
const multiplier = unitScale() || 1;
form.append(readonlyField("Half length", `${(object.rx * multiplier).toFixed(2)} ${units}`));
form.append(readonlyField("Full length", `${(object.rx * 2 * multiplier).toFixed(2)} ${units}`));
form.append(readonlyField("Width", `${(object.ry * 2 * multiplier).toFixed(2)} ${units}`));
form.append(numberField("Gamma angle", ellipseGammaDegrees(object).toFixed(1), (value) => object.rotation = rotationFromGammaDegrees(value), { min: 0, max: 360, step: .1 }));
form.append(readonlyField("Alpha angle", `${ellipseAlphaDegrees(object).toFixed(1)}°`));
form.append(checkField("Show points", object.showPoints !== false, (checked) => object.showPoints = checked));
}
if (object.type === "ellipse" || object.type === "circle") {
const scale = unitScale(); const units = activeImage()?.calibration?.units || "px";
const multiplier = scale || 1;
const major = Math.max(object.rx, object.ry) * 2 * multiplier;
const minor = Math.min(object.rx, object.ry) * 2 * multiplier;
form.append(checkField("Make circle", object.type === "circle", (checked) => convertEllipseShape(object, checked)));
if (object.type === "circle") {
const radius = major / 2;
form.append(readonlyField("Diameter", `${major.toFixed(2)} ${units}`));
form.append(readonlyField("Circumference", `${(Math.PI * major).toFixed(2)} ${units}`));
form.append(readonlyField("Area", `${(Math.PI * radius * radius).toFixed(2)} ${units}²`));
} else {
form.append(readonlyField("Major axis", `${major.toFixed(2)} ${units}`));
form.append(readonlyField("Minor axis", `${minor.toFixed(2)} ${units}`));
form.append(numberField("Gamma angle", ellipseGammaDegrees(object).toFixed(1), (value) => object.rotation = rotationFromGammaDegrees(value), { min: 0, max: 360, step: .1 }));
form.append(readonlyField("Alpha angle", `${ellipseAlphaDegrees(object).toFixed(1)}°`));
}
form.append(checkField("Show points", object.showPoints !== false, (checked) => object.showPoints = checked));
}
if (object.type === "point") {
form.append(selectField("Style", object.pointStyle || "cross", [
{ value: "cross", label: "Cross" },
{ value: "dot", label: "Dot" },
{ value: "crosshair", label: "Crosshair" },
], (value) => object.pointStyle = value));
form.append(numberField("Size", object.size ?? 8, (value) => object.size = Math.max(2, value), { min: 2, max: 60, step: 1 }));
form.append(readonlyField("Position", objectValue(object)));
}
if (object.type === "text") {
form.append(textField("Text", object.text, (value) => object.text = value));
form.append(numberField("Font size", object.fontSize, (value) => object.fontSize = value, { min: 8, max: 96, step: 1 }));
}
if (object.type === "stainCount") appendStainSessionFields(form, object);
}
function sessionButton(text, handler) {
const button = document.createElement("button");
button.type = "button";
button.className = "button ghost";
button.textContent = text;
button.addEventListener("click", handler);
return button;
}
function swatchRow(label, color) {
const row = document.createElement("div");
row.className = "swatch-row";
const swatch = document.createElement("span");
swatch.className = "swatch";
swatch.style.background = color || "transparent";
row.append(swatch, document.createTextNode(color ? `${label} ${color}` : `${label} not sampled`));
return row;
}
function rangeField(title, value, handler) {
const input = Object.assign(document.createElement("input"), { type: "range", min: 0, max: 100, value });
input.addEventListener("input", () => {
handler(Number(input.value));
invalidateStainMask(selectedObject());
draw();
});
return makeLabel(`${title} ${value}`, input);
}
function appendStainSessionFields(form, session) {
const image = activeImage();
const stains = sessionStains(session, image);
const units = image?.calibration?.units || "px";
const scale = unitScale() || 1;
const regionArea = session.detectRegion?.length >= 3 ? polygonArea(session.detectRegion) : (image ? image.width * image.height : 0);
const area = regionArea * scale * scale;
const density = area > 0 ? stains.length / area : 0;
form.append(readonlyField("Count", String(stains.length)));
form.append(readonlyField("Density", `${density < 0.001 ? density.toExponential(2) : density.toFixed(4)} / ${units}²`));
form.append(swatchRow("Stain color", session.stainColor));
form.append(swatchRow("Background", session.backgroundColor));
form.append(readonlyField("Small sample", session.smallSize ? `${(session.smallSize * scale).toFixed(2)} ${units}` : "—"));
form.append(readonlyField("Large sample", session.largeSize ? `${(session.largeSize * scale).toFixed(2)} ${units}` : "—"));
const samples = document.createElement("div");
samples.className = "session-actions";
samples.append(
sessionButton("Stain color", () => setStainMode("stainColor")),
sessionButton("Background", () => setStainMode("backgroundColor")),
sessionButton("Small stain", () => setStainMode("smallSize")),
sessionButton("Large stain", () => setStainMode("largeSize")),
sessionButton("Detect region", () => setStainMode("detect")),
sessionButton("Exclude region", () => setStainMode("exclude")),
);
form.append(samples);
form.append(rangeField("Separation", session.separation ?? 35, (value) => session.separation = value));
form.append(rangeField("Size", session.sizeTune ?? 20, (value) => session.sizeTune = value));
form.append(rangeField("Front / fill", session.fill ?? 40, (value) => session.fill = value));
const actions = document.createElement("div");
actions.className = "session-stack";
actions.append(
sessionButton("Auto Detect", autoDetectStains),
sessionButton("Manually Mark", () => setStainMode("manual")),
);
if ((session.excludeRegions || []).length) {
actions.append(sessionButton("Clear exclude regions", () => {
session.excludeRegions = [];
invalidateStainMask(session);
refreshUI();
}));
}
form.append(actions);
const note = document.createElement("p");
note.className = "session-note";
note.textContent = "The cyan overlay is the live mask. Auto Detect replaces previous auto stains and keeps marks you added by hand.";
form.append(note);
}
function convertEllipseShape(object, makeCircle) {
if (makeCircle && object.type !== "circle") {
const radius = (Math.abs(object.rx) + Math.abs(object.ry)) / 2;
object.type = "circle";
object.rx = radius;
object.ry = radius;
object.rotation = 0;
object.name = object.name.replace(/^Ellipse\b/, "Circle");
} else if (!makeCircle && object.type === "circle") {
object.type = "ellipse";
object.ry = object.rx * .65;
object.rotation = Math.PI / 2;
object.name = object.name.replace(/^Circle\b/, "Ellipse");
}
renderProperties();
}
function fieldTitle(text) { const div = document.createElement("div"); div.className = "property-title"; div.textContent = text; return div; }
function makeLabel(title, input) { const label = document.createElement("label"); label.append(document.createTextNode(title), input); return label; }
function bindInput(input, handler) { input.addEventListener("input", () => { handler(input.type === "number" ? Number(input.value) : input.value); refreshAfterPropertyChange(); }); return input; }
function textField(title, value, handler) { const input = bindInput(Object.assign(document.createElement("input"), { value }), handler); return makeLabel(title, input); }
function numberField(title, value, handler, options = {}) { const input = Object.assign(document.createElement("input"), { type: "number", value }); Object.entries(options).forEach(([key, val]) => input[key] = val); bindInput(input, handler); return makeLabel(title, input); }
function readonlyField(title, value) { const input = Object.assign(document.createElement("input"), { value, readOnly: true }); return makeLabel(title, input); }
function selectField(title, value, options, handler) { const select = document.createElement("select"); options.forEach((option) => { const item = typeof option === "string" ? { value: option, label: option } : option; select.add(new Option(item.label, item.value, item.value === value, item.value === value)); }); bindInput(select, handler); return makeLabel(title, select); }
function colorField(title, value, handler) { const input = Object.assign(document.createElement("input"), { type: "color", value }); bindInput(input, handler); return makeLabel(title, input); }
function checkField(title, checked, handler) { const label = document.createElement("label"); label.className = "inline"; const input = Object.assign(document.createElement("input"), { type: "checkbox", checked }); input.addEventListener("change", () => { handler(input.checked); refreshAfterPropertyChange(); }); label.append(document.createTextNode(title), input); return label; }
function refreshAfterPropertyChange() { renderStructure(); renderCalibration(); renderMeasurements(); draw(); }
function renderCalibration() {
const image = activeImage();
const calibration = image?.calibration;
$("#calibrationEmpty").hidden = Boolean(calibration);
$("#calibrationValues").hidden = !calibration;
if (!calibration) return;
const pixels = distance(calibration.p1, calibration.p2);
$("#knownLengthValue").textContent = `${calibration.knownLength} ${calibration.units}`;
$("#pixelLengthValue").textContent = `${pixels.toFixed(2)} px`;
$("#scaleFactorValue").textContent = `${(calibration.knownLength / pixels).toFixed(6)} ${calibration.units}/px`;
}
function renderMeasurements() {
const image = activeImage();
const objects = image?.objects || [];
$("#measurementCount").textContent = objects.length;
$("#measurementEmpty").hidden = objects.length > 0;
$("#measurementList").innerHTML = "";
objects.forEach((object) => {
const item = document.createElement("div");
item.className = `measurement-item${object.id === state.selectedObjectId ? " selected" : ""}`;
item.innerHTML = `<span class="measurement-name"></span><span class="measurement-value"></span>`;
item.querySelector(".measurement-name").textContent = object.name;
item.querySelector(".measurement-value").textContent = objectValue(object);
item.addEventListener("click", () => selectObject(object.id));
$("#measurementList").appendChild(item);
});
}
function deleteSelected() {
const image = activeImage();
if (!image || !state.selectedObjectId) return;
const index = image.objects.findIndex((object) => object.id === state.selectedObjectId);
if (index < 0) return;
const [removed] = image.objects.splice(index, 1);
if (image.calibration?.id === removed.id) image.calibration = null;
if (removed.type === "stainCount") {
image.objects = image.objects.filter((object) => object.sessionId !== removed.id);
invalidateStainMask(removed);
} else if (removed.sessionId) {
const session = image.objects.find((object) => object.id === removed.sessionId);
if (session) renumberStains(session, image);
}
state.selectedObjectId = null;
refreshUI();
}
function exportCurrentImage() {
const image = activeImage();
if (!image) return;
const out = document.createElement("canvas"); out.width = image.width; out.height = image.height;
draw(out.getContext("2d"), image, true);
out.toBlob((blob) => downloadBlob(blob, `${stripExtension(image.name)}-annotated.png`), "image/png");
}
function exportCsv() {
const rows = [["Project", "Image", "Object", "Type", "Value", "Stain #", "Length", "Width", "Alpha", "Gamma", "Source"]];
state.project.images.forEach((image) => image.objects.forEach((object) => {
const scale = unitScale(image) || 1;
const stain = object.type === "halfEllipse" && object.stainNumber;
rows.push([
state.project.name,
image.name,
object.name,
object.type,
objectValue(object, image),
stain ? object.stainNumber : "",
stain ? (object.rx * 2 * scale).toFixed(3) : "",
stain ? (object.ry * 2 * scale).toFixed(3) : "",
stain ? ellipseAlphaDegrees(object).toFixed(2) : "",
stain ? ellipseGammaDegrees(object).toFixed(2) : "",
object.source || "",
]);
}));
const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
downloadBlob(new Blob([csv], { type: "text/csv" }), `${safeName(state.project.name)}-measurements.csv`);
}
async function saveProject() {
if (!state.project.images.length) { alert("Add at least one image before saving the project."); return; }
syncProjectMetadata();
const manifest = {
...state.project,
images: state.project.images.map((image, index) => ({
id: image.id, name: image.name, mime: image.mime, width: image.width, height: image.height,
path: `images/${String(index + 1).padStart(3, "0")}-${safeName(image.name)}`,
calibrationId: image.calibration?.id || null,
objects: image.objects,
})),
};
const files = [{ name: "manifest.json", bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) }];
state.project.images.forEach((image, index) => files.push({ name: manifest.images[index].path, bytes: image.bytes }));
const zip = createZip(files);
downloadBlob(new Blob([zip], { type: "application/octet-stream" }), `${safeName(state.project.name)}.elp`);
}
async function openProjectFile(file) {
try {
const files = readZip(new Uint8Array(await file.arrayBuffer()));
const manifestBytes = files.get("manifest.json");
if (!manifestBytes) throw new Error("Missing manifest.json");
const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
if (manifest.format !== "ELlipserWeb Project" || manifest.version !== 1) throw new Error("Unsupported project format");
const project = { format: manifest.format, version: manifest.version, name: manifest.name || "Untitled Project", caseNumber: manifest.caseNumber || "", notes: manifest.notes || "", images: [] };
for (const saved of manifest.images || []) {
const bytes = files.get(saved.path);
if (!bytes) throw new Error(`Missing image: ${saved.path}`);
const blob = new Blob([bytes], { type: saved.mime });
const url = URL.createObjectURL(blob);
const element = await loadImage(url);
const objects = (saved.objects || []).map((object) => isEllipseLike(object.type) ? normalizeEllipse(object) : object);
const image = { id: saved.id || uid("img"), name: saved.name, mime: saved.mime, bytes, width: saved.width || element.naturalWidth, height: saved.height || element.naturalHeight, element, objects, calibration: null, view: { zoom: 1, panX: 0, panY: 0 } };
image.calibration = image.objects.find((object) => object.id === saved.calibrationId) || null;
project.images.push(image);
}
state.project = project;
state.projectStarted = true;
state.activeImageId = project.images[0]?.id || null;
state.selectedObjectId = null;
state.draft = null;
populateProjectMetadata();
refreshUI();
requestAnimationFrame(fitActiveImage);
} catch (error) {
console.error(error);
alert("This .elp project could not be opened. It may be damaged or from an unsupported version.");
}
}
function syncProjectMetadata() {
state.project.name = $("#projectName").value.trim() || "Untitled Project";
state.project.caseNumber = $("#caseNumber").value.trim();
state.project.notes = $("#projectNotes").value;
}
function populateProjectMetadata() {
$("#projectName").value = state.project.name;
$("#caseNumber").value = state.project.caseNumber;
$("#projectNotes").value = state.project.notes;
}
function openNewProjectDialog() {
$("#newProjectForm").reset();
$("#newProjectWarning").hidden = state.project.images.length === 0;
$("#newProjectDialog").showModal();
requestAnimationFrame(() => $("#newProjectName").focus());
}
function closeNewProjectDialog() {
$("#newProjectDialog").close();
}
function openTextDialog(point) {
const style = stylePrefs("text");
state.textPoint = point;
$("#textDialogValue").value = "";
$("#textDialogColor").value = style.color;
$("#textDialogSize").value = style.fontSize;
$("#textDialog").showModal();
$("#textDialogValue").focus();
}
function closeTextDialog() {
const dialog = $("#textDialog");
state.textPoint = null;
if (dialog.open) dialog.close();
}
function submitTextDialog(event) {
event.preventDefault();
const text = $("#textDialogValue").value.trim();
const point = state.textPoint;
if (!text || !point) {
$("#textDialogValue").setCustomValidity(text ? "" : "Enter the annotation text.");
$("#textDialogValue").reportValidity();
return;
}
$("#textDialogValue").setCustomValidity("");
const fontSize = Math.max(8, Math.min(96, Number($("#textDialogSize").value) || stylePrefs("text").fontSize));
completeObject(makeObject("text", { p: point, text, fontSize, color: $("#textDialogColor").value }));
closeTextDialog();
}
function openSettingsDialog() {
renderSettings();
$("#settingsDialog").showModal();
}
function closeSettingsDialog() {
const dialog = $("#settingsDialog");
if (dialog.open) dialog.close();
}
function resetSettings() {
state.prefs = clonePrefs();
savePrefs();
setPointStyle(stylePrefs("point").pointStyle);
renderSettings();
}
function updateStylePref(type, key, value) {
state.prefs.styles[type][key] = value;
savePrefs();
if (type === "point" && key === "pointStyle") {
setPointStyle(value);
const icon = $(`#settingsStyleList .style-row[data-type="point"] .structure-icon`);
if (icon) icon.innerHTML = structureIcon({ type: "point", pointStyle: value });
}
}
function settingsField(title, control) {
const label = document.createElement("label");
label.className = "style-field";
label.append(document.createTextNode(title), control);
return label;
}
function renderSettings() {
const list = $("#settingsStyleList");
list.innerHTML = "";
styleSettingRows.forEach((row) => {
const style = stylePrefs(row.type);
const item = document.createElement("div");
item.className = "style-row";
item.dataset.type = row.type;
item.innerHTML = `<span class="structure-icon">${structureIcon({ type: row.type, pointStyle: style.pointStyle })}</span><span class="style-name"></span>`;
item.querySelector(".style-name").textContent = row.name;
const color = Object.assign(document.createElement("input"), { type: "color", value: style.color });
color.addEventListener("input", () => updateStylePref(row.type, "color", color.value));
item.append(settingsField("Color", color));
if (row.type !== "text") {
const width = Object.assign(document.createElement("input"), { type: "number", value: style.lineWidth, min: 1, max: 12, step: 1 });
width.addEventListener("input", () => updateStylePref(row.type, "lineWidth", Math.max(1, Number(width.value) || 1)));
item.append(settingsField("Width", width));
}
(row.extras || []).forEach((extra) => {
if (extra === "pointStyle") {
const select = document.createElement("select");
["cross", "dot", "crosshair"].forEach((value) => select.add(new Option(pointStyles[value].name, value, value === style.pointStyle, value === style.pointStyle)));
select.addEventListener("input", () => updateStylePref(row.type, "pointStyle", select.value));
item.append(settingsField("Style", select));
}
if (extra === "size") {
const size = Object.assign(document.createElement("input"), { type: "number", value: style.size, min: 2, max: 60, step: 1 });
size.addEventListener("input", () => updateStylePref(row.type, "size", Math.max(2, Number(size.value) || 8)));
item.append(settingsField("Size", size));
}
if (extra === "fontSize") {
const fontSize = Object.assign(document.createElement("input"), { type: "number", value: style.fontSize, min: 8, max: 96, step: 1 });
fontSize.addEventListener("input", () => updateStylePref(row.type, "fontSize", Math.max(8, Number(fontSize.value) || 18)));
item.append(settingsField("Font", fontSize));
}
if (extra === "units") {
const select = document.createElement("select");
["mm", "cm", "m", "in", "ft"].forEach((value) => select.add(new Option(value, value, value === style.units, value === style.units)));
select.addEventListener("input", () => updateStylePref(row.type, "units", select.value));
item.append(settingsField("Units", select));
}
if (extra === "showPoints") {
const check = Object.assign(document.createElement("input"), { type: "checkbox", checked: style.showPoints !== false });
check.addEventListener("change", () => updateStylePref(row.type, "showPoints", check.checked));
item.append(settingsField("Handles", check));
}
});
list.appendChild(item);
});
}
function createNewProject(event) {
event.preventDefault();
const form = $("#newProjectForm");
if (!form.reportValidity()) return;
const projectName = $("#newProjectName");
if (!projectName.value.trim()) {
projectName.setCustomValidity("Enter a project name.");
projectName.reportValidity();
return;
}
projectName.setCustomValidity("");
state.project = freshProject();
state.projectStarted = true;
state.project.name = projectName.value.trim();
state.project.caseNumber = $("#newCaseNumber").value.trim();
state.project.notes = $("#newProjectNotes").value;
state.activeImageId = null;
state.selectedObjectId = null;
state.draft = null;
populateProjectMetadata();
closeNewProjectDialog();
refreshUI();
}
function toggleFilmstrip() {
const button = $("#toggleFilmstrip");
const collapsed = $(".center-stage").classList.toggle("bottom-collapsed");
button.querySelector("span").textContent = collapsed ? "›" : "‹";
button.setAttribute("aria-expanded", String(!collapsed));
button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} thumbnails`);
requestAnimationFrame(resizeCanvas);
}
function togglePanel(side) {
const workspace = $(".workspace");
const isLeft = side === "left";
const className = isLeft ? "left-collapsed" : "right-collapsed";
const button = isLeft ? $("#toggleLeftPanel") : $("#toggleRightPanel");
const collapsed = workspace.classList.toggle(className);
button.textContent = isLeft ? (collapsed ? "›" : "‹") : (collapsed ? "‹" : "›");
button.setAttribute("aria-expanded", String(!collapsed));
button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${isLeft ? "Structure and Properties" : "Project panel"}`);
requestAnimationFrame(resizeCanvas);
}
function safeName(value) { return String(value || "project").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "project"; }
function stripExtension(value) { return value.replace(/\.[^.]+$/, ""); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement("a"), { href: url, download: filename }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
const crcTable = (() => {
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
return table;
})();
function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
function concatBytes(parts) { const length = parts.reduce((sum, part) => sum + part.length, 0); const out = new Uint8Array(length); let offset = 0; parts.forEach((part) => { out.set(part, offset); offset += part.length; }); return out; }
function createZip(files) {
const encoder = new TextEncoder(); const locals = []; const centrals = []; let offset = 0;
for (const file of files) {
const name = encoder.encode(file.name); const bytes = file.bytes; const crc = crc32(bytes);
const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
writeU32(lv, 0, 0x04034b50); writeU16(lv, 4, 20); writeU16(lv, 6, 0x0800); writeU16(lv, 8, 0); writeU32(lv, 14, crc); writeU32(lv, 18, bytes.length); writeU32(lv, 22, bytes.length); writeU16(lv, 26, name.length); local.set(name, 30);
locals.push(local, bytes);
const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
writeU32(cv, 0, 0x02014b50); writeU16(cv, 4, 20); writeU16(cv, 6, 20); writeU16(cv, 8, 0x0800); writeU16(cv, 10, 0); writeU32(cv, 16, crc); writeU32(cv, 20, bytes.length); writeU32(cv, 24, bytes.length); writeU16(cv, 28, name.length); writeU32(cv, 42, offset); central.set(name, 46); centrals.push(central);
offset += local.length + bytes.length;
}
const centralBytes = concatBytes(centrals); const end = new Uint8Array(22); const ev = new DataView(end.buffer);
writeU32(ev, 0, 0x06054b50); writeU16(ev, 8, files.length); writeU16(ev, 10, files.length); writeU32(ev, 12, centralBytes.length); writeU32(ev, 16, offset);
return concatBytes([...locals, centralBytes, end]);
}
function readZip(bytes) {
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let endOffset = -1;
for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { endOffset = i; break; }
if (endOffset < 0) throw new Error("Not a ZIP file");
const count = view.getUint16(endOffset + 10, true); let offset = view.getUint32(endOffset + 16, true); const decoder = new TextDecoder(); const files = new Map();
for (let i = 0; i < count; i++) {
if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid central directory");
const method = view.getUint16(offset + 10, true); const expectedCrc = view.getUint32(offset + 16, true); const size = view.getUint32(offset + 24, true); const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true); const localOffset = view.getUint32(offset + 42, true); const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
if (method !== 0) throw new Error("Unsupported compression method");
const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const dataStart = localOffset + 30 + localNameLength + localExtraLength;
const fileBytes = bytes.slice(dataStart, dataStart + size);
if (crc32(fileBytes) !== expectedCrc) throw new Error(`Integrity check failed: ${name}`);
files.set(name, fileBytes); offset += 46 + nameLength + extraLength + commentLength;
}
return files;
}
canvas.addEventListener("pointerdown", canvasPointerDown);
canvas.addEventListener("pointermove", canvasPointerMove);
canvas.addEventListener("pointerup", canvasPointerUp);
canvas.addEventListener("dblclick", canvasDoubleClick);
canvas.addEventListener("wheel", canvasWheel, { passive: false });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
new ResizeObserver(resizeCanvas).observe($("#canvasWrap"));
$$(".tool[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
$$(".tool-variant").forEach((toggle) => {
toggle.addEventListener("click", (event) => {
event.stopPropagation();
flyoutPinned.add(toggle);
toggleFlyout(toggle, true);
});
bindFlyoutHover(toggle);
});
$$("#ellipseFlyout button").forEach((option) => option.addEventListener("click", () => { closeFlyouts(); setTool(option.dataset.variant); }));
$$("#measureFlyout button").forEach((option) => option.addEventListener("click", () => { closeFlyouts(); setTool(option.dataset.variant); }));
document.addEventListener("click", (event) => { if (!event.target.closest(".tool-flyout, .tool-variant")) closeFlyouts(); });
window.addEventListener("resize", closeFlyouts);
$("#newProjectPrimary").addEventListener("click", openNewProjectDialog);
$("#loadImagesBtn").addEventListener("click", () => $("#imageInput").click());
$("#sampleImageBtn").addEventListener("click", loadSampleImage);
$("#settingsBtn").addEventListener("click", openSettingsDialog);
$("#closeSettingsDialog").addEventListener("click", closeSettingsDialog);
$("#resetSettingsBtn").addEventListener("click", resetSettings);
$("#imageInput").addEventListener("change", (event) => { addImageFiles(event.target.files); event.target.value = ""; });
$("#openProjectBtn").addEventListener("click", () => $("#projectInput").click());
$("#projectInput").addEventListener("change", (event) => { if (event.target.files[0]) openProjectFile(event.target.files[0]); event.target.value = ""; });
$("#saveProjectBtn").addEventListener("click", saveProject);
$("#exportImageBtn").addEventListener("click", exportCurrentImage);
$("#exportCsvBtn").addEventListener("click", exportCsv);
$("#newProjectBtn").addEventListener("click", openNewProjectDialog);
$("#newProjectForm").addEventListener("submit", createNewProject);
$("#newProjectName").addEventListener("input", (event) => event.target.setCustomValidity(""));
$("#closeNewProjectDialog").addEventListener("click", closeNewProjectDialog);
$("#cancelNewProject").addEventListener("click", closeNewProjectDialog);
$("#textForm").addEventListener("submit", submitTextDialog);
$("#textDialogValue").addEventListener("input", (event) => event.target.setCustomValidity(""));
$("#closeTextDialog").addEventListener("click", closeTextDialog);
$("#cancelTextDialog").addEventListener("click", closeTextDialog);
$("#textDialog").addEventListener("close", () => { state.textPoint = null; });
$("#toggleLeftPanel").addEventListener("click", () => togglePanel("left"));
$("#toggleRightPanel").addEventListener("click", () => togglePanel("right"));
$("#toggleFilmstrip").addEventListener("click", toggleFilmstrip);
$("#fitCanvasBtn").addEventListener("click", fitActiveImage);
$("#projectName").addEventListener("input", syncProjectMetadata);
$("#caseNumber").addEventListener("input", syncProjectMetadata);
$("#projectNotes").addEventListener("input", syncProjectMetadata);
window.addEventListener("keydown", (event) => {
if (document.querySelector("dialog[open]")) return;
if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
const shortcuts = { s: "scale", p: "point", d: "distance", a: "angle", c: "circle", e: "ellipse", h: "halfEllipse", l: "polyline", g: "polygon", t: "text", n: "stainCount" };
if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
if (event.key === "Escape") {
if (state.stainMode || state.draft?.stainManual || state.draft?.type === "stainDetect" || state.draft?.type === "stainExclude" || state.draft?.type === "stainSample") {
state.stainMode = null;
state.draft = null;
updateHint();
draw();
return;
}
state.draft = null;
setTool("select");
}
});
populateProjectMetadata();
setPointStyle(stylePrefs("point").pointStyle);
setMeasureVariant("distance");
refreshUI();
function registerWebMcpTools() {
const modelContext = document.modelContext;
if (!modelContext?.registerTool) return;
const register = (tool) => {
try { void Promise.resolve(modelContext.registerTool(tool)).catch(console.warn); }
catch (error) { console.warn(error); }
};
register({
name: "read_ellipser_project_summary",
title: "Read ELlipserWeb project summary",
description: "Read the visible project's metadata, images, calibration state, and measurement counts without changing it.",
inputSchema: { type: "object", properties: {}, additionalProperties: false },
annotations: { readOnlyHint: true, untrustedContentHint: true },
execute() {
syncProjectMetadata();
return {
name: state.project.name,
caseNumber: state.project.caseNumber,
imageCount: state.project.images.length,
activeImage: activeImage()?.name || null,
images: state.project.images.map((image) => ({ name: image.name, calibrated: Boolean(image.calibration), measurementCount: image.objects.length })),
};
},
});
register({
name: "update_ellipser_project_details",
title: "Update ELlipserWeb project details",
description: "Update the visible project's name, case reference, or notes.",
inputSchema: {
type: "object",
properties: { name: { type: "string" }, caseNumber: { type: "string" }, notes: { type: "string" } },
additionalProperties: false,
},
annotations: { readOnlyHint: false, untrustedContentHint: false },
execute(input) {
if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Input must be an object.");
for (const key of ["name", "caseNumber", "notes"]) if (key in input && typeof input[key] !== "string") throw new Error(`${key} must be a string.`);
if ("name" in input) state.project.name = input.name.trim() || "Untitled Project";
if ("caseNumber" in input) state.project.caseNumber = input.caseNumber.trim();
if ("notes" in input) state.project.notes = input.notes;
populateProjectMetadata();
return { name: state.project.name, caseNumber: state.project.caseNumber, updated: true };
},
});
}
registerWebMcpTools();
