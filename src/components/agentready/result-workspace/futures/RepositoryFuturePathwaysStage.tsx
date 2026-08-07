import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Info, LockKeyhole, Plus, Replace, Sparkles, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { RepositoryFutureStageCandidate, RepositoryFutureStageDependency, RepositoryFutureStageOverlay } from './futurePathwaysPresentation';

export function RepositoryFuturePathwaysStage({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const mobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string>();
  const [supportChooserOpen, setSupportChooserOpen] = useState(false);
  const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
  const supports = overlay.candidates.filter(candidate => candidate.role === 'supporting');
  const compatibleCandidates = useMemo(() => overlay.candidates
    .filter(candidate => ['candidate', 'saved'].includes(candidate.role)
      && (overlay.supportCount >= 2
        ? Boolean(candidate.replaceableSupportGoalIds?.length)
        : ['compatible', 'compatible-with-review'].includes(candidate.compatibility)))
    .slice(0, 5), [overlay.candidates, overlay.supportCount]);
  const initialCandidates = overlay.candidates.filter(candidate => candidate.role === 'candidate').slice(0, 5);
  const activeCandidate = overlay.candidates.find(candidate => candidate.goalId === activeId);
  const activeDependency = overlay.dependencies.find(dependency => dependency.id === activeId);

  useEffect(() => {
    if (activeId && !overlay.candidates.some(candidate => candidate.goalId === activeId)
      && !overlay.dependencies.some(dependency => dependency.id === activeId)) setActiveId(undefined);
  }, [activeId, overlay.candidates, overlay.dependencies]);

  const inspectCandidate = (goalId: string) => {
    setActiveId(current => current === goalId ? undefined : goalId);
    overlay.onCandidateFocus(goalId);
  };
  const inspectDependency = (dependencyId: string) => {
    setActiveId(current => current === dependencyId ? undefined : dependencyId);
    overlay.onDependencyFocus(dependencyId);
  };

  return (
    <section data-testid="future-pathways-hero-stage" aria-label="Future Path visual composer" className="relative overflow-hidden border-b border-primary/15 bg-[radial-gradient(circle_at_18%_20%,hsl(var(--accent)/0.09),transparent_30%),radial-gradient(circle_at_82%_34%,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(110deg,hsl(var(--universe-stage-bg)),hsl(var(--universe-surface)/0.72))]">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
      <div className="relative z-10 flex flex-col gap-2 border-b border-primary/10 px-4 py-4 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">Product opportunity composer</div>
          <div data-testid="future-selected-path-summary" className="mt-1 text-sm font-semibold">
            {primary ? `${primary.title} · ${supports.length} of 2 supports · ${overlay.dependencies.length} automatic requirements` : 'Choose one primary Product Future'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Click nodes to compose. Connections remain evidence- and domain-derived; no arbitrary rewiring.</p>
        </div>
        <span className="rounded-full border border-border/50 bg-background/40 px-3 py-1.5 text-[10px] text-muted-foreground">
          {overlay.productIntelligenceState === 'enhanced' ? 'Product opportunities enhanced'
            : overlay.productIntelligenceState === 'analysing' ? 'Analysing product opportunities'
              : 'Repository evidence fallback'}
        </span>
      </div>

      <div
        data-testid="future-neural-field"
        data-future-phase={overlay.phase}
        data-future-direction={mobile ? 'top-to-bottom' : 'left-to-right'}
        data-mobile-dom-sequence={mobile || undefined}
        data-reduced-motion-contract={reducedMotion ? 'static' : 'one-shot'}
        className="relative z-10 min-h-[32rem] px-3 py-6 md:min-h-[38rem] md:px-6 md:py-8"
      >
        {!primary ? (
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 text-center">
              <h3 className="font-display text-xl font-semibold">Strong product directions</h3>
              <p className="mt-1 text-sm text-muted-foreground">Nothing is selected automatically. Choose the direction that should define the product’s next chapter.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Recommended Product Futures">
              {initialCandidates.map((candidate, index) => (
                <OpportunityNode
                  key={candidate.goalId}
                  candidate={candidate}
                  label={`${index + 1}. ${priorityLabel(candidate)}`}
                  active={activeId === candidate.goalId}
                  onInspect={() => inspectCandidate(candidate.goalId)}
                  actions={<>
                    <NodeAction label="Make primary" onClick={() => overlay.onCandidateSelect(candidate.goalId)} primary />
                    <NodeAction label="Details" onClick={() => inspectCandidate(candidate.goalId)} />
                  </>}
                />
              ))}
            </div>
            {!initialCandidates.length && <FallbackEmpty state={overlay.productIntelligenceState} />}
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col items-center">
            <OpportunityNode
              candidate={primary}
              label="Primary Product Future"
              active={activeId === primary.goalId}
              prominent
              onInspect={() => inspectCandidate(primary.goalId)}
              actions={<NodeAction label="Details" onClick={() => inspectCandidate(primary.goalId)} />}
            />

            <ComposerConnector label="supports and requirements" />

            <div className="grid w-full gap-3 md:grid-cols-2" aria-label="Supporting Product Futures">
              {supports.map((candidate, index) => (
                <OpportunityNode
                  key={candidate.goalId}
                  candidate={candidate}
                  label={`Support ${index + 1}`}
                  active={activeId === candidate.goalId}
                  onInspect={() => inspectCandidate(candidate.goalId)}
                  actions={<>
                    <NodeAction label="Remove" icon={<X className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => overlay.onCandidateRemoveSupport(candidate.goalId)} />
                    <NodeAction label="Details" onClick={() => inspectCandidate(candidate.goalId)} />
                  </>}
                />
              ))}
              {supports.length < 2 && (
                <button type="button" onClick={() => setSupportChooserOpen(value => !value)} className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-primary/45 bg-primary/5 p-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
                  <span><Plus className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />Add supporting opportunity</span>
                </button>
              )}
            </div>

            {supports.length === 2 && (
              <button type="button" onClick={() => setSupportChooserOpen(value => !value)} className="mt-3 min-h-11 rounded-full border border-border/55 bg-background/35 px-4 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Replace className="mr-2 inline h-3.5 w-3.5" aria-hidden="true" />Replace a supporting goal
              </button>
            )}

            {supportChooserOpen && (
              <SupportChooser
                candidates={compatibleCandidates}
                supports={supports}
                onAdd={goalId => { overlay.onCandidateAddSupport(goalId); setSupportChooserOpen(false); }}
                onReplace={(addedGoalId, removedGoalId) => { overlay.onCandidateReplaceSupport(addedGoalId, removedGoalId); setSupportChooserOpen(false); }}
                onDetails={inspectCandidate}
              />
            )}

            <ComposerConnector label="automatically requires" />

            <div className="w-full">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><div className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent">System-generated capability path</div><p className="mt-1 text-xs text-muted-foreground">Required nodes cannot be removed independently.</p></div>
                <span className="text-xs text-muted-foreground">{overlay.dependencies.length} required</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {overlay.dependencies.slice().sort((left, right) => left.executionOrder - right.executionOrder).map(dependency => (
                  <DependencyNode key={dependency.id} dependency={dependency} active={activeId === dependency.id} onInspect={() => inspectDependency(dependency.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {(activeCandidate || activeDependency) && (
          <ComposerDetails candidate={activeCandidate} dependency={activeDependency} onClose={() => setActiveId(undefined)} />
        )}
      </div>
    </section>
  );
}

function OpportunityNode({ candidate, label, active, prominent = false, onInspect, actions }: {
  candidate: RepositoryFutureStageCandidate;
  label: string;
  active: boolean;
  prominent?: boolean;
  onInspect: () => void;
  actions: ReactNode;
}) {
  return (
    <article role="listitem" data-future-node="goal" data-future-role={candidate.role} data-product-opportunity-origin={candidate.opportunityOrigin} className={`relative rounded-2xl border bg-[hsl(var(--universe-surface-raised)/0.9)] p-4 shadow-[var(--shadow-md-semantic)] backdrop-blur ${prominent ? 'w-full max-w-xl border-primary/70 shadow-[0_0_34px_hsl(var(--primary)/0.16)]' : active ? 'border-primary/65' : 'border-border/55'}`}>
      <button type="button" onClick={onInspect} aria-expanded={active} className="min-h-11 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.13em] text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{label}
          <span className="rounded-full border border-border/55 px-2 py-0.5 text-muted-foreground">{originLabel(candidate)}</span>
        </span>
        <span className={`${prominent ? 'mt-3 text-xl' : 'mt-2 text-base'} block font-display font-semibold text-foreground`}>{candidate.title}</span>
        <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">{candidate.userValue || candidate.rationale || 'Proposed repository-grounded direction.'}</span>
      </button>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/45 pt-3">{actions}</div>
    </article>
  );
}

function DependencyNode({ dependency, active, onInspect }: { dependency: RepositoryFutureStageDependency; active: boolean; onInspect: () => void }) {
  const satisfied = dependency.state === 'satisfied';
  return (
    <button type="button" data-future-node="dependency" data-dependency-state={dependency.state} aria-expanded={active} onClick={onInspect} className={`min-h-20 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'border-accent/70 bg-accent/10' : 'border-accent/35 bg-background/35'}`}>
      <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.13em] text-accent">
        {satisfied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}
        {satisfied ? 'Existing capability' : 'Required capability'}
      </span>
      <span className="mt-2 block text-sm font-medium text-foreground">{dependency.title}</span>
    </button>
  );
}

function NodeAction({ label, onClick, primary = false, icon }: { label: string; onClick: () => void; primary?: boolean; icon?: ReactNode }) {
  return <button type="button" onClick={event => { event.stopPropagation(); onClick(); }} className={`min-h-9 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${primary ? 'border-primary bg-primary text-primary-foreground' : 'border-border/55 bg-background/45 text-foreground'}`}>{icon}{label}</button>;
}

function SupportChooser({ candidates, supports, onAdd, onReplace, onDetails }: {
  candidates: RepositoryFutureStageCandidate[];
  supports: RepositoryFutureStageCandidate[];
  onAdd: (goalId: string) => void;
  onReplace: (addedGoalId: string, removedGoalId: string) => void;
  onDetails: (goalId: string) => void;
}) {
  return (
    <section aria-label={supports.length >= 2 ? 'Replace a supporting Product Future' : 'Add a supporting Product Future'} className="mt-4 w-full rounded-2xl border border-primary/25 bg-[hsl(var(--universe-surface-raised)/0.96)] p-4 shadow-[var(--shadow-floating-panel)]">
      <h4 className="font-semibold">{supports.length >= 2 ? 'Choose a direction, then the support it replaces' : 'Compatible supporting opportunities'}</h4>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {candidates.map(candidate => (
          <div key={candidate.goalId} className="rounded-xl border border-border/50 bg-background/35 p-3">
            <div className="text-xs font-mono uppercase tracking-wide text-primary">{originLabel(candidate)}</div>
            <div className="mt-1 font-medium">{candidate.title}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {supports.length < 2
                ? <NodeAction label="Add support" primary onClick={() => onAdd(candidate.goalId)} />
                : supports.map((support, index) => candidate.replaceableSupportGoalIds?.includes(support.goalId)
                  ? <NodeAction key={support.goalId} label={`Replace support ${index + 1}`} onClick={() => onReplace(candidate.goalId, support.goalId)} />
                  : null)}
              <NodeAction label="Details" onClick={() => onDetails(candidate.goalId)} />
            </div>
          </div>
        ))}
        {!candidates.length && <p className="text-sm text-muted-foreground">No additional compatible Product Future is available for this draft.</p>}
      </div>
    </section>
  );
}

function ComposerDetails({ candidate, dependency, onClose }: { candidate?: RepositoryFutureStageCandidate; dependency?: RepositoryFutureStageDependency; onClose: () => void }) {
  return (
    <aside data-testid="future-context-inspector" aria-label="Future details" className="mx-auto mt-5 max-w-3xl rounded-2xl border border-primary/25 bg-[hsl(var(--universe-surface-raised)/0.96)] p-4 shadow-[var(--shadow-floating-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[9px] font-mono uppercase tracking-[0.16em] text-primary">{candidate ? 'Why it fits this product' : 'Required because'}</div><h3 className="mt-1 font-semibold">{candidate?.title || dependency?.title}</h3></div>
        <button type="button" onClick={onClose} aria-label="Close details" className="grid h-9 w-9 place-items-center rounded-full border border-border/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{candidate?.whyItFits || candidate?.rationale || dependency?.rationale}</p>
      {dependency && <p className="mt-2 text-xs font-medium text-foreground">Required capabilities cannot be removed independently.</p>}
      {candidate?.targetUsers?.length ? <p className="mt-2 text-xs text-muted-foreground">For: {candidate.targetUsers.join(', ')}</p> : null}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" aria-hidden="true" />Details remain proposed and require later implementation and verification.</p>
    </aside>
  );
}

function ComposerConnector({ label }: { label: string }) {
  return <div aria-hidden="true" className="flex h-20 flex-col items-center justify-center"><span className="h-8 w-px bg-gradient-to-b from-primary/70 to-accent/60" /><span className="rounded-full border border-border/45 bg-background/45 px-2 py-1 text-[8px] font-mono uppercase tracking-[0.13em] text-muted-foreground">{label}</span><span className="h-8 w-px bg-gradient-to-b from-accent/60 to-primary/25" /></div>;
}

function FallbackEmpty({ state }: { state: RepositoryFutureStageOverlay['productIntelligenceState'] }) {
  return <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border/60 bg-background/30 p-5 text-center text-sm text-muted-foreground">{state === 'analysing' ? 'ShipSeal is analysing bounded product evidence. Repository fallback remains available in Deep Configuration.' : 'No eligible recommendation can be composed from the current evidence.'}</div>;
}

function originLabel(candidate: RepositoryFutureStageCandidate) {
  if (candidate.opportunityOrigin === 'evidence-backed') return 'Evidence-backed';
  if (candidate.opportunityOrigin === 'strategic') return 'Strategic';
  if (candidate.opportunityOrigin === 'exploratory') return 'Exploratory';
  return 'Repository improvement';
}

function priorityLabel(candidate: RepositoryFutureStageCandidate) {
  if (candidate.opportunityOrigin === 'evidence-backed') return 'Strong next move';
  if (candidate.opportunityOrigin === 'strategic') return 'High-potential extension';
  if (candidate.opportunityOrigin === 'exploratory') return 'Exploratory direction';
  return 'Repository improvement fallback';
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}
