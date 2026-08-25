import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Compass,
  KeyRound,
  LayoutPanelTop,
  Network,
  PackageOpen,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import type { RepositoryFutureSemanticIcon as SemanticIcon } from './repositoryFuturesSemantics';

export function RepositoryFutureSemanticIcon({ icon, className = 'size-4' }: { icon: SemanticIcon; className?: string }) {
  const Icon = semanticIconComponent(icon);
  return <Icon className={className} strokeWidth={1.8} aria-hidden="true" />;
}

function semanticIconComponent(icon: SemanticIcon): LucideIcon {
  if (icon === 'repository') return Network;
  if (icon === 'experience') return LayoutPanelTop;
  if (icon === 'ai-agent') return Bot;
  if (icon === 'automation') return Workflow;
  if (icon === 'security') return ShieldCheck;
  if (icon === 'data') return BarChart3;
  if (icon === 'growth') return TrendingUp;
  if (icon === 'knowledge') return BookOpen;
  if (icon === 'delivery') return Rocket;
  if (icon === 'collaboration') return Users;
  if (icon === 'quality') return BadgeCheck;
  if (icon === 'architecture') return Boxes;
  if (icon === 'dependency') return KeyRound;
  if (icon === 'artifact') return PackageOpen;
  return Compass;
}
