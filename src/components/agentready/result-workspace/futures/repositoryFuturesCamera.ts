export interface RepositoryFuturesCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface RepositoryFuturesViewport {
  width: number;
  height: number;
}

export const FUTURES_CAMERA_LIMITS = { minimum: 0.2, maximum: 1.8 } as const;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function fitRepositoryFuturesCamera(
  viewport: RepositoryFuturesViewport,
  world: RepositoryFuturesViewport,
  padding = 36,
): RepositoryFuturesCamera {
  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = clamp(Math.min(usableWidth / world.width, usableHeight / world.height), FUTURES_CAMERA_LIMITS.minimum, 1.15);
  return {
    zoom,
    x: (viewport.width - world.width * zoom) / 2,
    y: (viewport.height - world.height * zoom) / 2,
  };
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

export function focusRepositoryFuturesCamera(
  camera: RepositoryFuturesCamera,
  viewport: RepositoryFuturesViewport,
  target: { x: number; y: number },
  targetZoom = 1.05,
): RepositoryFuturesCamera {
  const zoom = clamp(Math.max(camera.zoom, targetZoom), FUTURES_CAMERA_LIMITS.minimum, FUTURES_CAMERA_LIMITS.maximum);
  return {
    zoom,
    x: viewport.width / 2 - target.x * zoom,
    y: viewport.height / 2 - target.y * zoom,
  };
}

export function repositoryFuturesLod(zoom: number): 'far' | 'medium' | 'near' {
  if (zoom < 0.68) return 'far';
  if (zoom < 1.05) return 'medium';
  return 'near';
}
