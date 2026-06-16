import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectIntakeForm } from '@/components/agentready/ProjectIntakeForm';
import { createDefaultProjectIntake } from '@/lib/intake';
import { SAMPLE_PROJECT_INTAKE } from '@/lib/demo/sampleProject';

describe('ProjectIntakeForm', () => {
  it('keeps essential intake fields visible and advanced details collapsed', () => {
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={vi.fn()} />);

    expect(screen.getByText('Tell ShipSeal what this AI app does')).toBeInTheDocument();
    expect(screen.getByText(/Optional, but recommended for client-ready reports/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('demo-repo');
    expect(screen.getByLabelText('Client name')).toBeInTheDocument();
    expect(screen.getByLabelText('Agency name')).toBeInTheDocument();
    expect(screen.getByLabelText('AI provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Model name')).toBeInTheDocument();
    expect(screen.getByLabelText('Target users')).toBeInTheDocument();
    expect(screen.getByLabelText('What does this AI app do?')).toBeInTheDocument();
    expect(screen.getByLabelText('What does the AI generate or decide?')).toBeInTheDocument();
    expect(screen.getByText('Advanced details')).toBeInTheDocument();
  });

  it('renders full readable toggle labels with helper text', () => {
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={vi.fn()} />);

    expect(screen.getByText('Is it intended for EU users?')).toBeInTheDocument();
    expect(screen.getByText('Does it handle personal, sensitive or business-critical data?')).toBeInTheDocument();
    expect(screen.getByText('Does the AI output reach users?')).toBeInTheDocument();
    expect(screen.getByText('Is there human review or approval?')).toBeInTheDocument();
    expect(screen.getByText(/people in the EU use/i)).toBeInTheDocument();
    expect(screen.getByText(/data that can identify/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-generated answers/i)).toBeInTheDocument();
    expect(screen.getByText(/review or escalation/i)).toBeInTheDocument();
  });

  it('keeps the toggle cards clickable', () => {
    const onChange = vi.fn();
    render(<ProjectIntakeForm value={createDefaultProjectIntake('demo-repo')} onChange={onChange} />);

    fireEvent.click(screen.getByText('Is it intended for EU users?'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ usedInEU: true }));
  });

  it('loads demo data only when Load demo project is clicked', () => {
    const onChange = vi.fn();
    render(<ProjectIntakeForm value={createDefaultProjectIntake('real-repo')} onChange={onChange} />);

    expect(screen.getByLabelText('Project name')).toHaveValue('real-repo');
    expect(screen.getByLabelText('Project name')).not.toHaveValue(SAMPLE_PROJECT_INTAKE.projectName);

    fireEvent.click(screen.getByText('Advanced details'));
    fireEvent.click(screen.getByRole('button', { name: /load demo project/i }));

    expect(onChange).toHaveBeenCalledWith(SAMPLE_PROJECT_INTAKE);
  });
});
