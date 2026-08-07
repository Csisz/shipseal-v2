import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { buildFutureFieldLayout, futureImpulseEvent, futureRoutePath } from './futurePathwaysLayout';
import type { RepositoryFutureStageOverlay } from './futurePathwaysPresentation';

export function RepositoryFuturePathwaysStage({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const mobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
  const supports = overlay.candidates.filter(candidate => candidate.role === 'supporting');

  return (
    <section data-testid="future-pathways-hero-stage" aria-label="Directional Future Pathways" className="relative min-h-[31rem] overflow-hidden border-b border-primary/15 bg-[radial-gradient(circle_at_18%_45%,hsl(var(--accent)/0.09),transparent_30%),radial-gradient(circle_at_82%_44%,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(110deg,hsl(var(--universe-stage-bg)),hsl(var(--universe-surface)/0.72))] md:min-h-[36rem]">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4 md:left-6 md:right-6">
        <div className="max-w-[23rem] text-foreground">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">Current evidence → future horizon</div>
          <div data-testid="future-selected-path-summary" className="mt-1 text-sm font-semibold">{primary ? `Primary ${primary.title} · Supporting ${supports.length ? supports.map(item => item.title).join(' + ') : 'none'} · Requires ${overlay.dependencies.length ? overlay.dependencies.map(item => item.title).join(' → ') : 'none'}` : 'Choose one primary future'}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {primary ? `${supports.length} supporting · ${overlay.dependencies.length} required · ${overlay.artifactCount} prospective artifacts` : `${overlay.candidates.length} repository-evidence-backed recommendations`}
          </div>
        </div>
        {overlay.tracePinned && overlay.onTraceClear && <button type="button" onClick={overlay.onTraceClear} className="pointer-events-auto min-h-9 rounded-full border border-border/50 bg-[hsl(var(--universe-surface)/0.82)] px-3 text-[10px] text-muted-foreground backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear trace</button>}
      </div>
      <FutureField overlay={overlay} mobile={mobile} reducedMotion={reducedMotion} />
      {!mobile && <FutureContextInspector overlay={overlay} />}
    </section>
  );
}

function FutureField({ overlay, mobile, reducedMotion }: { overlay: RepositoryFutureStageOverlay; mobile: boolean; reducedMotion: boolean }) {
  if (mobile) {
    const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
    const dependencies = overlay.dependencies.slice().sort((left, right) => left.executionOrder - right.executionOrder).slice(0, 3);
    return (
      <div data-testid="future-neural-field" data-future-phase={overlay.phase} data-mobile-dom-sequence="true" className="absolute inset-0 flex items-end px-3 pb-5 pt-24">
        <div className="w-full rounded-[1.35rem] border border-primary/20 bg-[hsl(var(--universe-surface)/0.94)] p-4 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl">
          <div className="text-[9px] font-mono uppercase tracking-[0.17em] text-primary">Current evidence → intervention → future</div>
          <div className="mt-3 flex flex-col gap-2 text-xs">
            <GroundedEvidenceSummary overlay={overlay} />
            {dependencies.map(dependency => <button key={dependency.id} type="button" onClick={() => overlay.onDependencyFocus(dependency.id)} className="min-h-11 rounded-xl border border-border/50 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="mr-2 font-mono text-[9px] text-accent">REQUIRES</span>{dependency.title}</button>)}
            <strong className="rounded-xl border border-primary/45 bg-primary/10 px-3 py-3">{primary?.title || 'Choose a primary future'}</strong>
          </div>
          <button type="button" onClick={overlay.onOpenDomControls} className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open path details</button>
        </div>
      </div>
    );
  }

  const layout = buildFutureFieldLayout(overlay, {});
  const impulse = futureImpulseEvent(overlay, reducedMotion);
  return (
    <div data-testid="future-neural-field" data-future-phase={overlay.phase} data-future-direction="left-to-right" data-reduced-motion-contract={reducedMotion ? 'static' : 'one-shot'} className="absolute inset-0 overflow-hidden motion-safe:animate-fade-in">
      {layout.zones.map(zone => <div key={zone.id} data-future-zone={zone.id} aria-hidden="true" className="absolute bottom-8 top-[15%] w-[16%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.035),transparent_70%)]" style={{ left: `${zone.x}%` }}><span className="absolute left-1/2 top-0 w-max -translate-x-1/2 text-[8px] font-mono uppercase tracking-[0.16em] text-muted-foreground/65">{zone.label}</span></div>)}
      <div aria-hidden="true" className="absolute inset-y-[8%] w-28 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)] opacity-70 blur-xl" style={{ left: `${layout.horizonX}%` }} />
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs><linearGradient id="future-standalone-path-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="hsl(var(--accent))" stopOpacity=".3" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity=".95" /></linearGradient><filter id="future-standalone-path-glow"><feGaussianBlur stdDeviation="0.42" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {layout.routes.map(path => <path key={path.id} data-future-route={path.kind} data-route-broken={path.broken || undefined} d={futureRoutePath(path)} fill="none" stroke={path.kind === 'conflict' ? 'hsl(var(--warning))' : ['execution', 'support', 'capability'].includes(path.kind) ? 'url(#future-standalone-path-gradient)' : 'hsl(var(--muted-foreground))'} strokeWidth={path.kind === 'execution' ? 0.62 : path.kind === 'support' || path.kind === 'capability' ? 0.42 : 0.22} strokeDasharray={path.broken ? '2.3 2.8' : !path.deterministic || path.kind === 'saved' ? '1.1 1.15' : undefined} opacity={path.opacity} vectorEffect="non-scaling-stroke" filter={path.kind === 'execution' || path.kind === 'support' ? 'url(#future-standalone-path-glow)' : undefined} className="transition-opacity duration-200 motion-reduce:transition-none" />)}
      </svg>
      {layout.nodes.filter(node => node.kind === 'evidence').map(node => <span key={node.id} data-future-node="evidence" data-source-universe-node={node.sourceUniverseNodeId} aria-hidden="true" className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/20 shadow-[0_0_16px_hsl(var(--accent)/0.28)]" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }} />)}
      {layout.nodes.filter(node => node.kind === 'bundle').map(node => <span key={node.id} data-future-node="bundle" aria-hidden="true" className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/55 bg-[hsl(var(--universe-surface)/0.8)] shadow-[0_0_22px_hsl(var(--accent)/0.24)]" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }}><span className="absolute inset-[3px] rounded-full bg-accent/50" /></span>)}
      {layout.nodes.filter(node => node.kind === 'intervention').map(node => <button key={node.id} type="button" data-future-node="intervention" onMouseEnter={() => overlay.onTracePreview?.(node.pathGoalIds[0])} onMouseLeave={() => overlay.onTracePreview?.()} onFocus={() => overlay.onTracePreview?.(node.pathGoalIds[0])} onBlur={() => overlay.onTracePreview?.()} onClick={() => overlay.onTracePin?.(node.pathGoalIds[0])} className="absolute min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }} aria-label={`${node.label}. Intervention capability. Activate to pin its path.`}><span className="block h-5 w-5 rounded-md border border-primary/60 bg-primary/15 shadow-[0_0_20px_hsl(var(--primary)/0.28)]" /><span className="absolute left-1/2 top-[calc(50%+1rem)] w-max max-w-[7rem] -translate-x-1/2 text-[8px] font-medium leading-tight text-muted-foreground">{node.label}</span></button>)}
      {layout.nodes.filter(node => node.kind === 'dependency').map(node => <button key={node.id} type="button" data-future-node="dependency" data-dependency-state={node.state} onClick={() => { overlay.onDependencyFocus(node.id); overlay.onTracePin?.(node.id); }} className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center border bg-[hsl(var(--universe-surface-raised)/0.9)] shadow-[0_0_24px_hsl(var(--accent)/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${node.state === 'satisfied' ? 'rounded-full border-accent/45' : node.reviewRequired ? 'rounded-[0.35rem] border-double border-warning/70' : 'rounded-[0.35rem] border-accent/65'}`} style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }} aria-label={`${node.label}. Required dependency. ${node.state}.`}><span className="-rotate-45 text-[9px] font-bold text-accent">{node.state === 'satisfied' ? '✓' : node.reviewRequired ? '!' : (node.order || 0) + 1}</span></button>)}
      {layout.nodes.filter(node => node.kind === 'goal').map(node => { const candidate = overlay.candidates.find(item => item.goalId === node.id)!; const selectable = candidate.role === 'candidate'; const primary = candidate.role === 'primary'; return <button key={node.id} type="button" data-future-node="goal" data-future-role={candidate.role} onFocus={() => overlay.onTracePreview?.(candidate.goalId)} onBlur={() => overlay.onTracePreview?.()} onMouseEnter={() => overlay.onTracePreview?.(candidate.goalId)} onMouseLeave={() => overlay.onTracePreview?.()} onClick={() => selectable ? overlay.onCandidateSelect(candidate.goalId) : overlay.onTracePin?.(candidate.goalId)} className="group absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity, transform: `translate(-50%, -50%) scale(${node.scale})` }} aria-label={`${candidate.title}. ${candidate.fit}. ${candidate.role}. ${selectable ? 'Activate to choose as primary.' : 'Activate to pin its path.'}`}><span aria-hidden="true" className={`absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border ${primary ? 'h-10 w-10 border-primary/90 bg-primary/20 shadow-[0_0_38px_hsl(var(--primary)/0.42)]' : candidate.role === 'supporting' ? 'h-7 w-7 border-accent/80 bg-accent/20' : candidate.role === 'saved' ? 'h-4 w-4 border-dashed border-muted-foreground/55' : 'h-6 w-6 border-primary/45 bg-primary/10'}`} /><span className={`absolute left-1/2 top-[calc(50%+1.55rem)] w-max max-w-[9rem] -translate-x-1/2 text-center leading-tight text-foreground ${primary ? 'text-xs font-semibold' : 'text-[10px] font-medium'}`}><span className="block text-[8px] font-mono uppercase tracking-[0.13em] text-muted-foreground">{candidate.role === 'candidate' ? candidate.fit : candidate.role}</span>{candidate.title}</span></button>; })}
      {impulse && <span key={overlay.draftFingerprint || overlay.activeTraceId || overlay.focusedId} data-semantic-impulse={impulse} aria-hidden="true" className="future-semantic-impulse absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.8)]" style={{ left: `${layout.horizonX}%`, top: '50%' }} />}
      <div className="absolute bottom-4 left-[42%] -translate-x-1/2 rounded-full bg-[hsl(var(--universe-stage-bg)/0.76)] px-3 py-1.5 text-[9px] text-muted-foreground backdrop-blur-sm">Solid = evidence-backed · dashed = inferred or saved · diamond = required · broken = conflict</div>
    </div>
  );
}

function GroundedEvidenceSummary({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const mapped = overlay.candidates.reduce((total, candidate) => total + candidate.mappedEvidenceCount, 0);
  const evidence = overlay.candidates.reduce((total, candidate) => total + candidate.evidenceCount, 0);
  return <div className="rounded-xl border border-accent/35 bg-accent/5 px-3 py-3"><span className="mr-2 font-mono text-[9px] text-accent">CURRENT</span>{mapped} mapped repository anchors · {evidence} evidence references</div>;
}

function FutureContextInspector({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const activeId = overlay.activeTraceId || overlay.focusedId;
  const candidate = overlay.candidates.find(item => item.goalId === activeId);
  const dependency = overlay.dependencies.find(item => item.id === activeId);
  if (!candidate && !dependency) return null;
  const evidence = candidate?.evidencePaths || dependency?.evidencePaths || [];
  return (
    <aside data-testid="future-context-inspector" aria-label="Selected Future Pathways inspector" className="absolute bottom-4 right-3 top-[5.5rem] z-20 hidden w-[min(21rem,28vw)] overflow-y-auto rounded-[1.4rem] border border-primary/20 bg-[hsl(var(--universe-surface-raised)/0.94)] p-4 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl lg:block">
      <div className="text-[9px] font-mono uppercase tracking-[0.17em] text-primary">{candidate?.role || 'required dependency'}</div>
      <h3 className="mt-1 text-sm font-semibold">{candidate?.title || dependency?.title}</h3>
      <p className="mt-3 text-xs leading-relaxed text-foreground">{candidate?.rationale || dependency?.rationale}</p>
      {evidence.length > 0 && <div className="mt-4"><div className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Repository evidence</div><ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">{evidence.slice(0, 6).map((item, index) => <li key={`${item}:${index}`} className="break-all">{item}</li>)}</ul></div>}
      {overlay.onTraceClear && <button type="button" onClick={overlay.onTraceClear} className="mt-4 min-h-9 rounded-full border border-border/50 px-3 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</button>}
    </aside>
  );
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
