import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';
import { PublicPageMetadata } from '@/components/trust/PublicPageMetadata';

const permissions = [
  { permission: 'Metadata · read', why: 'List approved repositories and read repository identity/default-branch metadata.', scan: 'Yes', changes: 'No' },
  { permission: 'Contents · read', why: 'Resolve a commit, discover the tree, and fetch only selected evidence blobs.', scan: 'Yes', changes: 'No' },
  { permission: 'Contents · write', why: 'Create a user-confirmed review branch and write generated files for an explicit Pull Request action.', scan: 'No', changes: 'Yes, only after confirmation' },
  { permission: 'Pull requests · read/write', why: 'Open the confirmed ShipSeal Pull Request and return its URL. ShipSeal does not merge it.', scan: 'No', changes: 'Creates a review PR' },
  { permission: 'Workflows · write (optional)', why: 'Required by GitHub only when a confirmed generated change includes a workflow file under .github/workflows.', scan: 'No', changes: 'Only the confirmed workflow file' },
] as const;

export default function GithubPermissions() {
  return (
    <>
      <PublicPageMetadata title="GitHub permissions" description="Why ShipSeal requests each GitHub App permission and whether it can change repository contents." path="/trust/github" />
      <SecondaryPageShell eyebrow="GitHub permissions" title="Read for scanning. Write only for a confirmed Pull Request." description="The GitHub App installation and the GitHub OAuth account session are separate integrations. Approving sign-in does not by itself grant repository access.">
        <section className="overflow-hidden rounded-2xl border border-border/55 bg-background/25">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-secondary/25 text-foreground"><tr><th className="p-4">Permission</th><th className="p-4">Why it is used</th><th className="p-4">Normal scan?</th><th className="p-4">Can change contents?</th></tr></thead>
              <tbody className="divide-y divide-border/45 text-muted-foreground">{permissions.map(row => <tr key={row.permission}><th scope="row" className="p-4 font-medium text-foreground">{row.permission}</th><td className="p-4 leading-relaxed">{row.why}</td><td className="p-4">{row.scan}</td><td className="p-4">{row.changes}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border/55 bg-secondary/10 p-5 text-sm leading-relaxed text-muted-foreground md:p-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Account sign-in scopes</h2>
          <p className="mt-3">The separate GitHub OAuth account flow requests <code className="text-foreground">read:user</code> and <code className="text-foreground">user:email</code> to identify the account and receive profile/email information GitHub makes available. The short-lived OAuth access token is used during callback and is not stored in ShipSeal's project database.</p>
        </section>

        <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-sm leading-relaxed text-muted-foreground md:p-6">
          <h2 className="font-display text-xl font-semibold text-foreground">What scanning does</h2>
          <p className="mt-3">A connected scan resolves an immutable commit, indexes the tree, excludes generated/binary areas, selects deterministic evidence, and reads those blobs. It does not download the whole repository ZIP, execute code, create a branch, or open a Pull Request.</p>
          <p className="mt-3">A write occurs only from a separate reviewed action that shows the target repository, branch, files, and Pull Request summary. ShipSeal refuses direct writes to <code className="text-foreground">main</code> or <code className="text-foreground">master</code> and does not merge.</p>
        </section>

        <section className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm leading-relaxed text-muted-foreground md:p-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Check the live installation screen</h2>
          <p className="mt-3">GitHub's installation screen is authoritative for the permissions granted to a particular deployment. Compare that screen with this table before approving access. If GitHub lists broader access, do not proceed and contact ShipSeal.</p>
        </section>
      </SecondaryPageShell>
    </>
  );
}
