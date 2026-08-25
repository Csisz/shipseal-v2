import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Bot,
  BrainCircuit,
  Code2,
  FileQuestion,
  FileText,
  Folder,
  GitBranch,
  Image as ImageIcon,
  Lightbulb,
  Network,
  Package,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { repositoryUniverseSemanticStyle } from '@/lib/workspace/repositoryUniverseSemantics';
import type { RepositoryUniverseNode } from '@/lib/workspace';

export function RepositoryUniverseSemanticBadge({ node }: { node: RepositoryUniverseNode }) {
  const semantic = repositoryUniverseSemanticStyle(node);
  const Icon = semanticIconComponent(semantic.semanticType);
  return (
    <Badge variant="outline" className="gap-1.5 border-primary/35 bg-background/25 text-foreground">
      <Icon width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
      {semantic.shortLabel}
    </Badge>
  );
}

function semanticIconComponent(type: ReturnType<typeof repositoryUniverseSemanticStyle>['semanticType']): LucideIcon {
  if (type === 'repository') return Network;
  if (type === 'folder') return Folder;
  if (type === 'source') return Code2;
  if (type === 'documentation') return FileText;
  if (type === 'test') return BadgeCheck;
  if (type === 'configuration') return SlidersHorizontal;
  if (type === 'workflow') return GitBranch;
  if (type === 'agent-instruction') return Bot;
  if (type === 'generated') return Package;
  if (type === 'asset') return ImageIcon;
  if (type === 'concept') return BrainCircuit;
  if (type === 'recommendation') return Lightbulb;
  if (type === 'missing') return TriangleAlert;
  return FileQuestion;
}
