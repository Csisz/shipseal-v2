import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { LocalScanEngine, SCAN_ENGINE_STEPS } from '@/lib/scanEngine';

async function repositoryZip() {
  const zip = new JSZip();
  zip.file('demo/package.json', JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }));
  zip.file('demo/README.md', '# Demo');
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'demo.zip', { type: 'application/zip' });
}

describe('truthful scan progress contract', () => {
  it('emits the real phases once, in order, and completes at 100', async () => {
    const started: string[] = [];
    const completed: string[] = [];
    const progress: number[] = [];

    const report = await new LocalScanEngine().scan(
      { file: await repositoryZip(), mode: 'local', source: { sourceType: 'zip-upload' } },
      {
        onStepStart: step => started.push(step),
        onStepComplete: step => completed.push(step),
        onProgress: value => progress.push(value),
      },
    );

    expect(started).toEqual([...SCAN_ENGINE_STEPS]);
    expect(completed).toEqual([...SCAN_ENGINE_STEPS]);
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
    expect(report.repoName).toBe('demo');
  });

  it('reports failure without completing or fabricating later phases', async () => {
    const started: string[] = [];
    const completed: string[] = [];
    const onError = vi.fn();

    await expect(new LocalScanEngine().scan(
      { file: new File(['not a zip'], 'demo.txt', { type: 'text/plain' }), mode: 'local' },
      { onStepStart: step => started.push(step), onStepComplete: step => completed.push(step), onError },
    )).rejects.toThrow('Only .zip files are accepted.');

    expect(started).toEqual([]);
    expect(completed).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
