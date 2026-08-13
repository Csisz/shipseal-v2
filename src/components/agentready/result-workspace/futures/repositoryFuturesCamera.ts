export interface RepositoryFuturesCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface RepositoryFuturesViewport {
  width: number;
  height: number;
}

export interface RepositoryFuturesCameraInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RepositoryFuturesSafeViewport extends RepositoryFuturesViewport {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RepositoryFuturesWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type RepositoryFuturesCameraLayout = 'mobile' | 'tablet' | 'desktop';

export const FUTURES_CAMERA_LIMITS = { minimum: 0.44, maximum: 1.45 } as const;

const EMPTY_INSETS: RepositoryFuturesCameraInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const SAFE_VIEWPORT_CONSTANTS = {
  mobile: { top: 104, right: 18, bottom: 22, left: 18, inspectorGap: 18, fallbackInspectorHeight: 330 },
  tablet: { top: 108, right: 20, bottom: 22, left: 64, inspectorGap: 20, fallbackInspectorWidth: 288 },
  desktop: { top: 108, right: 24, bottom: 24, left: 72, inspectorGap: 24, fallbackInspectorWidth: 320 },
} as const;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function repositoryFuturesCameraLayout(viewport: RepositoryFuturesViewport): RepositoryFuturesCameraLayout {
  if (viewport.width < 768) return 'mobile';
  if (viewport.width < 1024) return 'tablet';
  return 'desktop';
}

export function repositoryFuturesSafeInsets(
  viewport: RepositoryFuturesViewport,
  inspector?: { width: number; height: number },
): RepositoryFuturesCameraInsets {
  const layout = repositoryFuturesCameraLayout(viewport);
  if (layout === 'mobile') {
    const constants = SAFE_VIEWPORT_CONSTANTS.mobile;
    const inspectorHeight = inspector
      ? Math.max(inspector.height, constants.fallbackInspectorHeight)
      : 0;
    return {
      top: constants.top,
      right: constants.right,
      bottom: constants.bottom + (inspector ? inspectorHeight + constants.inspectorGap : 0),
      left: constants.left,
    };
  }
  const constants = layout === 'tablet' ? SAFE_VIEWPORT_CONSTANTS.tablet : SAFE_VIEWPORT_CONSTANTS.desktop;
  const inspectorWidth = inspector
    ? Math.max(inspector.width, constants.fallbackInspectorWidth)
    : 0;
  return {
    top: constants.top,
    right: constants.right + (inspector ? inspectorWidth + constants.inspectorGap : 0),
    bottom: constants.bottom,
    left: constants.left,
  };
}

export function repositoryFuturesSafeViewport(
  viewport: RepositoryFuturesViewport,
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
): RepositoryFuturesSafeViewport {
  const left = clamp(insets.left, 0, Math.max(0, viewport.width - 1));
  const top = clamp(insets.top, 0, Math.max(0, viewport.height - 1));
  const right = clamp(viewport.width - insets.right, left + 1, viewport.width);
  const bottom = clamp(viewport.height - insets.bottom, top + 1, viewport.height);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function repositoryFuturesBounds(
  targets: Array<{ x: number; y: number; width?: number; height?: number }>,
): RepositoryFuturesWorldBounds | undefined {
  if (!targets.length) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  targets.forEach(target => {
    const halfWidth = (target.width || 0) / 2;
    const halfHeight = (target.height || 0) / 2;
    minX = Math.min(minX, target.x - halfWidth);
    minY = Math.min(minY, target.y - halfHeight);
    maxX = Math.max(maxX, target.x + halfWidth);
    maxY = Math.max(maxY, target.y + halfHeight);
  });
  return { minX, minY, maxX, maxY };
}

export function fitRepositoryFuturesBoundsCamera(
  viewport: RepositoryFuturesViewport,
  bounds: RepositoryFuturesWorldBounds,
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
  padding = 48,
  maximumZoom = 1.15,
): RepositoryFuturesCamera {
  const safe = repositoryFuturesSafeViewport(viewport, insets);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const usableWidth = Math.max(1, safe.width - padding * 2);
  const usableHeight = Math.max(1, safe.height - padding * 2);
  const zoom = clamp(
    Math.min(usableWidth / width, usableHeight / height),
    FUTURES_CAMERA_LIMITS.minimum,
    Math.min(maximumZoom, FUTURES_CAMERA_LIMITS.maximum),
  );
  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    x: safe.left + safe.width / 2 - worldCenterX * zoom,
    y: safe.top + safe.height / 2 - worldCenterY * zoom,
  };
}

export function fitRepositoryFuturesCamera(
  viewport: RepositoryFuturesViewport,
  world: RepositoryFuturesViewport,
  padding = 36,
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
): RepositoryFuturesCamera {
  return fitRepositoryFuturesBoundsCamera(
    viewport,
    { minX: 0, minY: 0, maxX: world.width, maxY: world.height },
    insets,
    padding,
  );
}

export function zoomRepositoryFuturesCamera(
  camera: RepositoryFuturesCamera,
  nextZoom: number,
  anchor: { x: number; y: number },
): RepositoryFuturesCamera {
  const zoom = clamp(nextZoom, FUTURES_CAMERA_LIMITS.minimum, FUTURES_CAMERA_LIMITS.maximum);
  const worldX = (anchor.x - camera.x) / camera.zoom;
  const worldY = (anchor.y - camera.y) / camera.zoom;
  return {
    zoom,
    x: anchor.x - worldX * zoom,
    y: anchor.y - worldY * zoom,
  };
}

export function panRepositoryFuturesCamera(camera: RepositoryFuturesCamera, deltaX: number, deltaY: number) {
  return { ...camera, x: camera.x + deltaX, y: camera.y + deltaY };
}

export function constrainRepositoryFuturesCamera(
  camera: RepositoryFuturesCamera,
  viewport: RepositoryFuturesViewport,
  bounds: RepositoryFuturesWorldBounds,
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
  overscrollRatio = 0.28,
): RepositoryFuturesCamera {
  const safe = repositoryFuturesSafeViewport(viewport, insets);
  const topologyWidth = Math.max(1, (bounds.maxX - bounds.minX) * camera.zoom);
  const topologyHeight = Math.max(1, (bounds.maxY - bounds.minY) * camera.zoom);
  const visibleWidth = Math.min(topologyWidth * 0.5, safe.width * (1 - overscrollRatio));
  const visibleHeight = Math.min(topologyHeight * 0.5, safe.height * (1 - overscrollRatio));
  const minimumX = safe.left + visibleWidth - bounds.maxX * camera.zoom;
  const maximumX = safe.right - visibleWidth - bounds.minX * camera.zoom;
  const minimumY = safe.top + visibleHeight - bounds.maxY * camera.zoom;
  const maximumY = safe.bottom - visibleHeight - bounds.minY * camera.zoom;
  return {
    ...camera,
    x: minimumX <= maximumX ? clamp(camera.x, minimumX, maximumX) : (minimumX + maximumX) / 2,
    y: minimumY <= maximumY ? clamp(camera.y, minimumY, maximumY) : (minimumY + maximumY) / 2,
  };
}

export function revealRepositoryFuturesTarget(
  camera: RepositoryFuturesCamera,
  safe: RepositoryFuturesSafeViewport,
  target: { x: number; y: number; width?: number; height?: number },
  padding = 18,
): RepositoryFuturesCamera {
  const halfWidth = ((target.width || 0) * camera.zoom) / 2;
  const halfHeight = ((target.height || 0) * camera.zoom) / 2;
  const left = target.x * camera.zoom + camera.x - halfWidth;
  const right = target.x * camera.zoom + camera.x + halfWidth;
  const top = target.y * camera.zoom + camera.y - halfHeight;
  const bottom = target.y * camera.zoom + camera.y + halfHeight;
  let x = camera.x;
  let y = camera.y;
  if (left < safe.left + padding) x += safe.left + padding - left;
  else if (right > safe.right - padding) x -= right - (safe.right - padding);
  if (top < safe.top + padding) y += safe.top + padding - top;
  else if (bottom > safe.bottom - padding) y -= bottom - (safe.bottom - padding);
  if (x === camera.x && y === camera.y) return camera;
  return { x, y, zoom: camera.zoom };
}

/**
 * Compatibility wrapper for point focus. Unlike the previous fly-to policy,
 * it only reveals an obscured point and never changes zoom.
 */
export function focusRepositoryFuturesCamera(
  camera: RepositoryFuturesCamera,
  viewport: RepositoryFuturesViewport,
  target: { x: number; y: number },
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
): RepositoryFuturesCamera {
  return revealRepositoryFuturesTarget(camera, repositoryFuturesSafeViewport(viewport, insets), target);
}

export function frameRepositoryFuturesOrigin(
  viewport: RepositoryFuturesViewport,
  root: { x: number; y: number },
  orientation: 'horizontal' | 'vertical',
  insets: RepositoryFuturesCameraInsets = EMPTY_INSETS,
  zoom = 0.9,
): RepositoryFuturesCamera {
  const safe = repositoryFuturesSafeViewport(viewport, insets);
  const boundedZoom = clamp(zoom, FUTURES_CAMERA_LIMITS.minimum, FUTURES_CAMERA_LIMITS.maximum);
  const targetX = orientation === 'horizontal' ? safe.left + safe.width * 0.25 : safe.left + safe.width / 2;
  const targetY = orientation === 'vertical' ? safe.top + safe.height * 0.22 : safe.top + safe.height / 2;
  return { x: targetX - root.x * boundedZoom, y: targetY - root.y * boundedZoom, zoom: boundedZoom };
}

export function repositoryFuturesLod(zoom: number): 'far' | 'medium' | 'near' {
  if (zoom < 0.68) return 'far';
  if (zoom < 1.02) return 'medium';
  return 'near';
}
