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
    <section data-testid="future-pathways-hero-stage" aria-label="Future Path visual composer" className="relative overflow-hidden border-b border-primary/15 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.1),transparent_38%),linear-gradient(135deg,hsl(var(--universe-stage-bg)),hsl(var(--universe-surface)/0.74))]">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.055)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.055)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
      <div className="relative z-10 flex flex-col gap-3 border-b border-primary/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" /> Product direction composer
          </div>
          <div data-testid="future-selected-path-summary" className="mt-1 truncate text-sm font-semibold">
            {primary ? `${primary.title} · ${supports.length} of 2 supports · ${overlay.dependencies.length} automatic requirements` : 'Choose one primary Product Future'}
          </div>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-border/45 bg-background/35 px-3 py-1.5 text-[10px] text-muted-foreground">
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
        className="relative z-10 min-h-[28rem] px-3 py-5 sm:px-5 md:min-h-[31rem] md:px-6 md:py-7"
      >
        {!primary ? (
          <div className="mx-auto max-w-6xl">
            {overlay.productIntelligenceState === 'analysing' ? (
              <div role="status" aria-live="polite" className="mx-auto mt-12 max-w-xl rounded-3xl border border-primary/25 bg-primary/5 p-7 text-center shadow-[0_0_36px_hsl(var(--primary)/0.08)]">
                <Sparkles className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-display text-xl font-semibold">Understanding this product</h3>
                <p className="mt-2 text-sm text-muted-foreground">ShipSeal is exploring its strongest next directions.</p>
                <p className="mt-3 text-xs text-muted-foreground">Repository improvements remain available under Other improvements.</p>
              </div>
            ) : <>
              <div className="mb-4 max-w-2xl">
                <h3 className="font-display text-lg font-semibold sm:text-xl">{overlay.productIntelligenceState === 'enhanced' ? 'Strong product directions' : 'Repository evidence fallback'}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{overlay.productIntelligenceState === 'enhanced'
                  ? 'Choose the building block that should lead the product’s next chapter.'
                  : 'These are technical improvement options, not strategic Product Opportunities.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Recommended Product Futures">
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
            </>}
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <section aria-labelledby="primary-future-heading" className="flex flex-col items-center">
              <ZoneLabel step="01" title="Primary future" description="The direction leading this chapter" />
              <OpportunityNode
                candidate={primary}
                label="Chosen direction"
                active={activeId === primary.goalId}
                prominent
                actions={<NodeAction label="Details" onClick={() => inspectCandidate(primary.goalId)} expanded={activeId === primary.goalId} />}
              />
              <h3 id="primary-future-heading" className="sr-only">Primary Product Future</h3>
            </section>

            <ComposerConnector label="combine with" />

            <section aria-labelledby="supporting-futures-heading">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <ZoneLabel step="02" title="Optional supports" description="Add up to two compatible directions" align="left" />
                <span className="text-xs text-muted-foreground">{supports.length} of 2 selected</span>
              </div>
              <h3 id="supporting-futures-heading" className="sr-only">Supporting Product Futures</h3>
              <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2" role="list" aria-label="Supporting Product Futures">
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
                  <button type="button" onClick={() => setSupportChooserOpen(value => !value)} aria-label="Add supporting opportunity" aria-expanded={supportChooserOpen} className="group grid min-h-28 place-items-center rounded-2xl border border-dashed border-primary/40 bg-primary/[0.035] p-4 text-sm font-medium text-primary transition-colors hover:border-primary/65 hover:bg-primary/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
                    <span><span className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full border border-primary/30 bg-primary/10"><Plus className="h-4 w-4" aria-hidden="true" /></span>Add supporting opportunity<span className="mt-1 block text-[10px] font-normal text-muted-foreground">Slot {supports.length + 1} of 2</span></span>
                  </button>
                )}
                {supports.length === 0 && <div aria-hidden="true" className="hidden min-h-28 place-items-center rounded-2xl border border-dashed border-border/25 bg-background/15 text-xs text-muted-foreground/60 sm:grid">Support slot 2</div>}
              </div>

              {supports.length === 2 && (
                <div className="mt-3 text-center">
                  <button type="button" onClick={() => setSupportChooserOpen(value => !value)} aria-expanded={supportChooserOpen} className="min-h-10 rounded-full border border-border/50 bg-background/30 px-4 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Replace className="mr-2 inline h-3.5 w-3.5" aria-hidden="true" />Replace a supporting goal
                  </button>
                </div>
              )}

              {supportChooserOpen && (
                <SupportChooser
                  candidates={compatibleCandidates}
                  supports={supports}
                  onClose={() => setSupportChooserOpen(false)}
                  onAdd={goalId => { overlay.onCandidateAddSupport(goalId); setSupportChooserOpen(false); }}
                  onReplace={(addedGoalId, removedGoalId) => { overlay.onCandidateReplaceSupport(addedGoalId, removedGoalId); setSupportChooserOpen(false); }}
                  onDetails={inspectCandidate}
                />
              )}
            </section>

            <ComposerConnector label="automatically enables" subtle />

            <section aria-labelledby="automatic-requirements-heading" className="mx-auto max-w-5xl">
              <h3 id="automatic-requirements-heading" className="sr-only">Automatic requirements</h3>
              <details className="group rounded-2xl border border-accent/20 bg-background/20">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/[0.07] text-accent"><LockKeyhole className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-accent">03 · System-generated</span><span className="mt-0.5 block text-sm font-medium text-foreground">Automatic requirements <span className="font-normal text-muted-foreground">· {overlay.dependencies.length}</span></span></span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">View required capabilities</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></span>
                </summary>
                <div className="border-t border-accent/15 px-4 py-4 sm:px-5">
                  <p className="mb-3 text-xs text-muted-foreground">Added from the selected direction and supports. They are required, not manually selected opportunities.</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {orderedDependencies.map(dependency => (
                      <DependencyNode key={dependency.id} dependency={dependency} active={activeId === dependency.id} onInspect={() => inspectDependency(dependency.id)} />
                    ))}
                    {!orderedDependencies.length && <p className="text-sm text-muted-foreground">No additional capability requirement was derived.</p>}
                  </div>
                </div>
              </details>
            </section>
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
    <article role={prominent ? undefined : 'listitem'} data-future-node="goal" data-future-role={candidate.role} data-product-opportunity-origin={candidate.opportunityOrigin} className={`relative flex h-full flex-col rounded-2xl border bg-[hsl(var(--universe-surface-raised)/0.86)] ${compact ? 'p-3.5' : 'p-4'} backdrop-blur-sm transition-[border-color,box-shadow,transform] motion-reduce:transition-none ${prominent ? 'w-full max-w-xl border-primary/60 shadow-[0_0_30px_hsl(var(--primary)/0.13)] md:p-5' : active ? 'border-primary/60 shadow-[0_0_22px_hsl(var(--primary)/0.08)]' : 'border-border/45 shadow-[var(--shadow-sm-semantic)] hover:border-primary/35'}`}>
      {prominent && <span aria-hidden="true" className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-r from-primary/15 via-transparent to-accent/10 blur-lg" />}
      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.13em] text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{label}
      </div>
      <h4 className={`${prominent ? 'mt-2.5 text-xl md:text-2xl' : 'mt-2 text-base'} font-display font-semibold leading-tight text-foreground`}>{candidate.title}</h4>
      <p className={`${compact ? 'line-clamp-1' : 'line-clamp-2'} mt-1.5 text-sm leading-relaxed text-muted-foreground`}>{candidate.userValue || candidate.rationale || 'Proposed repository-grounded direction.'}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <NodeTag>{originLabel(candidate)}</NodeTag>
        <NodeTag>{candidate.fit}</NodeTag>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-border/35 pt-3">{actions}</div>
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

function ZoneLabel({ step, title, description, align = 'center' }: { step: string; title: string; description: string; align?: 'left' | 'center' }) {
  return <div className={`${align === 'center' ? 'mb-3 text-center' : ''}`}><div className="text-[9px] font-mono uppercase tracking-[0.16em] text-primary">{step} · {title}</div><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>;
}

function ComposerConnector({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return <div aria-hidden="true" className={`${subtle ? 'h-14' : 'h-16'} flex flex-col items-center justify-center`}><span className={`h-5 w-px ${subtle ? 'bg-border/45' : 'bg-gradient-to-b from-primary/65 to-accent/50'}`} /><span className="rounded-full border border-border/35 bg-background/30 px-2 py-0.5 text-[8px] font-mono uppercase tracking-[0.13em] text-muted-foreground">{label}</span><span className={`h-5 w-px ${subtle ? 'bg-border/35' : 'bg-gradient-to-b from-accent/50 to-primary/20'}`} /></div>;
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
