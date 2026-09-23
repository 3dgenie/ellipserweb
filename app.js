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
assisted: {
directionToleranceDeg: 3,
stainNumberColor: "#3d3d3d",
},
layout: {
leftPanelWidth: 270,
rightPanelWidth: 292,
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
if (!saved || typeof saved !== "object") return prefs;
if (saved.styles && typeof saved.styles === "object") {
for (const type of Object.keys(prefs.styles)) {
const incoming = saved.styles[type];
if (incoming && typeof incoming === "object") prefs.styles[type] = { ...prefs.styles[type], ...incoming };
}
}
if (saved.assisted && typeof saved.assisted === "object") {
prefs.assisted = { ...prefs.assisted, ...saved.assisted };
}
if (saved.layout && typeof saved.layout === "object") {
prefs.layout = { ...prefs.layout, ...saved.layout };
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
stainVariant: "assisted",
stainWizardOpen: false,
stainWizardIndex: 0,
stainWizardPos: null,
stainWizardDrag: null,
hoverObjectId: null,
selectedSeedId: null,
dpr: window.devicePixelRatio || 1,
history: { past: [], future: [], applying: false },
};
function cloneJson(value) {
return JSON.parse(JSON.stringify(value));
}
function captureHistory() {
return {
activeImageId: state.activeImageId,
selectedObjectId: state.selectedObjectId,
selectedSeedId: state.selectedSeedId,
stainMode: state.stainMode,
stainVariant: state.stainVariant,
projectStarted: state.projectStarted,
projectMeta: {
name: state.project.name,
caseNumber: state.project.caseNumber,
notes: state.project.notes,
},
images: state.project.images.map((image) => ({
image,
objects: cloneJson(image.objects),
calibrationId: image.calibration?.id || null,
})),
};
}
function recordHistory() {
if (state.history.applying) return;
state.history.past.push(captureHistory());
if (state.history.past.length > 80) state.history.past.shift();
state.history.future = [];
}
function clearHistory() {
state.history.past = [];
state.history.future = [];
}
function applyHistory(snap) {
state.history.applying = true;
state.project.images = snap.images.map((entry) => {
const image = entry.image;
image.objects = cloneJson(entry.objects);
image.calibration = image.objects.find((object) => object.id === entry.calibrationId) || null;
return image;
});
state.project.name = snap.projectMeta.name;
state.project.caseNumber = snap.projectMeta.caseNumber;
state.project.notes = snap.projectMeta.notes;
state.projectStarted = snap.projectStarted;
state.activeImageId = snap.activeImageId;
state.selectedObjectId = snap.selectedObjectId;
state.selectedSeedId = snap.selectedSeedId;
state.stainMode = snap.stainMode;
if (snap.stainVariant && snap.stainVariant !== state.stainVariant) setStainVariant(snap.stainVariant);
state.draft = null;
state.dragging = null;
stainMaskCache.clear();
populateProjectMetadata();
refreshUI();
state.history.applying = false;
}
function undo() {
if (!state.history.past.length) return;
state.history.future.push(captureHistory());
applyHistory(state.history.past.pop());
}
function redo() {
if (!state.history.future.length) return;
state.history.past.push(captureHistory());
applyHistory(state.history.future.pop());
}
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
function flipSelectedEllipse() {
const object = selectedObject();
if (!object || object.locked) return;
if (object.type !== "ellipse" && object.type !== "halfEllipse") return;
recordHistory();
object.rotation = normalizeAngle((object.rotation || 0) + Math.PI);
refreshUI();
}
function flipSelectedSeedDirection() {
if (state.stainMode !== "centers" || !state.selectedSeedId) return false;
const seed = sessionSeeds(stainSession()).find((item) => item.id === state.selectedSeedId);
if (!seed || !Number.isFinite(seed.direction)) return false;
recordHistory();
seed.direction = normalizeAngle(seed.direction + Math.PI);
seed.directionUncertain = false;
draw();
return true;
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
return `L ${lengthLabel(major)} · W ${lengthLabel(minor)} · α ${ellipseAlphaDegrees(object).toFixed(1)}° · γ ${ellipseGammaDegrees(object).toFixed(1)}°`;
}
if (object.type === "halfEllipse") {
return `L ${lengthLabel(object.rx * 2)} · W ${lengthLabel(object.ry * 2)} · α ${ellipseAlphaDegrees(object).toFixed(1)}° · γ ${ellipseGammaDegrees(object).toFixed(1)}°`;
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
const counts = stainSourceCounts(object, image);
return `${counts.total} total · ${counts.auto} auto · ${counts.manual} manual`;
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
if (!exportMode && image.id === state.activeImageId && (state.tool === "stainCount" || state.stainMode || selectedObject()?.type === "stainCount") && stainSession(image)?.visible !== false) drawStainMask(targetCtx, image);
for (const object of image.objects) {
if (!objectIsDrawn(object, image)) continue;
drawObject(targetCtx, object, zoom, object.id === state.selectedObjectId, exportMode);
}
if (!exportMode && image.id === state.activeImageId && state.stainMode === "centers" && stainSession(image)?.visible !== false) drawSeedCenters(targetCtx, image, zoom);
if (state.draft && image.id === state.activeImageId) drawDraft(targetCtx, state.draft, zoom);
}
function drawHalfEllipseShape(drawCtx, object, zoom = 1) {
const rx = Math.abs(object.rx);
const ry = Math.abs(object.ry);
const rotation = object.rotation || 0;
drawCtx.beginPath();
drawCtx.ellipse(object.cx, object.cy, rx, ry, rotation, -Math.PI / 2, Math.PI / 2);
drawCtx.closePath();
drawCtx.stroke();
if (!object.showFullEllipse) return;
drawCtx.save();
drawCtx.globalAlpha *= 0.38;
drawCtx.setLineDash([5 / zoom, 4 / zoom]);
drawCtx.lineWidth = Math.max(1 / zoom, ((object.lineWidth || 2) * 0.75) / zoom);
drawCtx.beginPath();
drawCtx.ellipse(object.cx, object.cy, rx, ry, rotation, Math.PI / 2, Math.PI * 1.5);
drawCtx.stroke();
drawCtx.restore();
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
const hovered = !exportMode && object.id === state.hoverObjectId && !isSelected;
drawCtx.save();
lineStyle(drawCtx, object, zoom);
if (hovered) drawCtx.lineWidth = ((object.lineWidth || 2) + 1.5) / zoom;
if (object.type === "distance" || object.type === "scale" || object.type === "reference") {
drawCtx.beginPath(); drawCtx.moveTo(object.p1.x, object.p1.y); drawCtx.lineTo(object.p2.x, object.p2.y); drawCtx.stroke();
if (showLabel) drawLabel(drawCtx, objectValue(object), midpoint(object.p1, object.p2), zoom);
if (showHandles) drawHandles(drawCtx, [object.p1, object.p2], zoom);
} else if (object.type === "angle") {
drawCtx.beginPath(); drawCtx.moveTo(object.p1.x, object.p1.y); drawCtx.lineTo(object.p2.x, object.p2.y); drawCtx.lineTo(object.p3.x, object.p3.y); drawCtx.stroke();
if (showLabel) drawLabel(drawCtx, objectValue(object), object.p2, zoom);
if (showHandles) drawHandles(drawCtx, [object.p1, object.p2, object.p3], zoom);
} else if (object.type === "halfEllipse") {
drawHalfEllipseShape(drawCtx, object, zoom);
if (object.stainNumber) drawStainNumber(drawCtx, String(object.stainNumber), rotateEllipsePoint(object, object.rx, 0), zoom);
if (showLabel) drawLabel(drawCtx, objectValue(object), rotateEllipsePoint(object, object.rx, -object.ry), zoom);
if (showHandles) drawEllipseControls(drawCtx, object, zoom);
} else if (object.type === "stainCount") {
drawCtx.setLineDash([8 / zoom, 6 / zoom]);
drawCtx.strokeStyle = "#19c9d2";
drawPolygonPath(drawCtx, object.detectRegion, true);
drawCtx.strokeStyle = "#e06a6a";
(object.excludeRegions || []).forEach((region) => drawPolygonPath(drawCtx, region, true));
drawCtx.setLineDash([]);
if (Number.isFinite(object.direction) && object.directionStart && object.directionEnd) {
drawCtx.strokeStyle = "#f09a35";
drawCtx.fillStyle = "#f09a35";
drawDirectionArrow(drawCtx, object.directionStart, object.directionEnd, zoom);
}
} else if (object.type === "ellipse" || object.type === "circle") {
drawCtx.beginPath(); drawCtx.ellipse(object.cx, object.cy, Math.abs(object.rx), Math.abs(object.ry), object.rotation || 0, 0, Math.PI * 2); drawCtx.stroke();
if (object.stainNumber) drawStainNumber(drawCtx, String(object.stainNumber), rotateEllipsePoint(object, object.rx, 0), zoom);
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
drawHalfEllipseShape(drawCtx, ellipseFromDrag(draft.start, draft.current, true), zoom);
} else if (draft.type === "circle" && draft.start && draft.current) {
const radius = distance(draft.start, draft.current);
drawCtx.beginPath(); drawCtx.arc(draft.start.x, draft.start.y, radius, 0, Math.PI * 2); drawCtx.stroke();
} else if (draft.type === "stainDirection" && draft.start && draft.current) {
drawCtx.setLineDash([]);
drawDirectionArrow(drawCtx, draft.start, draft.current, zoom);
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
function stainNumberColor() {
const value = state.prefs?.assisted?.stainNumberColor;
return typeof value === "string" && value ? value : defaultPrefs.assisted.stainNumberColor;
}
function drawStainNumber(drawCtx, text, point, zoom) {
if (!text) return;
const fontSize = 12 / zoom;
drawCtx.font = `700 ${fontSize}px Inter, sans-serif`;
const metrics = drawCtx.measureText(text);
const radius = Math.max(9 / zoom, metrics.width / 2 + 5 / zoom);
const x = point.x + 10 / zoom;
const y = point.y - 10 / zoom;
drawCtx.beginPath();
drawCtx.arc(x, y, radius, 0, Math.PI * 2);
drawCtx.fillStyle = stainNumberColor();
drawCtx.fill();
drawCtx.strokeStyle = "rgba(255, 255, 255, .35)";
drawCtx.lineWidth = 1 / zoom;
drawCtx.stroke();
drawCtx.fillStyle = "#ffffff";
drawCtx.textAlign = "center";
drawCtx.textBaseline = "middle";
drawCtx.fillText(text, x, y + 0.5 / zoom);
drawCtx.textAlign = "start";
drawCtx.textBaseline = "alphabetic";
}
function drawDirectionArrow(drawCtx, start, end, zoom) {
drawCtx.beginPath();
drawCtx.moveTo(start.x, start.y);
drawCtx.lineTo(end.x, end.y);
drawCtx.stroke();
const angle = Math.atan2(end.y - start.y, end.x - start.x);
const head = 14 / Math.max(zoom, .01);
drawCtx.beginPath();
drawCtx.moveTo(end.x, end.y);
drawCtx.lineTo(end.x - head * Math.cos(angle - .45), end.y - head * Math.sin(angle - .45));
drawCtx.lineTo(end.x - head * Math.cos(angle + .45), end.y - head * Math.sin(angle + .45));
drawCtx.closePath();
drawCtx.fill();
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
if (!valid.length) return;
recordHistory();
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
async function loadStainSampleImage() {
closeSettingsDialog();
if (!state.projectStarted) {
state.project = freshProject();
state.projectStarted = true;
state.project.name = "Stain Detection Scene";
populateProjectMetadata();
}
const response = await fetch("samples/hemovision-stains.jpg");
if (!response.ok) {
alert("Could not load samples/hemovision-stains.jpg.");
return;
}
const blob = await response.blob();
const file = new File([blob], "hemovision-stains.jpg", { type: "image/jpeg" });
await addImageFiles([file]);
const image = state.project.images[state.project.images.length - 1];
if (!image) return;
state.activeImageId = image.id;
const y = image.height - Math.max(24, image.height * 0.04);
const scale = makeObject("scale", {
p1: { x: image.width * 0.08, y },
p2: { x: image.width * 0.38, y },
knownLength: 100,
units: "mm",
});
image.objects.push(scale);
image.calibration = scale;
refreshUI();
requestAnimationFrame(fitActiveImage);
}
function stainSampleMarks() {
return [
{ cx: 190, cy: 150, length: 92, width: 36, angle: 0.12 },
{ cx: 420, cy: 130, length: 68, width: 28, angle: -0.18 },
{ cx: 650, cy: 170, length: 124, width: 46, angle: 0.32 },
{ cx: 900, cy: 145, length: 52, width: 22, angle: 0.08 },
{ cx: 230, cy: 350, length: 108, width: 40, angle: -0.36 },
{ cx: 490, cy: 330, length: 78, width: 32, angle: 0.22 },
{ cx: 760, cy: 370, length: 142, width: 50, angle: -0.08 },
{ cx: 1000, cy: 310, length: 64, width: 26, angle: 0.48 },
{ cx: 310, cy: 540, length: 116, width: 42, angle: 0.1 },
{ cx: 560, cy: 560, length: 46, width: 20, angle: -0.28 },
{ cx: 840, cy: 560, length: 98, width: 36, angle: 0.2 },
];
}
function drawRedStain(drawCtx, stain) {
drawCtx.save();
drawCtx.translate(stain.cx, stain.cy);
drawCtx.rotate(stain.angle);
drawCtx.fillStyle = "#c42b2b";
drawCtx.beginPath();
drawCtx.ellipse(stain.length * 0.12, 0, stain.length * 0.38, stain.width * 0.5, 0, 0, Math.PI * 2);
drawCtx.fill();
drawCtx.beginPath();
drawCtx.moveTo(0, stain.width * 0.42);
drawCtx.quadraticCurveTo(-stain.length * 0.18, stain.width * 0.16, -stain.length * 0.52, 0);
drawCtx.quadraticCurveTo(-stain.length * 0.18, -stain.width * 0.16, 0, -stain.width * 0.42);
drawCtx.closePath();
drawCtx.fill();
drawCtx.restore();
}
function createStainSceneBlob() {
const width = 1200;
const height = 800;
const sample = document.createElement("canvas");
sample.width = width;
sample.height = height;
const drawCtx = sample.getContext("2d");
drawCtx.fillStyle = "#ffffff";
drawCtx.fillRect(0, 0, width, height);
stainSampleMarks().forEach((stain) => drawRedStain(drawCtx, stain));
drawCtx.strokeStyle = "#333333";
drawCtx.lineWidth = 8;
drawCtx.beginPath();
drawCtx.moveTo(100, 760);
drawCtx.lineTo(600, 760);
drawCtx.stroke();
drawCtx.fillStyle = "#333333";
drawCtx.fillRect(96, 752, 8, 16);
drawCtx.fillRect(596, 752, 8, 16);
drawCtx.font = "700 18px Inter, sans-serif";
drawCtx.fillText("SCALE 500 px  =  500 mm", 100, 740);
return new Promise((resolve) => sample.toBlob(resolve, "image/png"));
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
assisted: { name: "Assisted", title: "Assisted stains (N)", icon: `<path d="M7 5.5A5 3 0 0 1 7 11.5Z"/><path d="M16 9.5A6 3.6 0 0 1 16 16.7Z"/>`, tool: "stainCount" },
manual: { name: "Manual", title: "Manual stains (N)", icon: `<path d="M12 4.5A10 6 0 0 1 12 16.5Z"/>`, tool: "stainCount" },
};
function setEllipseVariant(variant) {
const button = $("#ellipseTool");
const mapped = variant === "stainCount" ? (state.stainVariant || "assisted") : variant;
const config = ellipseVariants[mapped];
if (!button || !config) return;
button.dataset.tool = config.tool || mapped;
button.title = config.title;
button.querySelector(".tool-icon").innerHTML = config.icon;
button.querySelector(".tool-name").textContent = config.name;
$$("#ellipseFlyout button").forEach((option) => option.classList.toggle("active", option.dataset.variant === mapped));
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
function setStainVariant(variant) {
state.stainVariant = variant === "manual" ? "manual" : "assisted";
if (state.tool === "stainCount") setEllipseVariant(state.stainVariant);
}
function enterManualStains() {
const session = stainSession();
if (state.stainWizardOpen) {
if (state.stainMode === "centers" && (session?.seedCenters || []).length) {
state.assistedResumeMode = "centers";
} else if (sessionFittedStains(session).length > 0) {
state.assistedResumeMode = "ellipses";
} else if ((session?.seedCenters || []).length) {
state.assistedResumeMode = "centers";
} else {
state.assistedResumeMode = null;
}
}
setStainVariant("manual");
state.stainMode = "manual";
state.draft = null;
state.selectedSeedId = null;
if (state.stainWizardOpen) renderStainWizard();
updateHint("Manual marking — click and drag half-ellipses. Switch to Assisted to return to centers or fitted ellipses.");
draw();
}
function sessionFittedStains(session, image = activeImage()) {
return sessionStains(session, image).filter((stain) => stain.fromSeed || stain.source === "auto");
}
function enterAssistedFromWizard() {
setStainVariant("assisted");
state.draft = null;
const session = stainSession();
const seeds = session?.seedCenters || [];
const fitted = sessionFittedStains(session);
const resume = state.assistedResumeMode;
state.assistedResumeMode = null;
const wantCenters = resume === "centers" || (resume !== "ellipses" && seeds.length > 0 && fitted.length === 0);
const wantEllipses = resume === "ellipses" || fitted.length > 0;
if (wantCenters && seeds.length > 0) {
enterCenterReview(seeds.length);
if (state.stainWizardOpen) renderStainWizard();
draw();
return;
}
if (wantEllipses || sessionStains(session).length > 0) {
state.stainMode = null;
state.selectedSeedId = null;
updateHint("Assisted mode — fitted ellipses are shown. Adjust them, or Find Centers / Fit Ellipses again.");
if (state.stainWizardOpen) renderStainWizard();
refreshUI();
return;
}
if (seeds.length > 0) {
enterCenterReview(seeds.length);
if (state.stainWizardOpen) renderStainWizard();
draw();
return;
}
state.stainMode = null;
state.selectedSeedId = null;
updateHint();
if (state.stainWizardOpen) renderStainWizard();
draw();
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
if (tool !== "stainCount") {
state.stainMode = null;
closeStainWizard();
}
const keepStainSession = tool === "stainCount";
const clearedSelection = tool !== "select" && !keepStainSession && state.selectedObjectId !== null;
if (clearedSelection) state.selectedObjectId = null;
state.tool = tool;
state.draft = null;
if (ellipseVariants[tool]) setEllipseVariant(tool);
else if (keepStainSession) setEllipseVariant(state.stainVariant);
if (measureVariants[tool]) setMeasureVariant(tool);
if (keepStainSession) {
const session = ensureStainSession();
if (session) state.selectedObjectId = session.id;
if (state.stainVariant === "manual") enterManualStains();
else openStainWizard();
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
const hintEl = $("#drawingHint");
if (hintEl) {
hintEl.textContent = "";
hintEl.hidden = true;
}
}
function makeObject(type, data) {
const image = activeImage();
const count = image.objects.filter((object) => object.type === type).length + 1;
const label = ({ scale: "Scale", point: "Point", distance: "Distance", angle: "Angle", circle: "Circle", ellipse: "Ellipse", halfEllipse: "Half Ellipse", polyline: "Polyline", polygon: "Polygon", text: "Text", stainCount: "Stains" })[type];
const style = stylePrefs(type);
return { id: uid(type), type, name: `${label} ${count}`, visible: true, locked: false, color: style.color, lineWidth: style.lineWidth, ...data };
}
function completeObject(object, keepTool = false) {
recordHistory();
const image = activeImage();
if (object.type === "ellipse" || object.type === "halfEllipse") {
const session = ensureStainSession(image, { record: false });
object.sessionId = session.id;
if (!object.source) object.source = "manual";
}
image.objects.push(object);
if (object.type === "scale") {
object.knownLength = 100;
object.units = stylePrefs("scale").units || "mm";
image.calibration = object;
}
if (object.sessionId) {
const session = image.objects.find((item) => item.id === object.sessionId) || stainSession(image);
if (session) renumberStains(session, image);
}
state.selectedObjectId = object.id;
state.draft = null;
if (!keepTool) setTool("select");
refreshUI();
}
const stainMaskCache = new Map();
function stainSession(image = activeImage()) {
return image?.objects.find((object) => object.type === "stainCount") || null;
}
function sessionStains(session, image = activeImage()) {
if (!session || !image) return [];
return image.objects.filter((object) => object.sessionId === session.id && (object.type === "halfEllipse" || object.type === "ellipse"));
}
function stainSourceCounts(session, image = activeImage()) {
let auto = 0, manual = 0;
for (const stain of sessionStains(session, image)) {
if (stain.source === "manual") manual += 1;
else auto += 1;
}
return { total: auto + manual, auto, manual };
}
function stainCountSummary(session, image = activeImage()) {
const counts = stainSourceCounts(session, image);
return `${counts.total} total · ${counts.auto} auto · ${counts.manual} manual`;
}
function calibratedLength(pixels, image = activeImage()) {
const scale = unitScale(image);
const units = image?.calibration?.units || "px";
return scale ? `${(pixels * scale).toFixed(2)} ${units}` : `${pixels.toFixed(1)} px`;
}
function numericStats(values) {
if (!values.length) return null;
const sorted = [...values].sort((a, b) => a - b);
const n = sorted.length;
const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
const mid = Math.floor(n / 2);
const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
const stdev = n > 1 ? Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
return { mean, median, min: sorted[0], max: sorted[n - 1], stdev };
}
function stainDensityLabel(session, image = activeImage()) {
const units = image?.calibration?.units || "px";
const scale = unitScale(image) || 1;
const stains = sessionStains(session, image);
const regionArea = session.detectRegion?.length >= 3 ? polygonArea(session.detectRegion) : (image ? image.width * image.height : 0);
const area = regionArea * scale * scale;
const density = area > 0 ? stains.length / area : 0;
return `${density < 0.001 ? density.toExponential(2) : density.toFixed(4)} / ${units}²`;
}
function svgEl(name, attrs = {}) {
const el = document.createElementNS("http://www.w3.org/2000/svg", name);
Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
return el;
}
function stainChartPanel(spec, index) {
const panel = document.createElement("figure");
panel.className = "stain-chart-panel";
panel.tabIndex = 0;
panel.setAttribute("role", "button");
panel.setAttribute("aria-label", `Enlarge ${spec.title}`);
const heading = document.createElement("h3");
heading.textContent = spec.title;
const note = document.createElement("p");
note.textContent = spec.caption;
panel.append(heading, spec.node, note);
const open = () => openStainChartViewerAt(index);
panel.addEventListener("click", open);
panel.addEventListener("keydown", (event) => {
if (event.key === "Enter" || event.key === " ") {
event.preventDefault();
open();
}
});
return panel;
}
function chartTickValues(min, max, count = 5) {
if (!(count > 1) || !Number.isFinite(min) || !Number.isFinite(max)) return [min, max].filter(Number.isFinite);
if (max === min) return [min];
const ticks = [];
for (let i = 0; i < count; i++) ticks.push(min + (max - min) * (i / (count - 1)));
return ticks;
}
function appendAxisTitle(svg, text, x, y, { rotate = 0, anchor = "middle", size = 9 } = {}) {
const node = svgEl("text", {
x,
y,
fill: "#c4c4c8",
"font-size": size,
"font-weight": 600,
"text-anchor": anchor,
...(rotate ? { transform: `rotate(${rotate} ${x} ${y})` } : {}),
});
node.textContent = text;
svg.append(node);
}
function histogramSvg(values, { min, max, bins, mean, median, formatTick, xLabel = "", yLabel = "Number of stains" }) {
const counts = Array(bins).fill(0);
const span = max - min || 1;
values.forEach((value) => {
let index = Math.floor((value - min) / span * bins);
if (index < 0) index = 0;
if (index >= bins) index = bins - 1;
counts[index] += 1;
});
const peak = Math.max(1, ...counts);
const width = 300, height = 168, left = 44, right = 12, top = 14, bottom = 40;
const innerW = width - left - right, innerH = height - top - bottom;
const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
svg.append(svgEl("line", { x1: left, y1: top + innerH, x2: left + innerW, y2: top + innerH, stroke: "#4f4f4f", "stroke-width": 1 }));
svg.append(svgEl("line", { x1: left, y1: top, x2: left, y2: top + innerH, stroke: "#4f4f4f", "stroke-width": 1 }));
chartTickValues(0, peak, Math.min(5, peak + 1)).forEach((value) => {
const y = top + innerH - (value / peak) * innerH;
svg.append(svgEl("line", { x1: left - 3, y1: y, x2: left, y2: y, stroke: "#4f4f4f", "stroke-width": 1 }));
if (peak > 1 || value === 0) {
const text = svgEl("text", { x: left - 5, y: y + 3, fill: "#a1a1a6", "font-size": 8, "text-anchor": "end" });
text.textContent = String(Math.round(value));
svg.append(text);
}
});
counts.forEach((count, i) => {
const barW = innerW / bins;
const barH = count / peak * innerH;
svg.append(svgEl("rect", {
x: left + i * barW + 1,
y: top + innerH - barH,
width: Math.max(0.5, barW - 2),
height: barH,
fill: "#f09a35",
}));
});
const xOf = (value) => left + (value - min) / span * innerW;
if (Number.isFinite(mean)) svg.append(svgEl("line", { x1: xOf(mean), y1: top, x2: xOf(mean), y2: top + innerH, stroke: "#19c9d2", "stroke-width": 1.6 }));
if (Number.isFinite(median) && Math.abs(median - mean) > span * 0.04) {
svg.append(svgEl("line", { x1: xOf(median), y1: top, x2: xOf(median), y2: top + innerH, stroke: "#19c9d2", "stroke-width": 1, "stroke-dasharray": "3 3" }));
}
chartTickValues(min, max, 5).forEach((value, i, ticks) => {
const x = xOf(value);
svg.append(svgEl("line", { x1: x, y1: top + innerH, x2: x, y2: top + innerH + 3, stroke: "#4f4f4f", "stroke-width": 1 }));
const text = svgEl("text", {
x,
y: top + innerH + 14,
fill: "#a1a1a6",
"font-size": 8,
"text-anchor": i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle",
});
text.textContent = formatTick(value);
svg.append(text);
});
if (xLabel) appendAxisTitle(svg, xLabel, left + innerW / 2, height - 6);
if (yLabel) appendAxisTitle(svg, yLabel, 12, top + innerH / 2, { rotate: -90 });
return svg;
}
function roseSvg(gammas) {
const bins = 16;
const counts = Array(bins).fill(0);
gammas.forEach((gamma) => {
const angle = ((gamma % 360) + 360) % 360;
counts[Math.min(bins - 1, Math.floor(angle / 360 * bins))] += 1;
});
const peak = Math.max(1, ...counts);
const width = 200, height = 210, cx = 100, cy = 98, maxR = 68;
const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
svg.append(svgEl("circle", { cx, cy, r: maxR, fill: "none", stroke: "#3d3d3d" }));
svg.append(svgEl("circle", { cx, cy, r: maxR * 0.75, fill: "none", stroke: "#303030" }));
svg.append(svgEl("circle", { cx, cy, r: maxR * 0.5, fill: "none", stroke: "#303030" }));
svg.append(svgEl("circle", { cx, cy, r: maxR * 0.25, fill: "none", stroke: "#303030" }));
for (let i = 0; i < 8; i++) {
const a = i / 8 * Math.PI * 2 - Math.PI / 2;
svg.append(svgEl("line", {
x1: cx + Math.cos(a) * 8,
y1: cy + Math.sin(a) * 8,
x2: cx + Math.cos(a) * maxR,
y2: cy + Math.sin(a) * maxR,
stroke: "#303030",
"stroke-width": 1,
}));
}
counts.forEach((count, i) => {
if (!count) return;
const a0 = i / bins * Math.PI * 2 - Math.PI / 2;
const a1 = (i + 1) / bins * Math.PI * 2 - Math.PI / 2;
const r = 10 + count / peak * (maxR - 10);
const path = [
`M ${cx} ${cy}`,
`L ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r}`,
`A ${r} ${r} 0 0 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`,
"Z",
].join(" ");
svg.append(svgEl("path", { d: path, fill: "#f09a35", "fill-opacity": 0.88, stroke: "#0b2238", "stroke-width": 0.6 }));
});
[
["0°", cx, cy - maxR - 10],
["90°", cx + maxR + 14, cy + 3],
["180°", cx, cy + maxR + 14],
["270°", cx - maxR - 14, cy + 3],
].forEach(([label, x, y]) => {
const text = svgEl("text", { x, y, fill: "#a1a1a6", "font-size": 9, "text-anchor": "middle" });
text.textContent = label;
svg.append(text);
});
appendAxisTitle(svg, "Travel direction γ (°)", cx, height - 8);
return svg;
}
function scatterSvg(xs, ys, { xMin, xMax, yMin, yMax, formatX, formatY, xLabel = "", yLabel = "" }) {
const width = 300, height = 188, left = 48, right = 14, top = 14, bottom = 42;
const innerW = width - left - right, innerH = height - top - bottom;
const xSpan = xMax - xMin || 1;
const ySpan = yMax - yMin || 1;
const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
svg.append(svgEl("line", { x1: left, y1: top + innerH, x2: left + innerW, y2: top + innerH, stroke: "#4f4f4f" }));
svg.append(svgEl("line", { x1: left, y1: top, x2: left, y2: top + innerH, stroke: "#4f4f4f" }));
const xOf = (value) => left + (value - xMin) / xSpan * innerW;
const yOf = (value) => top + innerH - (value - yMin) / ySpan * innerH;
chartTickValues(xMin, xMax, 5).forEach((value, i, ticks) => {
const x = xOf(value);
svg.append(svgEl("line", { x1: x, y1: top, x2: x, y2: top + innerH, stroke: "#303030", "stroke-width": 1 }));
svg.append(svgEl("line", { x1: x, y1: top + innerH, x2: x, y2: top + innerH + 3, stroke: "#4f4f4f", "stroke-width": 1 }));
const text = svgEl("text", {
x,
y: top + innerH + 14,
fill: "#a1a1a6",
"font-size": 8,
"text-anchor": i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle",
});
text.textContent = formatX(value);
svg.append(text);
});
chartTickValues(yMin, yMax, 5).forEach((value) => {
const y = yOf(value);
svg.append(svgEl("line", { x1: left, y1: y, x2: left + innerW, y2: y, stroke: "#303030", "stroke-width": 1 }));
svg.append(svgEl("line", { x1: left - 3, y1: y, x2: left, y2: y, stroke: "#4f4f4f", "stroke-width": 1 }));
const text = svgEl("text", {
x: left - 5,
y: y + 3,
fill: "#a1a1a6",
"font-size": 8,
"text-anchor": "end",
});
text.textContent = formatY(value);
svg.append(text);
});
xs.forEach((x, i) => {
svg.append(svgEl("circle", { cx: xOf(x), cy: yOf(ys[i]), r: 3, fill: "#19c9d2", "fill-opacity": 0.85 }));
});
if (xLabel) appendAxisTitle(svg, xLabel, left + innerW / 2, height - 6);
if (yLabel) appendAxisTitle(svg, yLabel, 13, top + innerH / 2, { rotate: -90 });
return svg;
}
function stainLocationMap(stains, image) {
const wrap = document.createElement("div");
wrap.className = "stain-chart-map";
const img = document.createElement("img");
img.src = image.element.src;
img.alt = "";
const svg = svgEl("svg", {
viewBox: `0 0 ${image.width} ${image.height}`,
preserveAspectRatio: "xMidYMid meet",
});
const size = Math.max(image.width, image.height);
stains.forEach((stain) => {
const t = Math.min(1, Math.max(0, ellipseAlphaDegrees(stain) / 90));
const fill = `rgb(${Math.round(240 - t * 200)}, ${Math.round(154 + t * 50)}, ${Math.round(53 + t * 160)})`;
svg.append(svgEl("circle", {
cx: stain.cx,
cy: stain.cy,
r: Math.max(4, size * 0.007),
fill,
"fill-opacity": 0.9,
stroke: "#0b2238",
"stroke-width": size * 0.0015,
}));
});
wrap.append(img, svg);
return wrap;
}
const stainChartViewerView = { x: 0, y: 0, scale: 1, drag: null };
let stainChartViewerSpecs = [];
let stainChartViewerIndex = 0;
function applyStainChartViewerView() {
const content = $("#stainChartViewerContent");
if (!content) return;
content.style.transform = `translate(${stainChartViewerView.x}px, ${stainChartViewerView.y}px) scale(${stainChartViewerView.scale})`;
}
function resetStainChartViewerView() {
stainChartViewerView.x = 0;
stainChartViewerView.y = 0;
stainChartViewerView.scale = 1;
stainChartViewerView.drag = null;
applyStainChartViewerView();
}
function openStainChartViewerAt(index) {
if (!stainChartViewerSpecs.length) return;
const count = stainChartViewerSpecs.length;
stainChartViewerIndex = ((index % count) + count) % count;
const spec = stainChartViewerSpecs[stainChartViewerIndex];
const viewer = $("#stainChartViewer");
$("#stainChartViewerTitle").textContent = spec.title;
$("#stainChartViewerCaption").textContent = spec.caption;
const host = $("#stainChartViewerContent");
host.innerHTML = "";
host.append(spec.node.cloneNode(true));
viewer.hidden = false;
const prev = $("#stainChartViewerPrev");
const next = $("#stainChartViewerNext");
if (prev) prev.disabled = count < 2;
if (next) next.disabled = count < 2;
const counter = $("#stainChartViewerCounter");
if (counter) counter.textContent = `${stainChartViewerIndex + 1} / ${count}`;
resetStainChartViewerView();
}
function cycleStainChartViewer(delta) {
if ($("#stainChartViewer")?.hidden || stainChartViewerSpecs.length < 2) return;
openStainChartViewerAt(stainChartViewerIndex + delta);
}
function closeStainChartViewer() {
const viewer = $("#stainChartViewer");
if (!viewer || viewer.hidden) return;
viewer.hidden = true;
$("#stainChartViewerContent").innerHTML = "";
stainChartViewerView.drag = null;
}
function bindStainChartViewer() {
const stage = $("#stainChartViewerStage");
if (!stage || stage.dataset.bound) return;
stage.dataset.bound = "true";
stage.addEventListener("wheel", (event) => {
event.preventDefault();
event.stopPropagation();
const rect = stage.getBoundingClientRect();
const mx = event.clientX - rect.left;
const my = event.clientY - rect.top;
const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
const next = Math.min(14, Math.max(1, stainChartViewerView.scale * factor));
const ratio = next / stainChartViewerView.scale;
stainChartViewerView.x = mx - (mx - stainChartViewerView.x) * ratio;
stainChartViewerView.y = my - (my - stainChartViewerView.y) * ratio;
stainChartViewerView.scale = next;
applyStainChartViewerView();
}, { passive: false });
stage.addEventListener("pointerdown", (event) => {
if (event.button !== 0) return;
if (event.target.closest(".stain-chart-nav")) return;
stainChartViewerView.drag = { x: event.clientX - stainChartViewerView.x, y: event.clientY - stainChartViewerView.y };
stage.classList.add("is-panning");
stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
if (!stainChartViewerView.drag) return;
stainChartViewerView.x = event.clientX - stainChartViewerView.drag.x;
stainChartViewerView.y = event.clientY - stainChartViewerView.drag.y;
applyStainChartViewerView();
});
const endPan = () => {
stainChartViewerView.drag = null;
stage.classList.remove("is-panning");
};
stage.addEventListener("pointerup", endPan);
stage.addEventListener("pointercancel", endPan);
$("#stainChartViewerPrev")?.addEventListener("click", (event) => {
event.stopPropagation();
cycleStainChartViewer(-1);
});
$("#stainChartViewerNext")?.addEventListener("click", (event) => {
event.stopPropagation();
cycleStainChartViewer(1);
});
}
function openStainChart(session) {
fillStainChart(session);
$("#stainChartDialog").showModal();
}
function closeStainChart() {
closeStainChartViewer();
const dialog = $("#stainChartDialog");
if (dialog.open) dialog.close();
}
function collectStainSeries(session, image = activeImage()) {
const stains = sessionStains(session, image);
const lengths = [];
const widths = [];
const alphas = [];
const gammas = [];
stains.forEach((stain) => {
lengths.push(Math.abs(stain.rx) * 2);
widths.push(Math.abs(stain.ry) * 2);
alphas.push(ellipseAlphaDegrees(stain));
gammas.push(ellipseGammaDegrees(stain));
});
return {
stains,
lengths,
widths,
alphas,
gammas,
lengthStats: numericStats(lengths),
widthStats: numericStats(widths),
alphaStats: numericStats(alphas),
gammaStats: numericStats(gammas),
};
}
function stainChartSpecs(session, image = activeImage()) {
const series = collectStainSeries(session, image);
if (!series.stains.length) return [];
const { stains, lengths, widths, alphas, gammas, lengthStats, widthStats, alphaStats } = series;
const sizeUnit = (pixels) => calibratedLength(pixels, image);
const widthMax = widthStats.max === widthStats.min ? widthStats.min + 1 : widthStats.max;
const lengthMax = lengthStats.max === lengthStats.min ? lengthStats.min + 1 : lengthStats.max;
const units = image?.calibration?.units || "px";
const widthAxis = `Stain width (${units})`;
const lengthAxis = `Stain length (${units})`;
return [
{
title: "Impact angle",
caption: "Alpha from width/length. Near 90° is steep; lower values are more glancing. Cyan line is the mean.",
node: histogramSvg(alphas, {
min: 0,
max: 90,
bins: 9,
mean: alphaStats.mean,
median: alphaStats.median,
formatTick: (value) => `${value.toFixed(0)}°`,
xLabel: "Impact angle α (°)",
yLabel: "Number of stains",
}),
},
{
title: "Stain width",
caption: "Width is the size cue (length also includes elongation). Smaller widths often go with higher energy.",
node: histogramSvg(widths, {
min: widthStats.min,
max: widthMax,
bins: Math.min(10, Math.max(5, Math.ceil(Math.sqrt(widths.length)))),
mean: widthStats.mean,
median: widthStats.median,
formatTick: (value) => sizeUnit(value),
xLabel: widthAxis,
yLabel: "Number of stains",
}),
},
{
title: "Travel direction",
caption: "Gamma rose. One lobe is a common path; opposite lobes mean mixed or opposing travel. Angles are γ in degrees.",
node: roseSvg(gammas),
},
{
title: "Width vs impact angle",
caption: "Each stain is a point. Small-and-steep sits left and high; large-and-glancing sits right and low.",
node: scatterSvg(widths, alphas, {
xMin: widthStats.min,
xMax: widthMax,
yMin: 0,
yMax: 90,
formatX: (value) => sizeUnit(value),
formatY: (value) => `${value.toFixed(0)}°`,
xLabel: widthAxis,
yLabel: "Impact angle α (°)",
}),
},
{
title: "Length vs impact angle",
caption: "Each stain is a point. Longer stains often sit lower (more glancing); short-and-steep sits left and high.",
node: scatterSvg(lengths, alphas, {
xMin: lengthStats.min,
xMax: lengthMax,
yMin: 0,
yMax: 90,
formatX: (value) => sizeUnit(value),
formatY: (value) => `${value.toFixed(0)}°`,
xLabel: lengthAxis,
yLabel: "Impact angle α (°)",
}),
},
{
title: "Location",
caption: "Dots on the photo. Color goes from orange (low alpha / glancing) to cyan (near 90°).",
kind: "map",
stains,
node: stainLocationMap(stains, image),
},
];
}
function locationMapDataUrl(stains, image, maxEdge = 1600) {
const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
const width = Math.max(1, Math.round(image.width * scale));
const height = Math.max(1, Math.round(image.height * scale));
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#111";
ctx.fillRect(0, 0, width, height);
ctx.drawImage(image.element, 0, 0, width, height);
const size = Math.max(width, height);
stains.forEach((stain) => {
const t = Math.min(1, Math.max(0, ellipseAlphaDegrees(stain) / 90));
ctx.beginPath();
ctx.arc(stain.cx * scale, stain.cy * scale, Math.max(4, size * 0.007), 0, Math.PI * 2);
ctx.fillStyle = `rgb(${Math.round(240 - t * 200)}, ${Math.round(154 + t * 50)}, ${Math.round(53 + t * 160)})`;
ctx.fill();
ctx.lineWidth = Math.max(1, size * 0.0015);
ctx.strokeStyle = "#0b2238";
ctx.stroke();
});
return canvas.toDataURL("image/jpeg", 0.88);
}
function chartNodeMarkup(spec, image) {
if (spec.kind === "map") return `<img src="${locationMapDataUrl(spec.stains, image)}" alt="">`;
const svg = spec.node.cloneNode(true);
svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
return svg.outerHTML;
}
function fillStainChart(session, image = activeImage()) {
const stains = sessionStains(session, image);
const empty = $("#stainChartEmpty");
const summary = $("#stainChartSummary");
const tableWrap = $("#stainChartTableWrap");
const body = $("#stainChartBody");
const graphs = $("#stainChartGraphs");
empty.hidden = stains.length > 0;
summary.hidden = stains.length === 0;
tableWrap.hidden = stains.length === 0;
graphs.hidden = stains.length === 0;
summary.innerHTML = "";
body.innerHTML = "";
graphs.innerHTML = "";
if (!stains.length) return;
const series = collectStainSeries(session, image);
series.stains.forEach((stain, index) => {
const length = series.lengths[index];
const width = series.widths[index];
const alpha = series.alphas[index];
const gamma = series.gammas[index];
const row = document.createElement("tr");
row.innerHTML = `<td>${stain.stainNumber || index + 1}</td><td>${stain.source === "manual" ? "manual" : "auto"}</td><td>${calibratedLength(length, image)}</td><td>${calibratedLength(width, image)}</td><td>${alpha.toFixed(1)}°</td><td>${gamma.toFixed(1)}°</td>`;
body.append(row);
});
const counts = stainSourceCounts(session, image);
const { lengthStats, widthStats, alphaStats, gammaStats } = series;
const items = [
["Auto", String(counts.auto)],
["Manual", String(counts.manual)],
["Avg length", calibratedLength(lengthStats.mean, image)],
["Avg width", calibratedLength(widthStats.mean, image)],
["Avg alpha", `${alphaStats.mean.toFixed(1)}°`],
["Avg gamma", `${gammaStats.mean.toFixed(1)}°`],
["Min length", calibratedLength(lengthStats.min, image)],
["Max length", calibratedLength(lengthStats.max, image)],
["Min width", calibratedLength(widthStats.min, image)],
["Max width", calibratedLength(widthStats.max, image)],
["Median length", calibratedLength(lengthStats.median, image)],
["Median width", calibratedLength(widthStats.median, image)],
["Stdev length", calibratedLength(lengthStats.stdev, image)],
["Stdev width", calibratedLength(widthStats.stdev, image)],
["Density", stainDensityLabel(session, image)],
];
items.forEach(([label, value]) => {
const item = document.createElement("div");
item.innerHTML = `<span>${label}</span><strong></strong>`;
item.querySelector("strong").textContent = value;
summary.append(item);
});
stainChartViewerSpecs = stainChartSpecs(session, image);
stainChartViewerSpecs.forEach((spec, index) => {
graphs.append(stainChartPanel(spec, index));
});
}
function isSessionStain(object) {
return Boolean(object?.sessionId && object.type === "halfEllipse");
}
function objectIsDrawn(object, image = activeImage()) {
if (!object || object.visible === false) return false;
if (object.sessionId) {
const parent = image?.objects.find((item) => item.id === object.sessionId);
if (parent?.visible === false) return false;
}
return true;
}
function ensureStainSession(image = activeImage(), { record = true } = {}) {
if (!image) return null;
let session = stainSession(image);
if (session) return session;
if (record) recordHistory();
session = makeObject("stainCount", {
stainColor: null,
stainColorLight: null,
backgroundColor: null,
smallSize: null,
largeSize: null,
detectRegion: [],
excludeRegions: [],
direction: null,
directionStart: null,
directionEnd: null,
separation: 20,
sizeTune: 10,
fill: 15,
seedCenters: [],
});
image.objects.push(session);
return session;
}
function adoptOrphanStains(image = activeImage()) {
if (!image) return;
const orphans = image.objects.filter((object) => (object.type === "halfEllipse" || object.type === "ellipse") && !object.sessionId);
if (!orphans.length) return;
const session = ensureStainSession(image, { record: false });
orphans.forEach((object) => {
object.sessionId = session.id;
if (!object.source) object.source = "manual";
});
renumberStains(session, image);
}
function setStainMode(mode) {
state.stainMode = mode;
state.draft = null;
updateHint();
draw();
}
const stainWizardSteps = [
{
id: "stainColor",
title: "Sample darkest color of stain",
copy: "Click a typical stain body — the darker, well-formed part, not the washed tail.",
waiting: "Click the image to sample.",
mode: "stainColor",
required: true,
done: (session) => Boolean(session?.stainColor),
status: (session) => session?.stainColor,
},
{
id: "stainColorLight",
title: "Sample lightest color of stain",
copy: "Click a lighter or wetter part of a stain body — still the round body, not the tail. Skip if the stains are even in color.",
waiting: "Click the image to sample.",
mode: "stainColorLight",
optional: true,
done: (session) => Boolean(session?.stainColorLight),
status: (session) => session?.stainColorLight,
},
{
id: "backgroundColor",
title: "Sample the stain background",
copy: "Click the surface next to the stains (paint, tile, drywall). Detection is “closer to stain than to this color.”",
waiting: "Click the image to sample.",
mode: "backgroundColor",
required: true,
done: (session) => Boolean(session?.backgroundColor),
status: (session) => session?.backgroundColor,
},
{
id: "smallSize",
title: "Sample length of shortest stain",
copy: "Drag across one of the smaller stains you want counted. That sets the minimum size.",
waiting: "Drag across a small stain.",
mode: "smallSize",
required: true,
done: (session) => Number.isFinite(session?.smallSize),
status: (session) => formatStainSampleSize(session?.smallSize),
},
{
id: "largeSize",
title: "Sample length of longest stain",
copy: "Drag across one of the larger stains. That sets the maximum size.",
waiting: "Drag across a large stain.",
mode: "largeSize",
required: true,
done: (session) => Number.isFinite(session?.largeSize),
status: (session) => formatStainSampleSize(session?.largeSize),
},
{
id: "direction",
title: "Mark the general stain direction",
copy: "Drag toward the tails. The mask sets each stain’s long-axis; this arrow chooses which way along that axis (toward the tail).",
waiting: "Drag an arrow on the image.",
mode: "stainDirection",
required: true,
done: (session) => Number.isFinite(session?.direction),
status: (session) => formatStainDirection(session),
},
{
id: "detect",
title: "Draw the search area",
copy: "Click around the region to search. Click the first point or right-click to close. Skip this to search the whole image.",
waiting: "Click points around the search area.",
mode: "detect",
optional: true,
done: (session) => session?.detectRegion?.length >= 3,
status: (session) => session?.detectRegion?.length >= 3 ? "Search area set." : "",
},
{
id: "exclude",
title: "Draw exclusion areas",
copy: "Draw around scale bars, labels, or other objects to skip. You can draw several regions. Right-click to close each one, then click Next when finished. Skip if nothing needs excluding.",
waiting: "Click points around an area to skip.",
mode: "exclude",
optional: true,
stayInMode: true,
done: () => false,
status: (session) => {
const count = (session?.excludeRegions || []).length;
return count ? `${count} exclude region${count === 1 ? "" : "s"} drawn. Click Next when ready.` : "";
},
},
{
id: "detectRun",
title: "Assisted stain detection",
copy: "Tune the live mask, then Find Centers. Arrows use the mask long-axis with polarity from your general direction; red means near-circular (α > 80°) — inspect those. Fit Ellipses, then Switch to Manual if required.",
waiting: "",
mode: null,
required: false,
done: (session) => sessionStains(session).length > 0,
},
];
function formatStainDirection(session) {
if (!Number.isFinite(session?.direction)) return "";
return `γ ${ellipseGammaDegrees({ rotation: session.direction }).toFixed(1)}°`;
}
function formatStainSampleSize(pixels) {
if (!Number.isFinite(pixels)) return "";
const units = activeImage()?.calibration?.units || "px";
const scale = unitScale() || 1;
return `${(pixels * scale).toFixed(2)} ${units}`;
}
function firstIncompleteStainStep(session) {
const index = stainWizardSteps.findIndex((step) => step.required && !step.done(session));
return index < 0 ? stainWizardSteps.length - 1 : index;
}
function openStainWizard() {
state.stainWizardOpen = true;
goStainWizardStep(firstIncompleteStainStep(stainSession()));
}
function closeStainWizard() {
state.stainWizardOpen = false;
const panel = $("#stainWizard");
if (panel?.open) panel.close();
}
function cancelStainWizard() {
const image = activeImage();
const session = stainSession(image);
if (image && session) {
recordHistory();
image.objects = image.objects.filter((object) => object.id !== session.id && object.sessionId !== session.id);
}
state.stainMode = null;
state.draft = null;
state.selectedObjectId = null;
state.selectedSeedId = null;
state.stainWizardIndex = 0;
closeStainWizard();
setTool("select");
refreshUI();
}
function goStainWizardStep(index) {
state.stainWizardIndex = Math.max(0, Math.min(stainWizardSteps.length - 1, index));
state.stainWizardOpen = true;
state.draft = null;
const step = stainWizardSteps[state.stainWizardIndex];
const session = stainSession();
state.stainMode = step.mode || (step.id === "detectRun" && (session?.seedCenters || []).length ? "centers" : null);
renderStainWizard();
updateHint();
draw();
}
function advanceStainWizardIfDone() {
if (!state.stainWizardOpen) return;
const session = stainSession();
const step = stainWizardSteps[state.stainWizardIndex];
if (step?.stayInMode) {
renderStainWizard();
return;
}
if (step?.done?.(session) && state.stainWizardIndex < stainWizardSteps.length - 1) goStainWizardStep(state.stainWizardIndex + 1);
else renderStainWizard();
}
function renderStainWizard() {
const panel = $("#stainWizard");
if (!panel) return;
if (!state.stainWizardOpen) {
if (panel.open) panel.close();
return;
}
if (!panel.open) panel.show();
applyStainWizardPosition();
const session = stainSession();
const index = state.stainWizardIndex;
const step = stainWizardSteps[index];
const last = index === stainWizardSteps.length - 1;
$("#stainWizardStep").textContent = `Step ${index + 1} of ${stainWizardSteps.length}`;
$("#stainWizardTitle").textContent = step.title;
$("#stainWizardCopy").textContent = step.copy;
const dots = $("#stainWizardDots");
dots.innerHTML = "";
stainWizardSteps.forEach((item, i) => {
const dot = document.createElement("span");
if (i === index) dot.className = "current";
else if (item.done(session)) dot.className = "done";
dots.append(dot);
});
const status = $("#stainWizardStatus");
status.innerHTML = "";
if (step.status?.(session)) {
if (step.id === "stainColor" || step.id === "stainColorLight" || step.id === "backgroundColor") status.append(swatchRow("Sampled", step.status(session)));
else status.textContent = step.status(session);
} else if (step.waiting && state.stainMode === step.mode) {
status.textContent = step.waiting;
}
const extra = $("#stainWizardExtra");
extra.className = "stain-wizard-extra";
if (last && session) {
if (extra.dataset.step !== "detectRunAssisted") {
extra.innerHTML = "";
extra.dataset.step = "detectRunAssisted";
extra.append(rangeField("Color Threshold", session.separation ?? 20, (value) => session.separation = value));
extra.append(rangeField("Size Threshold", session.sizeTune ?? 10, (value) => session.sizeTune = value));
extra.append(rangeField("Front / fill", session.fill ?? 15, (value) => session.fill = value));
extra.append(sessionButton("Find Centers", autoDetectStains));
const fitBtn = sessionButton("Fit Ellipses", fitEllipsesFromCenters);
fitBtn.dataset.fitEllipses = "1";
extra.append(fitBtn);
const modeToggle = sessionButton("Switch to Manual", () => {
if (state.stainVariant === "manual") enterAssistedFromWizard();
else enterManualStains();
});
modeToggle.dataset.manualToggle = "1";
extra.append(modeToggle);
extra.append(Object.assign(document.createElement("p"), { className: "session-note", id: "stainWizardCount" }));
}
const fitBtn = extra.querySelector("[data-fit-ellipses]");
if (fitBtn) fitBtn.disabled = !(session.seedCenters || []).length;
const modeToggle = extra.querySelector("[data-manual-toggle]");
if (modeToggle) modeToggle.textContent = state.stainVariant === "manual" ? "Switch to Assisted" : "Switch to Manual";
const note = $("#stainWizardCount");
if (note) {
const seeds = (session.seedCenters || []).length;
note.textContent = seeds ? `${seeds} center${seeds === 1 ? "" : "s"} · ${stainCountSummary(session)}` : stainCountSummary(session);
}
} else {
extra.dataset.step = step.id;
extra.innerHTML = "";
}
$("#stainWizardBack").disabled = index === 0;
$("#stainWizardSkip").hidden = !step.optional;
$("#stainWizardNext").textContent = last ? "Done" : "Next";
$("#stainWizardNext").disabled = !last && step.required && !step.done(session);
}
function stainWizardBack() {
goStainWizardStep(state.stainWizardIndex - 1);
}
function stainWizardSkip() {
goStainWizardStep(state.stainWizardIndex + 1);
}
function stainWizardNext() {
if (state.stainWizardIndex >= stainWizardSteps.length - 1) {
closeStainWizard();
return;
}
const step = stainWizardSteps[state.stainWizardIndex];
if (step.required && !step.done(stainSession())) return;
goStainWizardStep(state.stainWizardIndex + 1);
}
function applyStainWizardPosition() {
const panel = $("#stainWizard");
if (!panel) return;
const width = panel.offsetWidth || 320;
const height = panel.offsetHeight || 520;
if (!state.stainWizardPos) {
state.stainWizardPos = {
left: Math.max(16, window.innerWidth - width - 24),
top: 78,
};
}
const left = Math.max(0, Math.min(window.innerWidth - width, state.stainWizardPos.left));
const top = Math.max(0, Math.min(window.innerHeight - height, state.stainWizardPos.top));
state.stainWizardPos = { left, top };
panel.style.left = `${left}px`;
panel.style.top = `${top}px`;
panel.style.right = "auto";
}
function bindStainWizardDrag() {
const panel = $("#stainWizard");
const handle = panel?.querySelector(".stain-wizard-head");
if (!panel || !handle) return;
handle.addEventListener("pointerdown", (event) => {
if (event.button !== 0 || event.target.closest("button")) return;
const rect = panel.getBoundingClientRect();
state.stainWizardDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
handle.setPointerCapture(event.pointerId);
});
handle.addEventListener("pointermove", (event) => {
if (!state.stainWizardDrag) return;
state.stainWizardPos = {
left: event.clientX - state.stainWizardDrag.x,
top: event.clientY - state.stainWizardDrag.y,
};
applyStainWizardPosition();
});
const endDrag = () => { state.stainWizardDrag = null; };
handle.addEventListener("pointerup", endDrag);
handle.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", () => { if (state.stainWizardOpen) applyStainWizardPosition(); });
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
function stainSamples(session) {
return [rgbFromHex(session.stainColor), rgbFromHex(session.stainColorLight)].filter(Boolean);
}
function isStainPixel(rgb, stains, background, separation) {
const t = (Number(separation) || 0) / 100 * 0.55;
const toBg = colorDistance(rgb, background);
for (const stain of stains) {
const pair = Math.max(1, colorDistance(stain, background));
if (toBg - colorDistance(rgb, stain) > t * pair) return true;
}
return false;
}
function stainMaskKey(session) {
return JSON.stringify({
stainColor: session.stainColor,
stainColorLight: session.stainColorLight,
backgroundColor: session.backgroundColor,
detectRegion: session.detectRegion,
excludeRegions: session.excludeRegions,
separation: session.separation,
sizeTune: session.sizeTune,
fill: session.fill,
smallSize: session.smallSize,
largeSize: session.largeSize,
});
}
function buildStainMask(image, session) {
const stains = stainSamples(session);
const background = rgbFromHex(session.backgroundColor);
if (!stains.length || !background) return null;
const key = stainMaskKey(session);
const cached = stainMaskCache.get(session.id);
if (cached?.key === key) return cached;
const pixels = ensureImagePixels(image);
const pixelCount = image.width * image.height;
const maxPixels = 24_000_000;
const scale = pixelCount > maxPixels ? Math.sqrt(maxPixels / pixelCount) : 1;
const width = Math.max(1, Math.round(image.width * scale));
const height = Math.max(1, Math.round(image.height * scale));
const mask = new Uint8Array(width * height);
const source = pixels.data;
const sourceWidth = image.width;
for (let y = 0; y < height; y++) {
const iy = scale === 1 ? y : Math.min(image.height - 1, Math.round(y / scale));
for (let x = 0; x < width; x++) {
const ix = scale === 1 ? x : Math.min(image.width - 1, Math.round(x / scale));
if (!inDetectRegion({ x: ix, y: iy }, session) || inExcludeRegion({ x: ix, y: iy }, session)) continue;
const i = (iy * sourceWidth + ix) * 4;
const rgb = { r: source[i], g: source[i + 1], b: source[i + 2] };
if (isStainPixel(rgb, stains, background, session.separation)) mask[y * width + x] = 1;
}
}
filterStainMask(mask, width, height, scale, session);
const overlay = document.createElement("canvas");
overlay.width = width;
overlay.height = height;
const overlayCtx = overlay.getContext("2d");
const overlayData = overlayCtx.createImageData(width, height);
for (let y = 0; y < height; y++) {
for (let x = 0; x < width; x++) {
if (!mask[y * width + x]) continue;
const i = (y * width + x) * 4;
overlayData.data[i] = 25;
overlayData.data[i + 1] = 201;
overlayData.data[i + 2] = 210;
overlayData.data[i + 3] = 90;
}
}
overlayCtx.putImageData(overlayData, 0, 0);
const result = { key, scale, width, height, mask, overlay };
stainMaskCache.set(session.id, result);
return result;
}
function blobPassesFillFilter(blob, scale, session) {
const bw = blob.maxX - blob.minX + 1;
const bh = blob.maxY - blob.minY + 1;
const size = Math.max(bw, bh) / Math.max(scale, .0001);
const large = Number(session.largeSize);
const treatAsLarge = Number.isFinite(large) ? size > large * 0.45 : size > 48;
if (treatAsLarge) return true;
const minSolidity = 0.06 + (Number(session.fill) || 0) / 100 * 0.4;
return blob.area / Math.max(1, bw * bh) >= minSolidity;
}
function filterStainMask(mask, width, height, scale, session) {
const band = stainSizeBand(session);
const blobs = connectedComponents(mask, width, height);
mask.fill(0);
for (const blob of blobs) {
const bw = blob.maxX - blob.minX + 1;
const bh = blob.maxY - blob.minY + 1;
if (!blobPassesFillFilter(blob, scale, session)) continue;
const size = Math.max(bw, bh) / Math.max(scale, .0001);
if (size < band.min || size > band.max) continue;
for (const point of blob.pixels) mask[point.y * width + point.x] = 1;
}
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
function drawSeedCenters(drawCtx, image, zoom) {
const session = stainSession(image);
const seeds = session?.seedCenters || [];
if (!seeds.length) return;
seeds.forEach((seed) => {
const selected = seed.id === state.selectedSeedId;
const radius = (selected ? 6 : 5) / zoom;
const angle = Number.isFinite(seed.direction)
? seed.direction
: (Number.isFinite(session.direction) ? session.direction : null);
const accent = seed.directionUncertain ? "#e06a6a" : "#f09a35";
if (Number.isFinite(angle)) {
const start = (radius + 1.5 / zoom);
const length = 66 / zoom;
const tipX = seed.x + Math.cos(angle) * length;
const tipY = seed.y + Math.sin(angle) * length;
drawCtx.beginPath();
drawCtx.moveTo(seed.x + Math.cos(angle) * start, seed.y + Math.sin(angle) * start);
drawCtx.lineTo(tipX, tipY);
const head = 6 / zoom;
drawCtx.lineTo(tipX + Math.cos(angle + 2.6) * head, tipY + Math.sin(angle + 2.6) * head);
drawCtx.moveTo(tipX, tipY);
drawCtx.lineTo(tipX + Math.cos(angle - 2.6) * head, tipY + Math.sin(angle - 2.6) * head);
drawCtx.lineWidth = (selected ? 2 : 1.5) / zoom;
drawCtx.strokeStyle = accent;
drawCtx.stroke();
drawCtx.beginPath();
drawCtx.arc(tipX, tipY, (selected ? 4.5 : 3.5) / zoom, 0, Math.PI * 2);
drawCtx.fillStyle = selected ? accent : "#0b2238";
drawCtx.fill();
drawCtx.lineWidth = 1.2 / zoom;
drawCtx.strokeStyle = selected ? "#0b2238" : accent;
drawCtx.stroke();
}
drawCtx.beginPath();
drawCtx.arc(seed.x, seed.y, radius, 0, Math.PI * 2);
drawCtx.fillStyle = accent;
drawCtx.fill();
drawCtx.lineWidth = 1.5 / zoom;
drawCtx.strokeStyle = "#0b2238";
drawCtx.stroke();
drawCtx.beginPath();
drawCtx.moveTo(seed.x - 3 / zoom, seed.y);
drawCtx.lineTo(seed.x + 3 / zoom, seed.y);
drawCtx.moveTo(seed.x, seed.y - 3 / zoom);
drawCtx.lineTo(seed.x, seed.y + 3 / zoom);
drawCtx.stroke();
});
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
for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]]) {
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
function fitHalfLength(pixels, preferredAngle) {
const n = pixels.length;
if (n < 6) return null;
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
if (span < 3) return null;
const step = Math.max(0.75, span / 36);
const band = Math.max(1, step * 0.9);
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
return count < 2 ? 0 : sMax - sMin;
};
const wStart = widthAt(tMin + step);
const wEnd = widthAt(tMax - step);
let tipIsMin = wStart >= wEnd;
if (Number.isFinite(preferredAngle)) {
const align = ux * Math.cos(preferredAngle) + uy * Math.sin(preferredAngle);
tipIsMin = align > 0;
}
const tTip = tipIsMin ? tMin : tMax;
const tBack = tipIsMin ? tMax : tMin;
const walk = tipIsMin ? 1 : -1;
const profile = [];
for (let t = tTip; walk > 0 ? t <= tBack : t >= tBack; t += walk * step) profile.push({ t, w: widthAt(t) });
if (profile.length < 4) {
profile.length = 0;
profile.push({ t: tTip, w: widthAt(tTip) }, { t: (tTip + tBack) / 2, w: widthAt((tTip + tBack) / 2) }, { t: tBack, w: widthAt(tBack) });
}
const smooth = profile.map((item, i) => {
const prev = profile[Math.max(0, i - 1)].w;
const next = profile[Math.min(profile.length - 1, i + 1)].w;
return { t: item.t, w: (prev + item.w + next) / 3 };
});
const start = Math.min(smooth.length - 2, Math.max(1, Math.floor(smooth.length * 0.06)));
let peak = start;
let risen = false;
for (let i = start; i < smooth.length - 1; i++) {
if (smooth[i].w > smooth[peak].w) peak = i;
if (smooth[i].w > smooth[start].w * 1.08) risen = true;
if (risen && i > peak && smooth[i].w < smooth[peak].w * 0.88) break;
}
let halfLen = Math.abs(smooth[peak].t - tTip);
let width = Math.max(smooth[peak].w, 1);
if (halfLen < 2) {
peak = Math.min(smooth.length - 1, Math.max(start, Math.floor(smooth.length * 0.35)));
halfLen = Math.max(2, Math.abs(smooth[peak].t - tTip));
width = Math.max(width, smooth[peak].w, 1);
}
let rx = halfLen;
let ry = width / 2;
if (ry > rx) ry = rx;
if (ry < rx * 0.06) ry = rx * 0.06;
const tip = { x: mx + tTip * ux, y: my + tTip * uy };
const equator = { x: mx + smooth[peak].t * ux, y: my + smooth[peak].t * uy };
return {
cx: equator.x,
cy: equator.y,
rx: Math.max(1, rx),
ry: Math.max(1, ry),
rotation: Math.atan2(tip.y - equator.y, tip.x - equator.x),
};
}
function clampHalfEllipse(geometry) {
const rx = Math.max(2, geometry.rx);
let ry = Math.max(1, geometry.ry);
if (ry > rx) ry = rx;
if (ry < rx * 0.06) ry = rx * 0.06;
return { ...geometry, rx, ry };
}
const STAIN_DIRECTION_BAND_DEFAULT_DEG = 3;
function stainDirectionToleranceDeg() {
const value = Number(state.prefs?.assisted?.directionToleranceDeg);
if (!Number.isFinite(value)) return STAIN_DIRECTION_BAND_DEFAULT_DEG;
return Math.max(0, Math.min(45, value));
}
function stainDirectionBandRad() {
return stainDirectionToleranceDeg() * Math.PI / 180;
}
function stainDirectionStepRad(band) {
if (!(band > 0)) return band;
return Math.max(0.5 * Math.PI / 180, band / 6);
}
function shortestAngleDelta(a, b) {
let delta = a - b;
while (delta > Math.PI) delta -= Math.PI * 2;
while (delta < -Math.PI) delta += Math.PI * 2;
return delta;
}
function halfEllipseScore(geometry, pixels, blobSet, tailPixels = []) {
const rx = Math.max(geometry.rx, 1);
const ry = Math.max(geometry.ry, 1);
let insideBlob = 0, missedFront = 0;
for (const point of pixels) {
const local = ellipseLocalPoint(geometry, point);
if (local.x < -0.5) continue;
const r = (local.x / rx) ** 2 + (local.y / ry) ** 2;
if (r <= 1) insideBlob += 1;
else missedFront += 1;
}
let coveredTail = 0;
for (const point of tailPixels) {
const local = ellipseLocalPoint(geometry, point);
if (local.x < 0) continue;
if ((local.x / rx) ** 2 + (local.y / ry) ** 2 <= 1) coveredTail += 1;
}
let insideEmpty = 0;
const reach = Math.max(rx, ry) + 2;
const step = Math.max(1, Math.round(Math.min(rx, ry) / 8));
for (let y = Math.floor(geometry.cy - reach); y <= geometry.cy + reach; y += step) {
for (let x = Math.floor(geometry.cx - reach); x <= geometry.cx + reach; x += step) {
if (blobSet.has(`${x},${y}`)) continue;
const local = ellipseLocalPoint(geometry, { x, y });
if (local.x < 0) continue;
if ((local.x / rx) ** 2 + (local.y / ry) ** 2 <= 1) insideEmpty += 1;
}
}
return insideBlob / Math.max(1, insideBlob + insideEmpty + missedFront + coveredTail * 1.4);
}
function refineHalfEllipse(geometry, pixels, options = {}) {
if (!pixels?.length) return geometry;
const blobSet = new Set(pixels.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`));
let best = clampHalfEllipse({ ...geometry });
const origin = { cx: best.cx, cy: best.cy, rx: best.rx, ry: best.ry, rotation: best.rotation || 0 };
const fromCenter = Boolean(options.fromCenter);
const tailPixels = options.tailPixels || [];
const maxAlong = fromCenter ? origin.rx * 0.15 : Infinity;
const maxAcross = fromCenter ? origin.ry * 0.15 : Infinity;
const minRx = fromCenter ? origin.rx * 0.85 : 0;
const minRy = fromCenter ? origin.ry * 0.85 : 0;
const preferredTravel = options.preferredTravel;
const directionBand = Number.isFinite(options.directionBand) ? options.directionBand : stainDirectionBandRad();
const preferredLeading = Number.isFinite(preferredTravel) ? normalizeAngle(preferredTravel + Math.PI) : null;
const rotationAllowed = (rotation) => {
if (!Number.isFinite(preferredLeading)) return true;
return Math.abs(shortestAngleDelta(rotation, preferredLeading)) <= directionBand + 1e-6;
};
const withinCenterBudget = (next) => {
const axisX = Math.cos(origin.rotation);
const axisY = Math.sin(origin.rotation);
const dx = next.cx - origin.cx;
const dy = next.cy - origin.cy;
const along = dx * axisX + dy * axisY;
const across = dx * -axisY + dy * axisX;
return Math.abs(along) <= maxAlong + 1e-6 && Math.abs(across) <= maxAcross + 1e-6;
};
let bestScore = halfEllipseScore(best, pixels, blobSet, tailPixels);
let step = Math.max(1.2, Math.min(best.rx, best.ry) * (fromCenter ? 0.18 : 0.12));
let angleStep = 0.06;
for (let pass = 0; pass < 12; pass++) {
let improved = false;
const axisX = Math.cos(best.rotation || 0);
const axisY = Math.sin(best.rotation || 0);
const trials = [
{ rx: best.rx + step },
{ rx: Math.max(minRx, best.rx - step) },
{ ry: best.ry + step },
{ ry: Math.max(minRy, best.ry - step) },
{ rotation: (best.rotation || 0) + angleStep },
{ rotation: (best.rotation || 0) - angleStep },
{ cx: best.cx + axisX * step, cy: best.cy + axisY * step },
{ cx: best.cx - axisX * step, cy: best.cy - axisY * step },
{ cx: best.cx - axisY * step, cy: best.cy + axisX * step },
{ cx: best.cx + axisY * step, cy: best.cy - axisX * step },
];
if (options.lockCenter && !fromCenter) trials.splice(6);
for (const change of trials) {
const next = clampHalfEllipse({ ...best, ...change });
if (next.rx < minRx - 1e-6 || next.ry < minRy - 1e-6) continue;
if (!withinCenterBudget(next)) continue;
if (!rotationAllowed(next.rotation || 0)) continue;
const score = halfEllipseScore(next, pixels, blobSet, tailPixels);
if (score > bestScore + 1e-4) {
best = next;
bestScore = score;
improved = true;
}
}
if (!improved) {
step *= 0.55;
angleStep *= 0.55;
if (step < 0.35) break;
}
}
return best;
}
function blobPixelsAt(built, x, y) {
if (!built) return null;
const sx = Math.max(0, Math.min(built.width - 1, Math.round(x * built.scale)));
const sy = Math.max(0, Math.min(built.height - 1, Math.round(y * built.scale)));
if (!built.mask[sy * built.width + sx]) return null;
const blobs = connectedComponents(built.mask, built.width, built.height);
const blob = blobs.find((item) => item.pixels.some((point) => point.x === sx && point.y === sy));
if (!blob) return null;
return blob.pixels.map((point) => ({ x: point.x / built.scale, y: point.y / built.scale }));
}
function stainSizeBand(session) {
let small = Number(session.smallSize);
let large = Number(session.largeSize);
if (!Number.isFinite(small) || !Number.isFinite(large)) return { min: 3, max: 800 };
if (small > large) [small, large] = [large, small];
const t = (Number(session.sizeTune) || 0) / 100;
const min = Math.max(2, small - (1 - t) * Math.max(small * 0.9, 20));
const max = large + (1 - t) * Math.max(large * 0.8, 40);
return { min, max };
}
function blobBodyPeak(pixels, direction) {
if (!pixels?.length) return null;
if (!Number.isFinite(direction) || pixels.length < 12) return blobInteriorPeak(pixels);
const ux = -Math.cos(direction);
const uy = -Math.sin(direction);
const vx = -uy, vy = ux;
let tMin = Infinity, tMax = -Infinity;
const ts = new Float64Array(pixels.length);
for (let i = 0; i < pixels.length; i++) {
const t = pixels[i].x * ux + pixels[i].y * uy;
ts[i] = t;
tMin = Math.min(tMin, t);
tMax = Math.max(tMax, t);
}
const span = tMax - tMin;
if (span < 4) return blobInteriorPeak(pixels);
const bins = Math.min(36, Math.max(8, Math.round(span / 2)));
const mins = new Array(bins).fill(Infinity);
const maxs = new Array(bins).fill(-Infinity);
const binOf = new Int16Array(pixels.length);
for (let i = 0; i < pixels.length; i++) {
const bin = Math.min(bins - 1, Math.max(0, Math.floor((ts[i] - tMin) / span * bins)));
binOf[i] = bin;
const s = pixels[i].x * vx + pixels[i].y * vy;
mins[bin] = Math.min(mins[bin], s);
maxs[bin] = Math.max(maxs[bin], s);
}
const tailEnd = Math.floor(bins * 0.3);
let bestW = 0;
for (let b = tailEnd; b < bins; b++) {
const w = Number.isFinite(mins[b]) ? maxs[b] - mins[b] : 0;
if (w > bestW) bestW = w;
}
const keep = new Array(bins).fill(false);
const floorW = bestW * 0.88;
for (let b = tailEnd; b < bins; b++) {
const w = Number.isFinite(mins[b]) ? maxs[b] - mins[b] : 0;
if (w >= floorW) keep[b] = true;
}
const body = [];
for (let i = 0; i < pixels.length; i++) {
if (keep[binOf[i]]) body.push(pixels[i]);
}
const region = body.length ? body : pixels;
if (region.length < 8) return blobInteriorPeak(region);
let cx = 0, cy = 0;
for (const point of region) {
cx += point.x;
cy += point.y;
}
return { x: cx / region.length, y: cy / region.length };
}
function blobInteriorPeak(pixels) {
if (!pixels?.length) return null;
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const set = new Set();
for (const point of pixels) {
set.add(`${point.x},${point.y}`);
minX = Math.min(minX, point.x);
minY = Math.min(minY, point.y);
maxX = Math.max(maxX, point.x);
maxY = Math.max(maxY, point.y);
}
const ox = minX - 1;
const oy = minY - 1;
const width = maxX - minX + 3;
const height = maxY - minY + 3;
const dist = new Int16Array(width * height);
dist.fill(32767);
const queue = [];
for (let y = 0; y < height; y++) {
for (let x = 0; x < width; x++) {
if (set.has(`${x + ox},${y + oy}`)) continue;
dist[y * width + x] = 0;
queue.push(y * width + x);
}
}
for (let i = 0; i < queue.length; i++) {
const index = queue[i];
const x = index % width;
const y = (index - x) / width;
const next = dist[index] + 1;
for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
const neighbor = ny * width + nx;
if (dist[neighbor] <= next) continue;
dist[neighbor] = next;
queue.push(neighbor);
}
}
let best = pixels[0], bestDist = -1;
for (const point of pixels) {
const value = dist[(point.y - oy) * width + (point.x - ox)];
if (value > bestDist) {
bestDist = value;
best = point;
}
}
return best;
}
function sessionSeeds(session) {
if (!session) return [];
if (!session.seedCenters) session.seedCenters = [];
return session.seedCenters;
}
function seedTravelAngle(seed, session = stainSession()) {
if (Number.isFinite(seed?.direction)) return seed.direction;
return Number.isFinite(session?.direction) ? session.direction : 0;
}
const STAIN_DIRECTION_UNCERTAIN_ALPHA_DEG = 80;
function alignTravelToGuide(maskTravel, guideTravel) {
if (!Number.isFinite(maskTravel)) return guideTravel;
if (!Number.isFinite(guideTravel)) return maskTravel;
const flipped = maskTravel + Math.PI;
return Math.abs(shortestAngleDelta(maskTravel, guideTravel)) <= Math.abs(shortestAngleDelta(flipped, guideTravel))
? maskTravel
: flipped;
}
function assignSeedDirectionFromMask(seed, session = stainSession(), image = activeImage(), built = null, blobs = null) {
if (!seed || !image) return seed;
const mask = built || buildStainMask(image, session);
if (!mask) {
seed.directionUncertain = true;
if (Number.isFinite(session?.direction)) seed.direction = session.direction;
return seed;
}
const components = blobs || connectedComponents(mask.mask, mask.width, mask.height);
const pixels = pixelsForSeed(seed, mask, components);
if (!pixels?.length || pixels.length < 6) {
seed.directionUncertain = true;
if (Number.isFinite(session?.direction)) seed.direction = session.direction;
return seed;
}
const axis = leadingAxisFromCenter(seed.x, seed.y, pixels);
const maskTravel = Math.atan2(-axis.uy, -axis.ux);
seed.direction = alignTravelToGuide(maskTravel, session?.direction);
const alphaEst = Math.asin(Math.min(1, 1 / Math.max(axis.aspect || 1, 1))) * 180 / Math.PI;
seed.directionAlphaEst = alphaEst;
seed.directionUncertain = alphaEst > STAIN_DIRECTION_UNCERTAIN_ALPHA_DEG;
return seed;
}
function seedVectorTip(seed, session, zoom) {
const angle = seedTravelAngle(seed, session);
const length = 66 / zoom;
return { x: seed.x + Math.cos(angle) * length, y: seed.y + Math.sin(angle) * length };
}
function hitSeedVectorTip(point, image = activeImage()) {
const session = stainSession(image);
if (!session || !image) return null;
const zoom = image.view.zoom;
const threshold = 10 / zoom;
let best = null, bestDist = threshold;
for (const seed of sessionSeeds(session)) {
if (!Number.isFinite(seed.direction) && !Number.isFinite(session.direction)) continue;
const d = distance(point, seedVectorTip(seed, session, zoom));
if (d <= bestDist) {
best = seed;
bestDist = d;
}
}
return best;
}
function hitSeedAt(point, image = activeImage()) {
const session = stainSession(image);
const seeds = sessionSeeds(session);
if (!seeds.length || !image) return null;
const threshold = 10 / image.view.zoom;
let best = null, bestDist = threshold;
for (const seed of seeds) {
const d = distance(point, seed);
if (d <= bestDist) {
best = seed;
bestDist = d;
}
}
return best;
}
function blobHasSeed(blob, seeds, scale) {
for (const seed of seeds) {
const sx = Math.round(seed.x * scale);
const sy = Math.round(seed.y * scale);
if (blob.pixels.some((point) => point.x === sx && point.y === sy)) return seed;
}
return null;
}
function addCenterFromClick(point, image) {
const session = ensureStainSession(image);
const built = buildStainMask(image, session);
if (built) {
const blobs = connectedComponents(built.mask, built.width, built.height);
const blob = blobAtPoint(blobs, point.x, point.y, built.scale);
if (blob) {
const existing = blobHasSeed(blob, sessionSeeds(session), built.scale);
if (existing) {
state.selectedSeedId = existing.id;
return existing;
}
const peak = blobBodyPeak(blob.pixels, session.direction);
return addSeedCenter({ x: peak.x / built.scale, y: peak.y / built.scale }, "manual");
}
}
return addSeedCenter(point, "manual");
}
function addSeedCenter(point, source = "manual") {
recordHistory();
const session = ensureStainSession();
const seeds = sessionSeeds(session);
const seed = { id: uid("seed"), x: point.x, y: point.y, source, direction: null, directionUncertain: false };
seeds.push(seed);
state.selectedSeedId = seed.id;
assignSeedDirectionFromMask(seed, session);
return seed;
}
function removeSeedCenter(seed) {
const session = stainSession();
if (!session || !seed) return;
recordHistory();
session.seedCenters = sessionSeeds(session).filter((item) => item.id !== seed.id);
if (state.selectedSeedId === seed.id) state.selectedSeedId = null;
refreshUI();
}
function enterCenterReview(count) {
state.stainMode = "centers";
state.draft = null;
state.selectedObjectId = stainSession()?.id || state.selectedObjectId;
const uncertain = sessionSeeds(stainSession()).filter((seed) => seed.directionUncertain).length;
updateHint(count
? `Drag a center to place it. Arrows follow the mask long-axis${uncertain ? ` · ${uncertain} red (α > 80°) need inspection` : ""}. Drag a tip to override, or press F to flip. Click a cyan stain to add a center. Right-click or Delete to remove.`
: "No centers yet. Click a cyan stain to add a center on the round body, then Fit Ellipses.");
refreshUI();
}
function localMaskPixels(built, x, y, radius = 28) {
if (!built) return [];
const r = Math.max(4, radius * built.scale);
const sx = x * built.scale;
const sy = y * built.scale;
const pixels = [];
const minX = Math.max(0, Math.floor(sx - r));
const maxX = Math.min(built.width - 1, Math.ceil(sx + r));
const minY = Math.max(0, Math.floor(sy - r));
const maxY = Math.min(built.height - 1, Math.ceil(sy + r));
const r2 = r * r;
for (let py = minY; py <= maxY; py++) {
for (let px = minX; px <= maxX; px++) {
if (!built.mask[py * built.width + px]) continue;
const dx = px - sx, dy = py - sy;
if (dx * dx + dy * dy > r2) continue;
pixels.push({ x: px / built.scale, y: py / built.scale });
}
}
return pixels;
}
function blobAtPoint(blobs, x, y, scale) {
const sx = Math.round(x * scale);
const sy = Math.round(y * scale);
return blobs.find((blob) => blob.pixels.some((point) => point.x === sx && point.y === sy)) || null;
}
function nearestBlob(blobs, x, y, scale) {
let best = null, bestDist = Infinity;
for (const blob of blobs) {
let mx = 0, my = 0;
for (const point of blob.pixels) { mx += point.x; my += point.y; }
mx = mx / blob.pixels.length / scale;
my = my / blob.pixels.length / scale;
const d = Math.hypot(mx - x, my - y);
if (d < bestDist) {
best = blob;
bestDist = d;
}
}
return bestDist < 80 ? best : null;
}
function pixelsForSeed(seed, built, blobs) {
const hit = blobAtPoint(blobs, seed.x, seed.y, built.scale)
|| nearestBlob(blobs, seed.x, seed.y, built.scale);
if (hit) return hit.pixels.map((point) => ({ x: point.x / built.scale, y: point.y / built.scale }));
return localMaskPixels(built, seed.x, seed.y);
}
function leadingAxisFromCenter(cx, cy, pixels, preferredAngle) {
if (Number.isFinite(preferredAngle)) {
return { ux: -Math.cos(preferredAngle), uy: -Math.sin(preferredAngle), aspect: 1 };
}
if (pixels.length < 6) return { ux: 1, uy: 0, aspect: 1 };
let mx = 0, my = 0;
for (const point of pixels) { mx += point.x; my += point.y; }
mx /= pixels.length;
my /= pixels.length;
let xx = 0, xy = 0, yy = 0;
for (const point of pixels) {
const dx = point.x - mx, dy = point.y - my;
xx += dx * dx;
xy += dx * dy;
yy += dy * dy;
}
const theta = 0.5 * Math.atan2(2 * xy, xx - yy || 1e-9);
let ux = Math.cos(theta);
let uy = Math.sin(theta);
const widthToward = (dir) => {
let min = Infinity, max = -Infinity;
for (const point of pixels) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t * dir < 0) continue;
const s = (point.x - cx) * -uy + (point.y - cy) * ux;
min = Math.min(min, s);
max = Math.max(max, s);
}
return Number.isFinite(min) ? max - min : 0;
};
if (widthToward(1) < widthToward(-1)) {
ux = -ux;
uy = -uy;
}
let tMin = Infinity, tMax = -Infinity, sMin = Infinity, sMax = -Infinity;
for (const point of pixels) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
const s = (point.x - cx) * -uy + (point.y - cy) * ux;
tMin = Math.min(tMin, t);
tMax = Math.max(tMax, t);
sMin = Math.min(sMin, s);
sMax = Math.max(sMax, s);
}
const lengthExtent = Math.max(1e-6, tMax - tMin);
const widthExtent = Math.max(1e-6, sMax - sMin);
const aspect = Math.max(1, lengthExtent / widthExtent);
return { ux, uy, aspect };
}
const STAIN_ASPECT_CONFIDENCE_LO = 1.2;
const STAIN_ASPECT_CONFIDENCE_HI = 2.0;
function elongationConfidence(aspect) {
if (!(aspect > 0)) return 0;
if (aspect <= STAIN_ASPECT_CONFIDENCE_LO) return 0;
if (aspect >= STAIN_ASPECT_CONFIDENCE_HI) return 1;
return (aspect - STAIN_ASPECT_CONFIDENCE_LO) / (STAIN_ASPECT_CONFIDENCE_HI - STAIN_ASPECT_CONFIDENCE_LO);
}
function adaptiveTravelSearchBand(baseBand, confidence) {
const c = Math.max(0, Math.min(1, confidence));
const wide = Math.max(25 * Math.PI / 180, baseBand * 8);
const tight = Math.max(baseBand, 4 * Math.PI / 180);
return wide + (tight - wide) * c;
}
function resolveAndScoreTravel(seed, session, cx, cy, pixels) {
const baseBand = stainDirectionBandRad();
const guide = Number.isFinite(session?.direction)
? session.direction
: (Number.isFinite(seed?.direction) ? seed.direction : null);
const fallback = Number.isFinite(seed?.direction) ? seed.direction : (Number.isFinite(guide) ? guide : 0);
if (!pixels?.length || pixels.length < 6) {
return {
travel: fallback,
band: baseBand,
fitted: fitHalfAlongTravel(cx, cy, pixels || [], fallback, session),
};
}
const axis = leadingAxisFromCenter(cx, cy, pixels);
const maskTravel = alignTravelToGuide(Math.atan2(-axis.uy, -axis.ux), guide);
const confidence = elongationConfidence(axis.aspect);
const preferred = maskTravel;
const searchBand = adaptiveTravelSearchBand(baseBand, confidence);
const step = stainDirectionStepRad(Math.max(searchBand, baseBand || 1e-6));
const blobSet = new Set(pixels.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`));
const angles = [];
const seen = new Set();
const pushAngle = (angle) => {
const key = Math.round(normalizeAngle(angle) * 1000);
if (seen.has(key)) return;
seen.add(key);
angles.push(angle);
};
for (let delta = -searchBand; delta <= searchBand + 1e-9; delta += Math.max(step, 1e-6)) {
pushAngle(preferred + delta);
}
pushAngle(maskTravel);
if (Number.isFinite(seed?.direction)) pushAngle(seed.direction);
if (Number.isFinite(guide)) pushAngle(guide);
let best = null;
let bestScore = -Infinity;
let bestTravel = preferred;
for (const theta of angles) {
const fitted = fitHalfAlongTravel(cx, cy, pixels, theta, session);
let score = halfEllipseScore(fitted.geometry, fitted.body, blobSet, fitted.tail);
score += 0.12 * Math.cos(shortestAngleDelta(theta, maskTravel));
if (Number.isFinite(guide)) score += 0.06 * Math.cos(shortestAngleDelta(theta, guide));
if (score > bestScore) {
bestScore = score;
best = fitted;
bestTravel = theta;
}
}
return {
travel: bestTravel,
band: baseBand,
fitted: best || fitHalfAlongTravel(cx, cy, pixels, preferred, session),
};
}
function bodyAndTailPixels(cx, cy, pixels, ux, uy) {
const body = [];
const tail = [];
for (const point of pixels) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t >= -1.5) body.push(point);
else tail.push(point);
}
return { body: body.length ? body : pixels, tail };
}
function extentPercentile(values, fraction) {
if (!values.length) return 0;
const sorted = values.slice().sort((a, b) => a - b);
const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
return sorted[index];
}
function fitHalfAlongTravel(cx, cy, pixels, travelAngle, session) {
const ux = -Math.cos(travelAngle);
const uy = -Math.sin(travelAngle);
const vx = -uy, vy = ux;
const { body, tail } = bodyAndTailPixels(cx, cy, pixels, ux, uy);
const extents = [];
for (const point of body) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t > 0) extents.push(t);
}
let rx = extentPercentile(extents, 0.97);
if (rx < 2) {
const small = Number(session?.smallSize);
const large = Number(session?.largeSize);
rx = Number.isFinite(small) && Number.isFinite(large) ? Math.max(2, (small + large) / 8) : 8;
}
const widths = [];
for (const point of body) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t < -1 || t > rx * 0.75) continue;
widths.push((point.x - cx) * vx + (point.y - cy) * vy);
}
let sMin = 0, sMax = 0;
if (widths.length) {
sMin = extentPercentile(widths, 0.04);
sMax = extentPercentile(widths, 0.96);
}
const ry = Math.max(1, (sMax - sMin) / 2 || rx * 0.4);
return {
geometry: clampHalfEllipse({ cx, cy, rx, ry, rotation: Math.atan2(uy, ux) }),
body,
tail,
};
}
function fitHalfFromCenter(cx, cy, pixels, preferredAngle, session) {
if (!pixels?.length) {
const travel = Number.isFinite(preferredAngle) ? preferredAngle : 0;
return fitHalfAlongTravel(cx, cy, [], travel, session);
}
if (!Number.isFinite(preferredAngle)) {
const { ux, uy } = leadingAxisFromCenter(cx, cy, pixels, preferredAngle);
const vx = -uy, vy = ux;
const { body, tail } = bodyAndTailPixels(cx, cy, pixels, ux, uy);
const extents = [];
for (const point of body) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t > 0) extents.push(t);
}
let rx = extentPercentile(extents, 0.97);
if (rx < 2) {
const small = Number(session?.smallSize);
const large = Number(session?.largeSize);
rx = Number.isFinite(small) && Number.isFinite(large) ? Math.max(2, (small + large) / 8) : 8;
}
const widths = [];
for (const point of body) {
const t = (point.x - cx) * ux + (point.y - cy) * uy;
if (t < -1 || t > rx * 0.75) continue;
widths.push((point.x - cx) * vx + (point.y - cy) * vy);
}
let sMin = 0, sMax = 0;
if (widths.length) {
sMin = extentPercentile(widths, 0.04);
sMax = extentPercentile(widths, 0.96);
}
const ry = Math.max(1, (sMax - sMin) / 2 || rx * 0.4);
return {
geometry: clampHalfEllipse({ cx, cy, rx, ry, rotation: Math.atan2(uy, ux) }),
body,
tail,
};
}
if (pixels.length < 6) return fitHalfAlongTravel(cx, cy, pixels, preferredAngle, session);
const band = stainDirectionBandRad();
if (band <= 0) return fitHalfAlongTravel(cx, cy, pixels, preferredAngle, session);
const blobSet = new Set(pixels.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`));
let best = null;
let bestScore = -Infinity;
const step = stainDirectionStepRad(band);
for (let delta = -band; delta <= band + 1e-9; delta += step) {
const fitted = fitHalfAlongTravel(cx, cy, pixels, preferredAngle + delta, session);
const score = halfEllipseScore(fitted.geometry, fitted.body, blobSet, fitted.tail);
if (score > bestScore) {
bestScore = score;
best = fitted;
}
}
return best || fitHalfAlongTravel(cx, cy, pixels, preferredAngle, session);
}
function autoDetectStains() {
const image = activeImage();
const session = stainSession(image);
if (!image || !session) return;
if (!session.stainColor || !session.backgroundColor) {
updateHint("Sample a stain color and a background color first.");
return;
}
recordHistory();
const built = buildStainMask(image, session);
if (!built) return;
const blobs = connectedComponents(built.mask, built.width, built.height);
const seeds = [];
for (const blob of blobs) {
if (blob.area < 6) continue;
if (!blobPassesFillFilter(blob, built.scale, session)) continue;
const peak = blobBodyPeak(blob.pixels, session.direction);
seeds.push({
id: uid("seed"),
x: peak.x / built.scale,
y: peak.y / built.scale,
source: "auto",
direction: null,
directionUncertain: false,
});
}
for (const seed of seeds) assignSeedDirectionFromMask(seed, session, image, built, blobs);
session.seedCenters = seeds;
state.selectedSeedId = seeds[0]?.id || null;
image.objects = image.objects.filter((object) => !(object.sessionId === session.id && (object.source === "auto" || object.fromSeed)));
enterCenterReview(seeds.length);
}
function fitEllipsesFromCenters() {
const image = activeImage();
const session = stainSession(image);
const seeds = sessionSeeds(session);
if (!image || !session || !seeds.length) {
updateHint("No centers yet");
return;
}
recordHistory();
const built = buildStainMask(image, session);
if (!built) return;
const blobs = connectedComponents(built.mask, built.width, built.height);
image.objects = image.objects.filter((object) => !(object.sessionId === session.id && (object.source === "auto" || object.fromSeed)));
for (const seed of seeds) {
const pixels = pixelsForSeed(seed, built, blobs);
const resolved = resolveAndScoreTravel(seed, session, seed.x, seed.y, pixels);
const fitted = resolved.fitted;
const next = fitted.body.length
? refineHalfEllipse(fitted.geometry, fitted.body, {
fromCenter: true,
tailPixels: fitted.tail,
preferredTravel: Number.isFinite(resolved.travel) ? resolved.travel : undefined,
directionBand: resolved.band,
})
: fitted.geometry;
addStain(session, next, seed.source === "manual" ? "manual" : "auto", { fromSeed: true });
}
renumberStains(session);
state.stainMode = null;
state.selectedSeedId = null;
state.selectedObjectId = session.id;
updateHint(`Fitted ${seeds.length} ellipse${seeds.length === 1 ? "" : "s"} from centers.`);
refreshUI();
}
function addStain(session, geometry, source, extra = {}) {
const image = activeImage();
const object = normalizeEllipse(makeObject("halfEllipse", {
...geometry,
showPoints: false,
sessionId: session.id,
source,
fromSeed: Boolean(extra.fromSeed),
stainNumber: 0,
}));
image.objects.push(object);
return object;
}
function completeManualStain(geometry) {
recordHistory();
const session = ensureStainSession();
const image = activeImage();
let next = geometry;
const built = image ? buildStainMask(image, session) : null;
if (built) {
const tip = rotateEllipsePoint(geometry, geometry.rx, 0);
const pixels = blobPixelsAt(built, geometry.cx, geometry.cy) || blobPixelsAt(built, tip.x, tip.y);
if (pixels?.length) next = refineHalfEllipse(geometry, pixels);
}
const stain = addStain(session, next, "manual");
renumberStains(session);
state.draft = null;
state.selectedObjectId = stain.id;
if (state.stainVariant === "manual") state.stainMode = "manual";
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
recordHistory();
const draftType = state.draft.type;
if (draftType === "stainDetect") session.detectRegion = points;
if (draftType === "stainExclude") session.excludeRegions = [...(session.excludeRegions || []), points];
invalidateStainMask(session);
state.draft = null;
const step = stainWizardSteps[state.stainWizardIndex];
if (draftType === "stainExclude" && state.stainWizardOpen && step?.id === "exclude") {
state.stainMode = "exclude";
refreshUI();
renderStainWizard();
return;
}
state.stainMode = null;
refreshUI();
advanceStainWizardIfDone();
}
function handleStainPointerDown(event, point, image) {
const mode = state.stainMode;
if (!mode) return false;
if (mode === "stainColor" || mode === "stainColorLight" || mode === "backgroundColor") {
recordHistory();
const session = ensureStainSession();
session[mode] = sampleImageColor(image, point);
invalidateStainMask(session);
state.stainMode = null;
updateHint(mode === "backgroundColor" ? "Background color sampled." : mode === "stainColorLight" ? "Lighter stain color sampled." : "Stain color sampled.");
refreshUI();
advanceStainWizardIfDone();
return true;
}
if (mode === "smallSize" || mode === "largeSize" || mode === "stainDirection") {
state.draft = { type: mode === "stainDirection" ? "stainDirection" : "stainSample", mode, start: point, current: point };
canvas.setPointerCapture(event.pointerId);
return true;
}
if (mode === "manual") {
const existing = hitStainAt(point);
if (existing) {
selectStain(existing);
return true;
}
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
const sampling = ["stainColor", "stainColorLight", "backgroundColor", "smallSize", "largeSize", "stainDirection", "detect", "exclude"].includes(state.stainMode || "");
if (!sampling) {
if (state.stainMode === "centers") {
const point = imagePoint(event);
const seed = hitSeedAt(point) || hitSeedVectorTip(point);
if (seed) {
removeSeedCenter(seed);
return;
}
}
const stain = hitStainAt(imagePoint(event));
if (stain) {
deleteStain(stain);
return;
}
}
if (state.tool === "stainCount" && state.stainMode === "manual" && state.stainVariant !== "manual") {
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
if (state.stainMode === "centers") {
const tip = hitSeedVectorTip(point, image);
if (tip) {
recordHistory();
state.selectedSeedId = tip.id;
state.dragging = { mode: "seed-direction", seed: tip };
canvas.setPointerCapture(event.pointerId);
draw();
return;
}
const seed = hitSeedAt(point);
if (seed) {
recordHistory();
state.selectedSeedId = seed.id;
state.dragging = { mode: "seed", seed, start: point, origin: { x: seed.x, y: seed.y } };
canvas.setPointerCapture(event.pointerId);
draw();
return;
}
addCenterFromClick(point, image);
refreshUI();
return;
}
if (!["stainColor", "stainColorLight", "backgroundColor", "smallSize", "largeSize", "stainDirection", "detect", "exclude"].includes(state.stainMode || "")) {
const current = selectedObject();
const control = isEllipseLike(current?.type) && !current.locked ? hitEllipseControl(current, point, image.view.zoom) : null;
if (control) {
if (!selectingStainKeepsTool()) setTool("select");
recordHistory();
state.dragging = { mode: "ellipse-control", role: control.role, object: current, start: point, snapshot: JSON.parse(JSON.stringify(current)) };
canvas.setPointerCapture(event.pointerId);
return;
}
const stain = hitStainAt(point);
if (stain) {
const already = stain.id === state.selectedObjectId;
selectStain(stain, already && !stain.locked ? { startTranslate: true, start: point, snapshot: JSON.parse(JSON.stringify(stain)) } : {});
if (already && !stain.locked) canvas.setPointerCapture(event.pointerId);
return;
}
}
if (handleStainPointerDown(event, point, image)) return;
if (!state.draft && !state.stainMode) {
const current = selectedObject();
const control = isEllipseLike(current?.type) && !current.locked ? hitEllipseControl(current, point, image.view.zoom) : null;
if (control) {
setTool("select");
recordHistory();
state.dragging = { mode: "ellipse-control", role: control.role, object: current, start: point, snapshot: JSON.parse(JSON.stringify(current)) };
canvas.setPointerCapture(event.pointerId);
return;
}
const vertex = hitVertex(current, point, image.view.zoom);
if (vertex) {
setTool("select");
recordHistory();
state.dragging = { mode: "vertex", vertex, object: current, start: point, snapshot: JSON.parse(JSON.stringify(current)) };
canvas.setPointerCapture(event.pointerId);
return;
}
const hit = hitTest(point);
if (hit) {
setTool("select");
state.selectedObjectId = hit.id;
if (!hit.locked) {
recordHistory();
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
else if (state.tool === "polygon" && nearFirstPoint(point, image)) {
finishPolygonIfPossible();
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
else if (state.dragging.mode === "seed") {
state.dragging.seed.x = state.dragging.origin.x + point.x - state.dragging.start.x;
state.dragging.seed.y = state.dragging.origin.y + point.y - state.dragging.start.y;
} else if (state.dragging.mode === "seed-direction") {
const seed = state.dragging.seed;
if (distance(point, seed) > 2) {
seed.direction = Math.atan2(point.y - seed.y, point.x - seed.x);
seed.directionUncertain = false;
}
} else if (state.dragging.mode === "vertex") {
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
if (state.draft) {
state.draft.current = point;
state.draft.closeCandidate = state.draft.type === "polygon" && nearFirstPoint(point, image);
draw();
return;
}
updateStainHover(point);
}
function updateStainHover(point) {
const image = activeImage();
const current = selectedObject();
const control = isEllipseLike(current?.type) && !current.locked ? hitEllipseControl(current, point, image.view.zoom) : null;
const vertex = hitVertex(current, point, image.view.zoom);
const seedTip = state.stainMode === "centers" ? hitSeedVectorTip(point) : null;
const seed = state.stainMode === "centers" ? hitSeedAt(point) : null;
const stain = ["stainColor", "stainColorLight", "backgroundColor", "smallSize", "largeSize", "stainDirection", "detect", "exclude", "centers"].includes(state.stainMode || "")
? null
: hitStainAt(point);
const hoverId = stain?.id || seedTip?.id || seed?.id || null;
if (hoverId !== state.hoverObjectId) {
state.hoverObjectId = hoverId;
draw();
}
if (control) canvas.style.cursor = control.role === "rotation" ? "grab" : "pointer";
else if (vertex) canvas.style.cursor = "pointer";
else if (seedTip) canvas.style.cursor = "grab";
else if (seed || stain) canvas.style.cursor = "pointer";
else canvas.style.cursor = state.tool === "select" && state.stainMode !== "centers" ? "default" : "crosshair";
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
if (state.draft?.type === "stainDirection") {
const session = ensureStainSession();
const end = imagePoint(event);
if (distance(state.draft.start, end) > 4) {
recordHistory();
session.direction = Math.atan2(end.y - state.draft.start.y, end.x - state.draft.start.x);
session.directionStart = { ...state.draft.start };
session.directionEnd = { ...end };
}
state.draft = null;
state.stainMode = null;
refreshUI();
advanceStainWizardIfDone();
try { canvas.releasePointerCapture(event.pointerId); } catch {}
return;
}
if (state.draft?.type === "stainSample") {
const session = ensureStainSession();
const sampleMode = state.draft.mode;
recordHistory();
session[sampleMode] = Math.max(2, distance(state.draft.start, imagePoint(event)));
state.draft = null;
state.stainMode = null;
updateHint(sampleMode === "largeSize" ? "Large stain sampled." : "Small stain sampled.");
refreshUI();
advanceStainWizardIfDone();
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
function hitStainAt(point) {
const image = activeImage();
if (!image) return null;
const threshold = 10 / image.view.zoom;
return [...image.objects].reverse().find((object) => isSessionStain(object) && objectIsDrawn(object, image) && objectDistance(object, point) <= threshold) || null;
}
function selectingStainKeepsTool() {
return state.tool === "stainCount" || state.stainWizardOpen;
}
function selectStain(stain, { startTranslate, start, snapshot } = {}) {
state.selectedObjectId = stain.id;
if (state.stainMode === "manual" && state.stainVariant !== "manual") state.stainMode = null;
if (!selectingStainKeepsTool()) {
state.tool = "select";
$$(".tool[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === "select"));
canvas.style.cursor = "default";
}
if (startTranslate && !stain.locked) {
recordHistory();
state.dragging = { mode: "translate", object: stain, start, snapshot };
}
refreshUI();
}
function deleteStain(stain) {
if (!stain) return;
state.selectedObjectId = stain.id;
deleteSelected();
}
function hitTest(point) {
const image = activeImage();
if (!image) return null;
const threshold = 10 / image.view.zoom;
return [...image.objects].reverse().find((object) => objectIsDrawn(object, image) && objectDistance(object, point) <= threshold) || null;
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
if (r <= 1) return 0;
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
["#exportImageBtn", "#exportCsvBtn", "#exportMeasurementsCsvBtn", "#exportPdfBtn", "#fitCanvasBtn"].forEach((selector) => $(selector).disabled = !image);
renderFilmstrip();
renderStructure();
renderProperties();
renderCalibration();
renderMeasurements();
renderStainWizard();
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
adoptOrphanStains(image);
const imageRow = document.createElement("div");
imageRow.className = "structure-item image-row";
imageRow.innerHTML = `<span class="structure-icon"><img alt=""></span><span class="name"></span>`;
imageRow.querySelector("img").src = image.element.src;
imageRow.querySelector(".name").textContent = image.name;
$("#structureList").appendChild(imageRow);
const appendObjectRow = (object, { child = false } = {}) => {
const hidden = object.visible === false;
const row = document.createElement("div");
row.className = `structure-item${object.id === state.selectedObjectId ? " selected" : ""}${child || object.sessionId ? " child" : ""}${hidden ? " hidden-object" : ""}${object.structureCollapsed ? " collapsed" : ""}`;
row.dataset.id = object.id;
row.innerHTML = `<span class="structure-icon">${structureIcon(object)}</span><span class="name"></span>`;
const childCount = object.type === "stainCount" ? sessionStains(object, image).length : 0;
row.querySelector(".name").textContent = object.type === "stainCount" && object.structureCollapsed && childCount
? `${object.name} (${childCount})`
: object.name;
row.addEventListener("click", () => selectObject(object.id));
if (object.type === "stainCount") {
row.title = object.structureCollapsed ? "Double-click to expand stains" : "Double-click to collapse stains";
row.addEventListener("dblclick", (event) => {
event.preventDefault();
object.structureCollapsed = !object.structureCollapsed;
renderStructure();
});
const chart = document.createElement("button");
chart.type = "button";
chart.className = "structure-action";
chart.title = "Stain table";
chart.setAttribute("aria-label", "Stain table");
chart.innerHTML = CHART_ICON;
chart.addEventListener("click", (event) => {
event.stopPropagation();
openStainChart(object);
});
row.append(chart);
}
const eye = document.createElement("button");
eye.type = "button";
eye.className = "structure-action";
eye.style.gridColumn = "4";
eye.title = hidden ? "Show" : "Hide";
eye.setAttribute("aria-label", hidden ? "Show" : "Hide");
eye.innerHTML = hidden ? EYE_CLOSED_ICON : EYE_OPEN_ICON;
eye.addEventListener("click", (event) => {
event.stopPropagation();
recordHistory();
object.visible = hidden;
renderStructure();
renderProperties();
draw();
});
row.append(eye);
$("#structureList").appendChild(row);
};
image.objects.forEach((object) => {
if (object.type === "stainCount" || object.sessionId) return;
appendObjectRow(object);
});
image.objects.filter((object) => object.type === "stainCount").forEach((session) => {
appendObjectRow(session);
if (session.structureCollapsed) return;
sessionStains(session, image).forEach((stain) => appendObjectRow(stain, { child: true }));
});
}
const EYE_OPEN_ICON = `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED_ICON = `<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.2 3.8M6.1 6.1C3.8 7.8 2 12 2 12s3.5 7 10 7a11 11 0 0 0 3.1-.4"/></svg>`;
const CHART_ICON = `<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/></svg>`;
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
const object = activeImage()?.objects.find((item) => item.id === id);
if (isSessionStain(object)) {
selectStain(object);
return;
}
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
form.append(readonlyField("Length", `${(object.rx * 2 * multiplier).toFixed(2)} ${units}`));
form.append(readonlyField("Width", `${(object.ry * 2 * multiplier).toFixed(2)} ${units}`));
form.append(numberField("Gamma angle", ellipseGammaDegrees(object).toFixed(1), (value) => object.rotation = rotationFromGammaDegrees(value), { min: 0, max: 360, step: .1 }));
form.append(readonlyField("Alpha angle", `${ellipseAlphaDegrees(object).toFixed(1)}°`));
form.append(sessionButton("Flip direction", () => {
object.rotation = normalizeAngle((object.rotation || 0) + Math.PI);
refreshAfterPropertyChange();
}));
form.append(checkField("Full Ellipse", Boolean(object.showFullEllipse), (checked) => object.showFullEllipse = checked));
form.append(checkField("Show points", object.showPoints !== false, (checked) => object.showPoints = checked));
if (isSessionStain(object)) {
form.append(readonlyField("Source", object.source === "manual" ? "Manually marked" : "Auto detected"));
const remove = sessionButton("Delete stain", () => deleteStain(object));
remove.classList.add("danger");
form.append(remove);
}
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
const label = makeLabel(`${title} ${value}`, input);
const caption = label.firstChild;
input.addEventListener("pointerdown", recordHistory);
input.addEventListener("input", () => {
const next = Number(input.value);
handler(next);
caption.textContent = `${title} ${next}`;
invalidateStainMask(stainSession() || selectedObject());
draw();
});
return label;
}
function appendStainSessionFields(form, session) {
const image = activeImage();
const units = image?.calibration?.units || "px";
const scale = unitScale() || 1;
const counts = stainSourceCounts(session, image);
form.append(readonlyField("Count", String(counts.total)));
form.append(readonlyField("Auto detected", String(counts.auto)));
form.append(readonlyField("Manually marked", String(counts.manual)));
form.append(readonlyField("Density", stainDensityLabel(session, image)));
form.append(readonlyField("Direction", formatStainDirection(session) || "—"));
form.append(sessionButton("Setup guide", openStainWizard));
form.append(swatchRow("Stain color", session.stainColor));
form.append(swatchRow("Lighter stain", session.stainColorLight));
form.append(swatchRow("Background", session.backgroundColor));
form.append(readonlyField("Small sample", session.smallSize ? `${(session.smallSize * scale).toFixed(2)} ${units}` : "—"));
form.append(readonlyField("Large sample", session.largeSize ? `${(session.largeSize * scale).toFixed(2)} ${units}` : "—"));
const samples = document.createElement("div");
samples.className = "session-actions";
samples.append(
sessionButton("Stain color", () => setStainMode("stainColor")),
sessionButton("Lighter stain", () => setStainMode("stainColorLight")),
sessionButton("Background", () => setStainMode("backgroundColor")),
sessionButton("Small stain", () => setStainMode("smallSize")),
sessionButton("Large stain", () => setStainMode("largeSize")),
sessionButton("Direction", () => setStainMode("stainDirection")),
sessionButton("Detect region", () => setStainMode("detect")),
sessionButton("Exclude region", () => setStainMode("exclude")),
);
form.append(samples);
form.append(rangeField("Color Threshold", session.separation ?? 20, (value) => session.separation = value));
form.append(rangeField("Size Threshold", session.sizeTune ?? 10, (value) => session.sizeTune = value));
form.append(rangeField("Front / fill", session.fill ?? 15, (value) => session.fill = value));
const actions = document.createElement("div");
actions.className = "session-stack";
const fitBtn = sessionButton("Fit Ellipses", fitEllipsesFromCenters);
fitBtn.disabled = !(session.seedCenters || []).length;
actions.append(
sessionButton("Find Centers", autoDetectStains),
fitBtn,
sessionButton("Manual marking", () => { enterManualStains(); setTool("stainCount"); }),
);
if ((session.excludeRegions || []).length) {
actions.append(sessionButton("Clear exclude regions", () => {
recordHistory();
session.excludeRegions = [];
invalidateStainMask(session);
refreshUI();
}));
}
form.append(actions);
const note = document.createElement("p");
note.className = "session-note";
note.textContent = "Assisted: sample a dark body and optionally a lighter body, Find Centers, click any missed cyan stain, then Fit Ellipses. Manual: click and drag half-ellipses.";
form.append(note);
}
function convertEllipseShape(object, makeCircle) {
recordHistory();
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
function bindInput(input, handler) {
input.addEventListener("focus", recordHistory);
input.addEventListener("input", () => { handler(input.type === "number" ? Number(input.value) : input.value); refreshAfterPropertyChange(); });
return input;
}
function textField(title, value, handler) { const input = bindInput(Object.assign(document.createElement("input"), { value }), handler); return makeLabel(title, input); }
function numberField(title, value, handler, options = {}) { const input = Object.assign(document.createElement("input"), { type: "number", value }); Object.entries(options).forEach(([key, val]) => input[key] = val); bindInput(input, handler); return makeLabel(title, input); }
function readonlyField(title, value) { const input = Object.assign(document.createElement("input"), { value, readOnly: true }); return makeLabel(title, input); }
function selectField(title, value, options, handler) { const select = document.createElement("select"); options.forEach((option) => { const item = typeof option === "string" ? { value: option, label: option } : option; select.add(new Option(item.label, item.value, item.value === value, item.value === value)); }); bindInput(select, handler); return makeLabel(title, select); }
function colorField(title, value, handler) { const input = Object.assign(document.createElement("input"), { type: "color", value }); bindInput(input, handler); return makeLabel(title, input); }
function checkField(title, checked, handler) { const label = document.createElement("label"); label.className = "inline"; const input = Object.assign(document.createElement("input"), { type: "checkbox", checked }); input.addEventListener("change", () => { recordHistory(); handler(input.checked); refreshAfterPropertyChange(); }); label.append(document.createTextNode(title), input); return label; }
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
if (state.stainMode === "centers" && state.selectedSeedId) {
const seed = sessionSeeds(stainSession(image)).find((item) => item.id === state.selectedSeedId);
if (seed) {
removeSeedCenter(seed);
return;
}
}
if (!image || !state.selectedObjectId) return;
recordHistory();
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
state.selectedObjectId = selectingStainKeepsTool() ? removed.sessionId : null;
refreshUI();
return;
}
state.selectedObjectId = null;
refreshUI();
}
function exportCurrentImage() {
const image = activeImage();
if (!image) return;
const out = document.createElement("canvas"); out.width = image.width; out.height = image.height;
draw(out.getContext("2d"), image, true);
out.toBlob((blob) => {
if (!blob) return;
saveBlob(blob, `${stripExtension(image.name)}-annotated.png`, [
{ description: "PNG image", accept: { "image/png": [".png"] } },
]);
}, "image/png");
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
saveBlob(new Blob([csv], { type: "text/csv" }), `${safeName(state.project.name)}-csv-report.csv`, [
{ description: "CSV spreadsheet", accept: { "text/csv": [".csv"] } },
]);
}
function exportMeasurementsCsv() {
const rows = [["Image", "Name", "Type", "Value"]];
state.project.images.forEach((image) => {
image.objects.forEach((object) => {
rows.push([image.name, object.name, object.type, objectValue(object, image)]);
});
});
const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
saveBlob(new Blob([csv], { type: "text/csv" }), `${safeName(state.project.name)}-measurements.csv`, [
{ description: "CSV spreadsheet", accept: { "text/csv": [".csv"] } },
]);
}
function escapeHtml(value) {
return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function markedImageDataUrl(image, maxEdge = 1200) {
const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
const out = document.createElement("canvas");
out.width = Math.max(1, Math.round(image.width * scale));
out.height = Math.max(1, Math.round(image.height * scale));
const context = out.getContext("2d");
context.scale(scale, scale);
draw(context, image, true);
return out.toDataURL("image/jpeg", 0.82);
}
function exportPdfReport() {
if (!state.project.images.length) return;
syncProjectMetadata();
const project = state.project;
const rows = project.images.flatMap((image) => image.objects.map((object) => {
const scale = unitScale(image) || 1;
const stain = object.type === "halfEllipse" && object.stainNumber;
return `<tr>
      <td>${escapeHtml(image.name)}</td>
      <td>${escapeHtml(object.name)}</td>
      <td>${escapeHtml(object.type)}</td>
      <td>${escapeHtml(objectValue(object, image))}</td>
      <td>${stain ? object.stainNumber : ""}</td>
      <td>${stain ? (object.rx * 2 * scale).toFixed(3) : ""}</td>
      <td>${stain ? (object.ry * 2 * scale).toFixed(3) : ""}</td>
      <td>${stain ? ellipseAlphaDegrees(object).toFixed(2) : ""}</td>
      <td>${stain ? ellipseGammaDegrees(object).toFixed(2) : ""}</td>
      <td>${escapeHtml(object.source || "")}</td>
    </tr>`;
})).join("");
const marked = project.images.map((image) => `
    <section class="page">
      <h2>${escapeHtml(image.name)}</h2>
      <img src="${markedImageDataUrl(image)}" alt="">
    </section>`).join("");
const chartPages = project.images.flatMap((image) => {
const session = stainSession(image);
if (!session) return [];
return stainChartSpecs(session, image).map((spec) => `
      <section class="chart-page">
        <h2>${escapeHtml(image.name)} — ${escapeHtml(spec.title)}</h2>
        <p>${escapeHtml(spec.caption)}</p>
        ${chartNodeMarkup(spec, image)}
      </section>`);
}).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.name)} report</title>
    <style>
      body { font: 12px/1.45 Segoe UI, sans-serif; color: #111; margin: 24px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 18px 0 8px; }
      p { color: #444; margin: 0 0 12px; }
      .meta { color: #444; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
      th { background: #f3f3f3; }
      img { max-width: 100%; height: auto; border: 1px solid #ddd; }
      .page { page-break-inside: avoid; margin-top: 18px; }
      .chart-page { page-break-before: always; }
      .chart-page svg { width: 100%; height: auto; max-height: 8.5in; }
      .chart-page img { max-height: 8.5in; display: block; }
    </style></head><body>
    <h1>${escapeHtml(project.name)}</h1>
    <div class="meta">
      <div>Case / Reference: ${escapeHtml(project.caseNumber || "—")}</div>
      <div>Notes: ${escapeHtml(project.notes || "—")}</div>
      <div>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
      <div>ELlipserWeb © 2026 ai2-3D</div>
    </div>
    <h2>Measurements</h2>
    <table>
      <thead><tr><th>Image</th><th>Object</th><th>Type</th><th>Value</th><th>Stain #</th><th>Length</th><th>Width</th><th>Alpha</th><th>Gamma</th><th>Source</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="10">No measurements.</td></tr>`}</tbody>
    </table>
    ${chartPages}
    ${marked}
    </body></html>`;
const frame = document.createElement("iframe");
frame.setAttribute("aria-hidden", "true");
Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
document.body.append(frame);
const doc = frame.contentDocument;
doc.open();
doc.write(html);
doc.close();
const cleanup = () => frame.remove();
frame.contentWindow.addEventListener("afterprint", cleanup);
setTimeout(() => {
frame.contentWindow.focus();
frame.contentWindow.print();
setTimeout(cleanup, 4000);
}, 250);
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
await saveBlob(new Blob([zip], { type: "application/octet-stream" }), `${safeName(state.project.name)}.elp`, [
{ description: "ELlipserWeb project", accept: { "application/octet-stream": [".elp"] } },
]);
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
clearHistory();
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
const assisted = $("#settingsAssistedList");
if (assisted) {
assisted.innerHTML = "";
const row = document.createElement("div");
row.className = "style-row assisted-row";
const tolerance = Object.assign(document.createElement("input"), {
type: "number",
value: stainDirectionToleranceDeg(),
min: 0,
max: 45,
step: 0.5,
});
tolerance.addEventListener("input", () => {
const value = Math.max(0, Math.min(45, Number(tolerance.value)));
if (!state.prefs.assisted) state.prefs.assisted = { ...defaultPrefs.assisted };
state.prefs.assisted.directionToleranceDeg = Number.isFinite(value) ? value : STAIN_DIRECTION_BAND_DEFAULT_DEG;
tolerance.value = state.prefs.assisted.directionToleranceDeg;
savePrefs();
});
row.append(settingsField("Ellipse angle fit (±°)", tolerance));
const numberColor = Object.assign(document.createElement("input"), {
type: "color",
value: stainNumberColor(),
});
numberColor.addEventListener("input", () => {
if (!state.prefs.assisted) state.prefs.assisted = { ...defaultPrefs.assisted };
state.prefs.assisted.stainNumberColor = numberColor.value;
savePrefs();
draw();
});
row.append(settingsField("Stain number color", numberColor));
assisted.appendChild(row);
}
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
recordHistory();
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
applyPanelWidths();
requestAnimationFrame(resizeCanvas);
}
const PANEL_WIDTH_MIN = { left: 180, right: 200 };
const PANEL_WIDTH_MAX = { left: 520, right: 520 };
function panelWidthPrefs() {
if (!state.prefs.layout) state.prefs.layout = { ...defaultPrefs.layout };
return state.prefs.layout;
}
function clampPanelWidth(side, width) {
const min = PANEL_WIDTH_MIN[side];
const max = PANEL_WIDTH_MAX[side];
return Math.max(min, Math.min(max, Math.round(width)));
}
function applyPanelWidths() {
const workspace = $(".workspace");
if (!workspace) return;
const layout = panelWidthPrefs();
const left = clampPanelWidth("left", Number(layout.leftPanelWidth) || defaultPrefs.layout.leftPanelWidth);
const right = clampPanelWidth("right", Number(layout.rightPanelWidth) || defaultPrefs.layout.rightPanelWidth);
layout.leftPanelWidth = left;
layout.rightPanelWidth = right;
if (!workspace.classList.contains("left-collapsed")) {
workspace.style.setProperty("--left-panel-width", `${left}px`);
} else {
workspace.style.removeProperty("--left-panel-width");
}
if (!workspace.classList.contains("right-collapsed")) {
workspace.style.setProperty("--right-panel-width", `${right}px`);
} else {
workspace.style.removeProperty("--right-panel-width");
}
}
function bindPanelResizers() {
const workspace = $(".workspace");
if (!workspace) return;
let drag = null;
const onMove = (event) => {
if (!drag) return;
const layout = panelWidthPrefs();
if (drag.side === "left") {
layout.leftPanelWidth = clampPanelWidth("left", drag.startWidth + (event.clientX - drag.startX));
} else {
layout.rightPanelWidth = clampPanelWidth("right", drag.startWidth - (event.clientX - drag.startX));
}
applyPanelWidths();
resizeCanvas();
};
const onUp = () => {
if (!drag) return;
drag = null;
workspace.classList.remove("resizing");
window.removeEventListener("pointermove", onMove);
window.removeEventListener("pointerup", onUp);
savePrefs();
resizeCanvas();
};
$$(".panel-resize").forEach((handle) => {
handle.addEventListener("pointerdown", (event) => {
if (event.button !== 0) return;
const side = handle.dataset.side === "right" ? "right" : "left";
if (side === "left" && workspace.classList.contains("left-collapsed")) return;
if (side === "right" && workspace.classList.contains("right-collapsed")) return;
event.preventDefault();
const layout = panelWidthPrefs();
drag = {
side,
startX: event.clientX,
startWidth: side === "left" ? layout.leftPanelWidth : layout.rightPanelWidth,
};
workspace.classList.add("resizing");
window.addEventListener("pointermove", onMove);
window.addEventListener("pointerup", onUp);
});
handle.addEventListener("keydown", (event) => {
const side = handle.dataset.side === "right" ? "right" : "left";
if (side === "left" && workspace.classList.contains("left-collapsed")) return;
if (side === "right" && workspace.classList.contains("right-collapsed")) return;
const step = event.shiftKey ? 24 : 12;
let delta = 0;
if (event.key === "ArrowLeft") delta = side === "left" ? -step : step;
if (event.key === "ArrowRight") delta = side === "left" ? step : -step;
if (!delta) return;
event.preventDefault();
const layout = panelWidthPrefs();
if (side === "left") layout.leftPanelWidth = clampPanelWidth("left", layout.leftPanelWidth + delta);
else layout.rightPanelWidth = clampPanelWidth("right", layout.rightPanelWidth + delta);
applyPanelWidths();
savePrefs();
resizeCanvas();
});
});
}
function safeName(value) { return String(value || "project").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "project"; }
function stripExtension(value) { return value.replace(/\.[^.]+$/, ""); }
async function saveBlob(blob, filename, types) {
if (window.showSaveFilePicker) {
try {
const handle = await window.showSaveFilePicker({ suggestedName: filename, types });
const writable = await handle.createWritable();
await writable.write(blob);
await writable.close();
return;
} catch (error) {
if (error.name === "AbortError") return;
}
}
downloadBlob(blob, filename);
}
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
canvas.addEventListener("pointerleave", () => {
if (!state.hoverObjectId) return;
state.hoverObjectId = null;
draw();
});
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
$$("#ellipseFlyout button").forEach((option) => option.addEventListener("click", () => {
closeFlyouts();
const variant = option.dataset.variant;
if (variant === "assisted") {
setStainVariant("assisted");
setTool("stainCount");
return;
}
setTool(variant);
}));
$$("#measureFlyout button").forEach((option) => option.addEventListener("click", () => { closeFlyouts(); setTool(option.dataset.variant); }));
function closeFileMenu() {
const menu = $(".file-menu");
if (!menu) return;
const keepClosed = menu.matches(":hover") || menu.contains(document.activeElement);
menu.classList.remove("open");
if (keepClosed) menu.classList.add("closed");
else menu.classList.remove("closed");
$("#fileMenuBtn")?.blur();
$("#fileMenuBtn")?.setAttribute("aria-expanded", "false");
}
document.addEventListener("click", (event) => {
if (!event.target.closest(".tool-flyout, .tool-variant")) closeFlyouts();
if (!event.target.closest(".file-menu")) closeFileMenu();
});
window.addEventListener("resize", closeFlyouts);
$("#newProjectPrimary").addEventListener("click", openNewProjectDialog);
$("#loadImagesBtn").addEventListener("click", () => {
closeFileMenu();
$("#imageInput").click();
});
$("#sampleImageBtn").addEventListener("click", loadSampleImage);
$("#stainSampleImageBtn").addEventListener("click", loadStainSampleImage);
$("#helpBtn").addEventListener("click", () => $("#helpDialog").showModal());
$("#closeHelpDialog").addEventListener("click", () => { const dialog = $("#helpDialog"); if (dialog.open) dialog.close(); });
$("#settingsBtn").addEventListener("click", openSettingsDialog);
$("#closeSettingsDialog").addEventListener("click", closeSettingsDialog);
$("#closeStainChartDialog").addEventListener("click", closeStainChart);
$("#closeStainChartViewer").addEventListener("click", closeStainChartViewer);
$("#stainChartDialog").addEventListener("cancel", (event) => {
if (!$("#stainChartViewer")?.hidden) {
event.preventDefault();
closeStainChartViewer();
}
});
$("#stainChartDialog").addEventListener("keydown", (event) => {
if ($("#stainChartViewer")?.hidden) return;
if (event.key === "ArrowLeft") {
event.preventDefault();
cycleStainChartViewer(-1);
} else if (event.key === "ArrowRight") {
event.preventDefault();
cycleStainChartViewer(1);
}
});
bindStainChartViewer();
$("#resetSettingsBtn").addEventListener("click", resetSettings);
$("#imageInput").addEventListener("change", (event) => { addImageFiles(event.target.files); event.target.value = ""; });
$("#openProjectBtn").addEventListener("click", () => {
closeFileMenu();
$("#projectInput").click();
});
$("#projectInput").addEventListener("change", (event) => { if (event.target.files[0]) openProjectFile(event.target.files[0]); event.target.value = ""; });
$("#saveProjectBtn").addEventListener("click", () => { closeFileMenu(); saveProject(); });
$("#exportImageBtn").addEventListener("click", () => { closeFileMenu(); exportCurrentImage(); });
$("#exportCsvBtn").addEventListener("click", () => { closeFileMenu(); exportCsv(); });
$("#exportMeasurementsCsvBtn").addEventListener("click", () => { closeFileMenu(); exportMeasurementsCsv(); });
$("#exportPdfBtn").addEventListener("click", () => { closeFileMenu(); exportPdfReport(); });
$("#newProjectBtn").addEventListener("click", () => { closeFileMenu(); openNewProjectDialog(); });
$(".file-menu").addEventListener("pointerleave", () => $(".file-menu").classList.remove("closed"));
$("#fileMenuBtn").addEventListener("click", (event) => {
event.stopPropagation();
const menu = $(".file-menu");
const wasClosed = menu.classList.contains("closed");
menu.classList.remove("closed");
const open = wasClosed || !menu.classList.contains("open");
menu.classList.toggle("open", open);
$("#fileMenuBtn").setAttribute("aria-expanded", String(open));
});
$("#fileMenu").addEventListener("click", (event) => {
if (event.target.closest("button") && !event.target.classList.contains("file-sub-trigger")) closeFileMenu();
});
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
$("#closeStainWizard").addEventListener("click", cancelStainWizard);
$("#stainWizardCancel").addEventListener("click", cancelStainWizard);
$("#stainWizard").addEventListener("cancel", (event) => event.preventDefault());
bindStainWizardDrag();
$("#stainWizardBack").addEventListener("click", stainWizardBack);
$("#stainWizardSkip").addEventListener("click", stainWizardSkip);
$("#stainWizardNext").addEventListener("click", stainWizardNext);
$("#projectName").addEventListener("focus", recordHistory);
$("#caseNumber").addEventListener("focus", recordHistory);
$("#projectNotes").addEventListener("focus", recordHistory);
$("#projectName").addEventListener("input", syncProjectMetadata);
$("#caseNumber").addEventListener("input", syncProjectMetadata);
$("#projectNotes").addEventListener("input", syncProjectMetadata);
window.addEventListener("keydown", (event) => {
if (document.querySelector("dialog[open]:not(#stainWizard)")) return;
if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
const key = event.key.toLowerCase();
if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "z") {
event.preventDefault();
if (event.shiftKey) redo();
else undo();
return;
}
if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "y") {
event.preventDefault();
redo();
return;
}
if (event.ctrlKey || event.metaKey) return;
const shortcuts = { v: "select", s: "scale", p: "point", d: "distance", a: "angle", c: "circle", e: "ellipse", h: "halfEllipse", l: "polyline", g: "polygon", t: "text", n: "stainCount" };
if (shortcuts[key]) setTool(shortcuts[key]);
if (key === "f") {
event.preventDefault();
if (!flipSelectedSeedDirection()) flipSelectedEllipse();
return;
}
if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
if (event.key === "Escape") {
if (state.stainWizardOpen) {
state.draft = null;
const step = stainWizardSteps[state.stainWizardIndex];
const session = stainSession();
state.stainMode = step?.mode || (step?.id === "detectRun" && (session?.seedCenters || []).length ? "centers" : null);
renderStainWizard();
updateHint();
draw();
return;
}
if (state.stainMode || state.draft?.stainManual || state.draft?.type === "stainDetect" || state.draft?.type === "stainExclude" || state.draft?.type === "stainSample") {
if (state.stainVariant === "manual" && state.tool === "stainCount") {
state.draft = null;
setTool("select");
return;
}
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
applyPanelWidths();
bindPanelResizers();
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
