import type React from 'react';
import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface FounderAuditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  company: string;
  email: string;
  phoneOrOtherContact: string;
  projectUrl: string;
  message: string;
  consent: boolean;
  website: string;
}

type FormErrors = Partial<Record<keyof FormState | 'submit', string>>;

const INITIAL_FORM: FormState = {
  name: '',
  company: '',
  email: '',
  phoneOrOtherContact: '',
  projectUrl: '',
  message: '',
  consent: false,
  website: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FounderAuditRequestDialog({ open, onOpenChange }: FounderAuditRequestDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined, submit: undefined }));
    setStatusMessage('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setStatusMessage('');

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/audit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source: 'shipseal-founder-reviewed-audit',
        }),
      });
      const payload = await readJson(response);

      if (response.status === 503) {
        setErrors({ submit: 'Audit request sending is not configured in this demo environment.' });
        return;
      }
      if (!response.ok) {
        setErrors({ submit: payload?.error || 'Audit request could not be sent. Please check the form and try again.' });
        return;
      }

      setStatusMessage('Audit request sent. We will review whether ShipSeal is a good fit for your AI project handoff.');
      setForm(INITIAL_FORM);
    } catch {
      setErrors({ submit: 'Audit request sending is not configured in this demo environment.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Request founder-reviewed audit</DialogTitle>
          <DialogDescription>
            Send your contact details and a short project note. We will review whether ShipSeal is a good fit for your AI project handoff.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input aria-label="Name" value={form.name} onChange={event => update('name', event.target.value)} autoComplete="name" />
            </Field>
            <Field label="Company / agency">
              <Input aria-label="Company / agency" value={form.company} onChange={event => update('company', event.target.value)} autoComplete="organization" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input aria-label="Email" value={form.email} onChange={event => update('email', event.target.value)} autoComplete="email" />
            </Field>
            <Field label="Phone or other contact" error={errors.phoneOrOtherContact}>
              <Input aria-label="Phone or other contact" value={form.phoneOrOtherContact} onChange={event => update('phoneOrOtherContact', event.target.value)} />
            </Field>
            <Field label="Project / repository URL" className="sm:col-span-2">
              <Input aria-label="Project / repository URL" value={form.projectUrl} onChange={event => update('projectUrl', event.target.value)} placeholder="https://github.com/owner/repo" />
            </Field>
            <Field label="Message" className="sm:col-span-2" error={errors.message}>
              <Textarea
                aria-label="Message"
                value={form.message}
                onChange={event => update('message', event.target.value)}
                placeholder="Tell us what the AI project does and what kind of client handoff or review you need."
                rows={5}
              />
            </Field>
          </div>

          <label className="hidden">
            Website
            <Input value={form.website} onChange={event => update('website', event.target.value)} tabIndex={-1} autoComplete="off" />
          </label>

          <div className="rounded-xl border border-border/60 bg-secondary/25 p-4">
            <label className="flex items-start gap-3 text-sm text-foreground/90">
              <Checkbox
                checked={form.consent}
                onCheckedChange={checked => update('consent', checked === true)}
                aria-label="I agree to be contacted about my ShipSeal audit request."
              />
              <span>I agree to be contacted about my ShipSeal audit request.</span>
            </label>
            {errors.consent && <div className="mt-2 text-xs text-destructive">{errors.consent}</div>}
            <p className="mt-3 text-xs text-muted-foreground">
              ShipSeal will use your contact details only to respond to this audit request.
            </p>
          </div>

          {errors.submit && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errors.submit}
            </div>
          )}
          {statusMessage && (
            <div role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              {statusMessage}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Email or phone/other contact is required.
            </div>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
              <Send className="h-4 w-4 mr-1.5" />
              {isSubmitting ? 'Sending...' : 'Send audit request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className = '',
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const hasEmail = Boolean(form.email.trim());
  const hasOtherContact = Boolean(form.phoneOrOtherContact.trim());

  if (!hasEmail && !hasOtherContact) {
    errors.email = 'Enter an email or another contact method.';
    errors.phoneOrOtherContact = 'Enter an email or another contact method.';
  }
  if (hasEmail && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.message.trim()) {
    errors.message = 'Add a short project summary or message.';
  }
  if (!form.consent) {
    errors.consent = 'Consent is required before sending.';
  }

  return errors;
}

async function readJson(response: Response): Promise<{ error?: string } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
