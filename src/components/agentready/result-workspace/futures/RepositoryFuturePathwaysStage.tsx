import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Info, Layers3, LockKeyhole, Plus, Replace, Sparkles, X } from 'lucide-react';
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
  const orderedDependencies = useMemo(() => overlay.dependencies.slice()
    .sort((left, right) => left.executionOrder - right.executionOrder), [overlay.dependencies]);

  useEffect(() => {
    if (activeId && !overlay.candidates.some(candidate => candidate.goalId === activeId)
      && !overlay.dependencies.some(dependency => dependency.id === activeId)) setActiveId(undefined);
  }, [activeId, overlay.candidates, overlay.dependencies]);

  useEffect(() => {
    if (!primary) setSupportChooserOpen(false);
  }, [primary]);

  const inspectCandidate = (goalId: string) => {
    setActiveId(current => current === goalId ? undefined : goalId);
    overlay.onCandidateFocus(goalId);
  };
  const inspectDependency = (dependencyId: string) => {
    setActiveId(current => current === dependencyId ? undefined : dependencyId);
    overlay.onDependencyFocus(dependencyId);
  };

  return (
    <section data-testid="future-pathways-hero-stage" aria-label="Future Path controls" className="relative overflow-hidden border-b border-primary/10 bg-[linear-gradient(110deg,hsl(var(--universe-stage-bg)),hsl(var(--universe-surface)/0.62))]">
      <div className="relative z-10 flex flex-col gap-3 border-b border-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" /> Path controls
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{primary ? primary.title : 'Choose a primary direction on the future map'}</div>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-border/45 bg-background/35 px-3 py-1.5 text-[10px] text-muted-foreground">
          {overlay.productIntelligenceState === 'enhanced' ? 'Product opportunities enhanced'
            : overlay.productIntelligenceState === 'analysing' ? 'Analysing product opportunities'
              : 'Repository evidence fallback'}
        </span>
      </div>

      <div
        data-testid="future-path-controls"
        data-future-phase={overlay.phase}
        data-future-direction={mobile ? 'top-to-bottom' : 'left-to-right'}
        data-mobile-dom-sequence={mobile || undefined}
        data-reduced-motion-contract={reducedMotion ? 'static' : 'one-shot'}
        className="relative z-10 px-3 py-4 sm:px-5 md:px-6"
      >
        {overlay.productIntelligenceState === 'analysing' ? (
          <div role="status" aria-live="polite" className="flex min-h-20 items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Future paths are forming</h3><p className="mt-0.5 text-xs text-muted-foreground">Stay in the workspace—directions will appear here without another loading screen.</p></div>
          </div>
        ) : !primary ? (
          <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
            <div className="flex min-w-max items-stretch gap-2" role="list" aria-label="Recommended Product Futures">
                {initialCandidates.map(candidate => (
                  <OpportunityNode
                    key={candidate.goalId}
                    candidate={candidate}
                    label={directionLabel(candidate)}
                    active={activeId === candidate.goalId}
                    actions={<>
                      <NodeAction label="Make primary" onClick={() => overlay.onCandidateSelect(candidate.goalId)} primary />
                      <NodeAction label="Details" onClick={() => inspectCandidate(candidate.goalId)} expanded={activeId === candidate.goalId} />
                    </>}
                  />
                ))}
            </div>
            {!initialCandidates.length && <FallbackEmpty state={overlay.productIntelligenceState} />}
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
              <div className="flex min-w-max items-stretch gap-2" aria-label="Composed Future Path">
                <span aria-hidden="true" className="self-center text-xs font-mono text-muted-foreground">PRIMARY</span>
              <OpportunityNode
                candidate={primary}
                label="Chosen direction"
                active={activeId === primary.goalId}
                prominent
                actions={<NodeAction label="Details" onClick={() => inspectCandidate(primary.goalId)} expanded={activeId === primary.goalId} />}
              />
                <span aria-hidden="true" className="self-center text-primary/60">→</span>
                <div className="flex items-stretch gap-2" role="list" aria-label="Supporting Product Futures">
                {supports.map((candidate, index) => (
                  <OpportunityNode
                    key={candidate.goalId}
                    candidate={candidate}
                    label={`Support ${index + 1}`}
                    active={activeId === candidate.goalId}
                    compact
                    actions={<>
                      <NodeAction label="Remove" icon={<X className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => overlay.onCandidateRemoveSupport(candidate.goalId)} />
                      <NodeAction label="Details" onClick={() => inspectCandidate(candidate.goalId)} expanded={activeId === candidate.goalId} />
                    </>}
                  />
                ))}
                {supports.length < 2 && (
                  <button type="button" onClick={() => setSupportChooserOpen(value => !value)} aria-label="Add supporting opportunity" aria-expanded={supportChooserOpen} className="grid min-h-20 w-44 place-items-center rounded-2xl border border-dashed border-primary/35 bg-primary/[0.03] px-3 text-xs font-medium text-primary hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span><Plus className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />Add support · {supports.length + 1}/2</span>
                  </button>
                )}
              </div>
                {supports.length === 2 && (
                  <button type="button" onClick={() => setSupportChooserOpen(value => !value)} aria-expanded={supportChooserOpen} className="min-h-10 rounded-full border border-border/50 bg-background/30 px-4 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Replace className="mr-2 inline h-3.5 w-3.5" aria-hidden="true" />Replace a supporting goal
                  </button>
                )}
                <span aria-hidden="true" className="self-center text-primary/60">→</span>
                <details className="group w-64 shrink-0 rounded-2xl border border-accent/20 bg-background/20">
                  <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-accent" aria-hidden="true" /><span><span className="block text-[9px] font-mono uppercase tracking-[0.14em] text-accent">Automatic</span><span className="block text-xs font-medium">{overlay.dependencies.length} requirements</span></span></span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  </summary>
                  <div className="grid gap-2 border-t border-accent/15 p-3">
                    {orderedDependencies.map(dependency => (
                      <DependencyNode key={dependency.id} dependency={dependency} active={activeId === dependency.id} onInspect={() => inspectDependency(dependency.id)} />
                    ))}
                    {!orderedDependencies.length && <p className="text-xs text-muted-foreground">No additional capability required.</p>}
                  </div>
                </details>
              </div>
            </div>
            {supportChooserOpen && (
              <SupportChooser candidates={compatibleCandidates} supports={supports} onClose={() => setSupportChooserOpen(false)} onAdd={goalId => { overlay.onCandidateAddSupport(goalId); setSupportChooserOpen(false); }} onReplace={(addedGoalId, removedGoalId) => { overlay.onCandidateReplaceSupport(addedGoalId, removedGoalId); setSupportChooserOpen(false); }} onDetails={inspectCandidate} />
            )}
          </div>
        )}

        {(activeCandidate || activeDependency) && (
          <ComposerDetails candidate={activeCandidate} dependency={activeDependency} onClose={() => setActiveId(undefined)} />
        )}
      </div>
    </section>
  );
}

