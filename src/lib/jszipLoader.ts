type JSZipConstructor = typeof import('jszip');

function isJSZipConstructor(value: unknown): value is JSZipConstructor {
  return typeof value === 'function' && 'loadAsync' in value;
}

function hasDefaultExport(value: unknown): value is { default: unknown } {
  return Boolean(value && typeof value === 'object' && 'default' in value);
}

/** Resolve JSZip across its CommonJS typings and Vite's ESM interop wrapper. */
export async function loadJSZip(): Promise<JSZipConstructor> {
  const module: unknown = await import('jszip');
  const candidate = hasDefaultExport(module) ? module.default : module;
  if (!isJSZipConstructor(candidate)) {
    throw new Error('JSZip did not expose a compatible browser constructor.');
  }
  return candidate;
}
