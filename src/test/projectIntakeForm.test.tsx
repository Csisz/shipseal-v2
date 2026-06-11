import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectIntakeForm } from '@/components/agentready/ProjectIntakeForm';
import { createDefaultProjectIntake } from '@/lib/intake';
import { SAMPLE_PROJECT_INTAKE } from '@/lib/demo/sampleProject';

describe('ProjectIntakeForm', () => {
  it('explains how intake improves ShipSeal outputs', () => {
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={vi.fn()} />);

    expect(screen.getByText(/Repository scan tells ShipSeal what the code looks like/i)).toBeInTheDocument();
    expect(screen.getByText(/Optional, but recommended for client-ready reports/i)).toBeInTheDocument();
    expect(screen.getByText('Client handoff report')).toBeInTheDocument();
    expect(screen.getByText('AI Act readiness pre-screen')).toBeInTheDocument();
    expect(screen.getByText('Transparency notice draft')).toBeInTheDocument();
    expect(screen.getByText('Eval and red-team test context')).toBeInTheDocument();
    expect(screen.getByText('Go/no-go risk notes')).toBeInTheDocument();
    expect(screen.getByText(/Client report quality improves when these fields are completed/i)).toBeInTheDocument();
  });

  it('renders full readable toggle labels with helper text', () => {
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={vi.fn()} />);

    expect(screen.getByText('Used in EU')).toBeInTheDocument();
    expect(screen.getByText('Personal data')).toBeInTheDocument();
    expect(screen.getByText('User-facing content')).toBeInTheDocument();
    expect(screen.getByText('Human approval')).toBeInTheDocument();
    expect(screen.queryByText('Used')).not.toBeInTheDocument();
    expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    expect(screen.queryByText('User-facing')).not.toBeInTheDocument();
    expect(screen.queryByText('Approval')).not.toBeInTheDocument();
    expect(screen.getByText(/people in the EU use/i)).toBeInTheDocument();
    expect(screen.getByText(/data that can identify/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-generated answers/i)).toBeInTheDocument();
    expect(screen.getByText(/review or escalation/i)).toBeInTheDocument();
  });

  it('keeps the toggle cards clickable', () => {
    const onChange = vi.fn();
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={onChange} />);

    fireEvent.click(screen.getByText('Used in EU'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ usedInEU: true }));
  });

  it('loads demo data only when Load demo project is clicked', () => {
    const onChange = vi.fn();
    render(<ProjectIntakeForm value={createDefaultProjectIntake('real-repo')} onChange={onChange} />);

    expect(screen.getByLabelText('Project name')).toHaveValue('real-repo');
    expect(screen.getByLabelText('Project name')).not.toHaveValue(SAMPLE_PROJECT_INTAKE.projectName);

    fireEvent.click(screen.getByRole('button', { name: /load demo project/i }));

    expect(onChange).toHaveBeenCalledWith(SAMPLE_PROJECT_INTAKE);
  });
});