function OpportunityNode({ candidate, label, active, prominent = false, compact = false, actions }: {
  candidate: RepositoryFutureStageCandidate;
  label: string;
  active: boolean;
  prominent?: boolean;
  compact?: boolean;
  actions: ReactNode;
}) {
  return (
    <article role={prominent ? undefined : 'listitem'} data-future-node="goal" data-future-role={candidate.role} data-product-opportunity-origin={candidate.opportunityOrigin} className={`relative flex h-full w-56 shrink-0 flex-col rounded-2xl border bg-[hsl(var(--universe-surface-raised)/0.82)] p-3 backdrop-blur-sm transition-[border-color,box-shadow] motion-reduce:transition-none ${prominent ? 'w-64 border-primary/60 shadow-[0_0_26px_hsl(var(--primary)/0.13)]' : active ? 'border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.08)]' : 'border-border/40 hover:border-primary/35'}`}>
      {prominent && <span aria-hidden="true" className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-r from-primary/15 via-transparent to-accent/10 blur-lg" />}
      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.13em] text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{label}
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{candidate.title}</h4>
      {!compact && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{candidate.userValue || candidate.rationale || 'Proposed repository-grounded direction.'}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <NodeTag>{originLabel(candidate)}</NodeTag>
        <NodeTag>{candidate.fit}</NodeTag>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border/30 pt-2">{actions}</div>
    </article>
  );
}

function NodeTag({ children }: { children: ReactNode }) {
  return <span className="max-w-full truncate rounded-full border border-border/40 bg-background/30 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">{children}</span>;
}

function DependencyNode({ dependency, active, onInspect }: { dependency: RepositoryFutureStageDependency; active: boolean; onInspect: () => void }) {
  const satisfied = dependency.state === 'satisfied';
  return (
    <button type="button" data-future-node="dependency" data-dependency-state={dependency.state} aria-expanded={active} onClick={onInspect} className={`min-h-16 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${active ? 'border-accent/55 bg-accent/[0.09]' : 'border-border/35 bg-background/25 hover:border-accent/35'}`}>
      <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.12em] text-accent">
        {satisfied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}
        {satisfied ? 'Existing' : 'Required'}
      </span>
      <span className="mt-1.5 block text-sm font-medium text-foreground">{dependency.title}</span>
    </button>
  );
}

