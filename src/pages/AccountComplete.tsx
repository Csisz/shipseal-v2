import { useEffect } from 'react';

export default function AccountComplete() {
  useEffect(() => {
    window.opener?.postMessage({ source: 'shipseal-account', status: 'authenticated' }, window.location.origin);
    const timer = window.setTimeout(() => window.close(), 150);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="container py-24"><h1 className="font-display text-2xl font-semibold">Signed in to ShipSeal</h1><p className="mt-3 text-muted-foreground">Returning to your scan…</p></main>;
}
