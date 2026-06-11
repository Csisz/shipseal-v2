import { useState } from 'react';
import { Archive, Copy, Download, Check, FileText, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentPackFile, MCPPolicyFile } from '@/lib/types';
import type { PartialProjectIntake } from '@/lib/intake';
import { cn } from '@/lib/utils';
import { downloadAgentPackZip, downloadTextFile } from '@/lib/exports';

interface Props {
  files: AgentPackFile[];
  repositoryName?: string;
  mcpFiles?: MCPPolicyFile[];
  contextFiles?: { markdown: string; json: unknown };
  scoreJson?: unknown;
  intake?: PartialProjectIntake;
  zipLabel?: string;
}

export function AgentPackTabs({ files, repositoryName, mcpFiles = [], contextFiles, scoreJson, intake, zipLabel = 'Download ShipSeal Delivery Pack' }: Props) {
  const [active, setActive] = useState(0);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const file = files[active];
  const copied = copiedName === file.name;

  const copy = async () => {
    await navigator.clipboard.writeText(file.content);
    setCopiedName(file.name);
    setTimeout(() => setCopiedName(null), 1500);
  };

  const download = (f: AgentPackFile) => {
    downloadTextFile(f.name, f.content);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 border-b border-border/60 bg-secondary/30">
        {files.map((f, i) => {
          const Icon = f.language === 'yaml' ? FileCode : FileText;
          return (
            <button
              key={f.name}
              onClick={() => setActive(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5 transition-all',
                active === i
                  ? 'bg-primary/20 text-foreground border border-primary/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-3 border-b border-border/60">
        <div className="text-sm text-muted-foreground min-w-0 break-words">{file.description}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {repositoryName && (
            <Button variant="outline" size="sm" onClick={() => downloadAgentPackZip(repositoryName, files, mcpFiles, contextFiles, scoreJson, intake)} className="border-border/60">
              <Archive className="h-3.5 w-3.5 mr-1.5" /> {zipLabel}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => download(file)}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
          </Button>
        </div>
      </div>
      <pre className="p-5 text-xs font-mono leading-relaxed overflow-auto max-h-[520px] bg-[hsl(240_20%_4%)] text-foreground/90">
        <code>{file.content}</code>
      </pre>
    </div>
  );
}