function NodeAction({ label, onClick, primary = false, icon, expanded }: { label: string; onClick: () => void; primary?: boolean; icon?: ReactNode; expanded?: boolean }) {
  return <button type="button" aria-expanded={expanded} onClick={event => { event.stopPropagation(); onClick(); }} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${primary ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border/45 bg-background/35 text-foreground hover:border-primary/35 hover:bg-primary/[0.06]'}`}>{icon}{label}</button>;
}

function SupportChooser({ candidates, supports, onAdd, onReplace, onDetails, onClose }: {
  candidates: RepositoryFutureStageCandidate[];
  supports: RepositoryFutureStageCandidate[];
  onAdd: (goalId: string) => void;
  onReplace: (addedGoalId: string, removedGoalId: string) => void;
  onDetails: (goalId: string) => void;
  onClose: () => void;
}) {
  const heading = supports.length >= 2 ? 'Choose a replacement' : 'Add a supporting direction';
  return (
    <section aria-label={supports.length >= 2 ? 'Replace a supporting Product Future' : 'Add a supporting Product Future'} className="mx-auto mt-4 max-w-4xl rounded-2xl border border-primary/25 bg-[hsl(var(--universe-surface-raised)/0.95)] p-4 shadow-[var(--shadow-floating-panel)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[9px] font-mono uppercase tracking-[0.15em] text-primary">Compatible building blocks</div><h4 className="mt-1 font-semibold">{heading}</h4></div>
        <button type="button" onClick={onClose} aria-label="Close support chooser" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {candidates.map(candidate => (
          <article key={candidate.goalId} className="rounded-xl border border-border/40 bg-background/25 p-3">
            <div className="flex flex-wrap gap-1.5"><NodeTag>{originLabel(candidate)}</NodeTag><NodeTag>{candidate.fit}</NodeTag></div>
            <h5 className="mt-2 font-medium leading-snug">{candidate.title}</h5>
            <div className="mt-3 flex flex-wrap gap-2">
              {supports.length < 2
                ? <NodeAction label="Add support" primary onClick={() => onAdd(candidate.goalId)} />
                : supports.map((support, index) => candidate.replaceableSupportGoalIds?.includes(support.goalId)
                  ? <NodeAction key={support.goalId} label={`Replace support ${index + 1}`} onClick={() => onReplace(candidate.goalId, support.goalId)} />
                  : null)}
              <NodeAction label="Details" onClick={() => onDetails(candidate.goalId)} />
            </div>
          </article>
        ))}
        {!candidates.length && <p className="py-4 text-sm text-muted-foreground">No additional compatible Product Future is available for this draft.</p>}
      </div>
    </section>
  );
}

function ComposerDetails({ candidate, dependency, onClose }: { candidate?: RepositoryFutureStageCandidate; dependency?: RepositoryFutureStageDependency; onClose: () => void }) {
  const evidencePaths = candidate?.evidencePaths || dependency?.evidencePaths || [];
  const limitations = candidate?.limitations || dependency?.limitations || [];
  return (
    <aside data-testid="future-context-inspector" aria-label="Future details" className="mx-auto mt-5 max-w-3xl rounded-2xl border border-primary/25 bg-[hsl(var(--universe-surface-raised)/0.96)] p-4 shadow-[var(--shadow-floating-panel)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[9px] font-mono uppercase tracking-[0.16em] text-primary">{candidate ? 'Opportunity details' : 'Automatic requirement'}</div><h3 className="mt-1 font-display text-lg font-semibold">{candidate?.title || dependency?.title}</h3></div>
        <button type="button" onClick={onClose} aria-label="Close details" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      {candidate?.userValue && <p className="mt-3 text-sm font-medium text-foreground">{candidate.userValue}</p>}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{candidate?.whyItFits || candidate?.rationale || dependency?.rationale}</p>
      {dependency && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-foreground"><LockKeyhole className="h-3.5 w-3.5 text-accent" aria-hidden="true" />Required capabilities cannot be removed independently.</p>}
      {candidate?.targetUsers?.length ? <p className="mt-3 text-xs text-muted-foreground">For: {candidate.targetUsers.join(', ')}</p> : null}
      {(evidencePaths.length > 0 || limitations.length > 0 || Boolean(candidate?.artifactLabels?.length)) && (
        <details className="mt-4 rounded-xl border border-border/40 bg-background/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Technical grounding and caveats</summary>
          <div className="mt-3 space-y-3 text-xs text-muted-foreground">
            {evidencePaths.length > 0 && <DetailList label="Evidence" items={evidencePaths} />}
            {candidate?.artifactLabels?.length ? <DetailList label="Prospective implementation areas" items={candidate.artifactLabels} /> : null}
            {limitations.length > 0 && <DetailList label="Caveats" items={limitations} />}
          </div>
        </details>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Proposed direction, not a current capability. Implementation and verification are still required.</p>
    </aside>
  );
}

function DetailList({ label, items }: { label: string; items: string[] }) {
  return <div><div className="font-medium text-foreground">{label}</div><ul className="mt-1 space-y-1">{items.slice(0, 8).map(item => <li key={item} className="break-all">{item}</li>)}</ul></div>;
}

function FallbackEmpty({ state }: { state: RepositoryFutureStageOverlay['productIntelligenceState'] }) {
  return <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border/50 bg-background/25 p-5 text-center text-sm text-muted-foreground">{state === 'analysing' ? 'ShipSeal is analysing bounded product evidence. Repository fallback remains available in Deep Configuration.' : 'No eligible recommendation can be composed from the current evidence.'}</div>;
}

function originLabel(candidate: RepositoryFutureStageCandidate) {
  if (candidate.opportunityOrigin === 'evidence-backed') return 'Evidence-backed';
  if (candidate.opportunityOrigin === 'strategic') return 'Strategic';
  if (candidate.opportunityOrigin === 'exploratory') return 'Exploratory';
  return 'Repository improvement';
}

function directionLabel(candidate: RepositoryFutureStageCandidate) {
  if (candidate.opportunityOrigin === 'evidence-backed') return 'Strong next move';
  if (candidate.opportunityOrigin === 'strategic') return 'High-potential direction';
  if (candidate.opportunityOrigin === 'exploratory') return 'Explore with care';
  return 'Technical fallback';
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
