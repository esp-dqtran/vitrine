import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import type { CreateResearchProjectInput, ResearchPlatform, ResearchProjectSummary } from '../../researchProject.ts';
import {
  createResearchProject,
  deleteResearchProject,
  duplicateResearchProject,
  listResearchProjects,
} from '../researchProjectsApi.ts';
import { navigate } from '../router.ts';
import { PageHeader } from './PageHeader.tsx';

interface ProjectActions {
  open(projectId: number): void;
  create(input: CreateResearchProjectInput): Promise<void>;
  duplicate(projectId: number): Promise<void>;
  remove(projectId: number): Promise<void>;
}

export function ResearchProjectsView({ projects, loading, error, actions }: {
  projects: ResearchProjectSummary[];
  loading: boolean;
  error: string;
  actions: ProjectActions;
}) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [platformFilter, setPlatformFilter] = useState<ResearchPlatform>('all');
  const [creating, setCreating] = useState(false);
  const submit = async () => {
    if (!title.trim() || !question.trim()) return;
    setCreating(true);
    try {
      await actions.create({ title: title.trim(), question: question.trim(), platformFilter });
      setTitle('');
      setQuestion('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 64px' }}>
      <PageHeader
        title="Research projects"
        description="Turn selected product evidence into a design direction your team can understand and challenge."
      />

      <section style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-background-surface)', margin: '18px 0 28px' }}>
        <strong>Start with a design question</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, .7fr) minmax(260px, 1.5fr) 150px auto', gap: 10 }}>
          <input aria-label="Project title" placeholder="Project title" value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} />
          <input aria-label="Research question" placeholder="What are you trying to decide?" value={question} onChange={(event) => setQuestion(event.target.value)} style={inputStyle} />
          <select aria-label="Platform" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as ResearchPlatform)} style={inputStyle}>
            <option value="all">All platforms</option>
            <option value="web">Web</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
          <Button variant="primary" label="Create project" isDisabled={!title.trim() || !question.trim()} isLoading={creating} clickAction={submit} />
        </div>
      </section>

      {error && <p role="alert" style={{ color: 'var(--color-text-danger)' }}>{error}</p>}
      {loading ? (
        <div style={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState title="No research projects yet" description="Create a project to compare real product evidence and record your decision." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {projects.map((project) => (
            <article key={project.id} style={{ padding: 18, border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-background-surface)', display: 'grid', gap: 12 }}>
              <button type="button" onClick={() => actions.open(project.id)} style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <strong style={{ fontSize: 17 }}>{project.title}</strong>
                <p style={{ margin: '7px 0 0', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>{project.question}</p>
              </button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                <span>{project.platformFilter === 'all' ? 'All platforms' : project.platformFilter}</span>
                <span>·</span>
                <span>{project.evidenceCount} evidence</span>
                <span>·</span>
                <span>{project.synthesisState === 'stale' ? 'Synthesis stale' : project.synthesisState === 'current' ? 'Synthesis current' : 'Not synthesized'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => void actions.duplicate(project.id)} style={smallButton}>Duplicate</button>
                <button type="button" onClick={() => void actions.remove(project.id)} style={smallButton}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export function ResearchProjectsPage() {
  const [projects, setProjects] = useState<ResearchProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setProjects(await listResearchProjects());
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <ResearchProjectsView projects={projects} loading={loading} error={error} actions={{
    open: (projectId) => navigate({ name: 'project', projectId }),
    create: async (input) => { const project = await createResearchProject(input); navigate({ name: 'project', projectId: project.id }); },
    duplicate: async (projectId) => { await duplicateResearchProject(projectId); await refresh(); },
    remove: async (projectId) => { await deleteResearchProject(projectId); await refresh(); },
  }} />;
}

const inputStyle = { border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 11px', color: 'var(--color-text-primary)', background: 'var(--color-background-body)', minWidth: 0 } as const;
const smallButton = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 9px', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' } as const;
