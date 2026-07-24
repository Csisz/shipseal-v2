import type { MCPRiskSeverity, ReadinessReport } from '@/lib/types';

export function displayEvidenceSource(sourceType: ReadinessReport['scanEvidence']['sourceType']) {
  if (sourceType === 'github-app') return 'GitHub App';
  if (sourceType === 'public-github') return 'Public GitHub';
  return 'ZIP upload';
}

export function severityClass(severity: MCPRiskSeverity) {
  if (severity === 'Critical') return 'ml-auto border-destructive/60 text-destructive text-[10px]';
  if (severity === 'High') return 'ml-auto border-warning/70 text-warning text-[10px]';
  if (severity === 'Medium') return 'ml-auto border-accent/60 text-accent text-[10px]';
  return 'ml-auto border-success/60 text-success text-[10px]';
}

export function displayMcpReadiness(status?: string) {
  if (!status) return 'Not detected';
  if (/Enterprise MCP Ready/i.test(status)) return 'MCP Governance Ready';
  if (/MCP Ready/i.test(status)) return 'Strong MCP readiness signal';
  return status;
}

export function mcpGovernanceSummary(report: ReadinessReport) {
  const base = report.mcpReadiness.aiNarrative?.mcpSummary || report.mcpReadiness.summary;
  return `${base} MCP readiness is separate from the main ShipSeal score; it does not mean production-ready status, and high-risk MCP tool categories require human approval.`;
}

export function isGitHubSource(sourceType?: string) {
  return sourceType === 'github-app' || sourceType === 'github-url' || sourceType === 'github-public';
}
