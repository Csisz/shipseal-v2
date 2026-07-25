import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';

export default function NotFound() {
  return (
    <SecondaryPageShell
      eyebrow="404"
      title="This route is not part of the map."
      description="The page may have moved, or the address may be incomplete."
      maxWidth="max-w-3xl"
    >
      <section className="rounded-2xl border border-border/55 bg-secondary/10 p-5">
        <Compass className="h-5 w-5 text-primary-glow" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-semibold">Return to repository exploration</h2>
        <p className="mt-2 text-sm text-muted-foreground">Start a new scan or open your saved projects.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild><a href="/#scan">Scan a repository</a></Button>
          <Button asChild variant="outline"><a href="/projects">My projects</a></Button>
        </div>
      </section>
    </SecondaryPageShell>
  );
}
