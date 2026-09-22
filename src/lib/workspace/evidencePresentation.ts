export interface PresentableEvidenceReference {
  id: string;
  path?: string;
}

export interface PresentedEvidenceReference {
  label: string;
  path?: string;
}

/**
 * Converts canonical provenance IDs into customer- and agent-safe labels.
 * Canonical IDs remain available for joins and technical diagnostics only.
 */
export function presentEvidenceReferences(
  evidenceIds: readonly string[],
  evidence: readonly PresentableEvidenceReference[],
): PresentedEvidenceReference[] {
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  return [...new Set(evidenceIds)].map((id, index) => {
    const reference = evidenceById.get(id);
    return reference?.path
      ? { label: `Repository path: ${reference.path}`, path: reference.path }
      : { label: `Repository evidence ${index + 1}` };
  });
}

export function renderEvidenceReferenceList(
  evidenceIds: readonly string[],
  evidence: readonly PresentableEvidenceReference[],
) {
  const presented = presentEvidenceReferences(evidenceIds, evidence);
  return presented.length ? presented.map(item => item.label).join(', ') : 'No additional stage-specific evidence.';
}
