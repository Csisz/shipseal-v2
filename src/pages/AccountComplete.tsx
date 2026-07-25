import { useEffect } from 'react';
import { SurfaceState } from '@/components/agentready/SurfaceState';

export default function AccountComplete() {
  useEffect(() => {
    window.opener?.postMessage({ source: 'shipseal-account', status: 'authenticated' }, window.location.origin);
    const timer = window.setTimeout(() => window.close(), 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="container flex min-h-screen max-w-2xl items-center py-16">
      <SurfaceState tone="loading" title="Signed in to ShipSeal" description="Returning to your scan." />
    </main>
  );
}
