import { EmptyState } from '@astryxdesign/core';
import type { SiteVersionDetail } from '../types.ts';

const TECHNOLOGY_STATES = [
  'observed-in-use',
  'confirmed',
  'loaded',
  'inferred',
  'not-detected',
] as const;

export function SiteAnalysisPanel({ detail }: { detail: SiteVersionDetail }) {
  const analysis = detail.analysis;
  const synthesis = analysis?.synthesis;
  const supportedClaims = synthesis?.claims.filter((claim) =>
    claim.kind === 'unknown' || claim.evidenceIds.length > 0
  ) ?? [];
  const supportedText = new Set(supportedClaims.map((claim) => claim.text));
  const cited = (values: string[] | undefined) =>
    (values ?? []).filter((value) => supportedText.has(value));
  return (
    <section className="site-analysis" aria-labelledby="site-analysis-title">
      <header className="site-analysis__header">
        <div>
          <p>Reverse engineering report</p>
          <h2 id="site-analysis-title">Analysis</h2>
        </div>
        <span>{detail.analysisStatus === 'ready' ? 'AI synthesized' : 'Evidence only'}</span>
      </header>
      {detail.analysisStatus === 'evidence-only' ? (
        <p className="site-analysis__notice">
          Deterministic browser evidence is available. AI synthesis was not configured or could not complete.
        </p>
      ) : null}
      {!analysis ? (
        <EmptyState
          title="No analysis for this capture"
          description="Older captures still retain their preview and sections."
          isCompact
        />
      ) : (
        <>
          {synthesis ? (
            <div className="site-analysis__summary">
              <SummaryValue
                label="Purpose"
                value={supportedText.has(synthesis.purpose) ? synthesis.purpose : 'Unknown'}
              />
              <SummaryValue
                label="Category"
                value={supportedText.has(synthesis.category) ? synthesis.category : 'Unknown'}
              />
              {detail.analysisModel
                ? <SummaryValue label="Model" value={detail.analysisModel} />
                : null}
            </div>
          ) : null}

          <div className="site-analysis__grid">
            <AnalysisList
              title="Structure"
              items={cited(synthesis?.structure).length
                ? cited(synthesis?.structure)
                : analysis.structure.map((item) =>
                  typeof item.label === 'string'
                    ? item.label
                    : typeof item.key === 'string'
                    ? item.key
                    : item.id
                )}
            />
            <AnalysisList
              title="Reconstruction priorities"
              items={cited(synthesis?.reconstructionPriorities)}
            />
            <AnalysisList title="Motion summary" items={cited(synthesis?.motion)} />
            <AnalysisList title="Responsive behavior" items={[
              ...cited(synthesis?.responsive),
              ...analysis.responsive.map((item) =>
                typeof item.change === 'string' && typeof item.key === 'string'
                  ? `${item.key}: ${item.change}`
                  : item.id
              ),
            ]} />
          </div>

          <section className="site-analysis__section">
            <h3>Measured motion</h3>
            {analysis.motion.length ? (
              <div className="site-analysis__cards">
                {analysis.motion.map((motion) => (
                  <article key={motion.id}>
                    <strong>{titleCase(motion.type)}</strong>
                    <dl>
                      <div><dt>Trigger</dt><dd>{titleCase(motion.trigger)}</dd></div>
                      <div><dt>Viewport</dt><dd>{motion.viewports.map(titleCase).join(', ')}</dd></div>
                      <div><dt>Confidence</dt><dd>{Math.round(motion.confidence * 100)}%</dd></div>
                    </dl>
                    {motion.properties.length ? <p>{motion.properties.join(', ')}</p> : null}
                  </article>
                ))}
              </div>
            ) : <p>No measurable motion was retained.</p>}
          </section>

          <section className="site-analysis__section">
            <h3>Frontend technology</h3>
            <div className="site-analysis__technology">
              {TECHNOLOGY_STATES.map((state) => {
                const findings = analysis.technology.filter((item) => item.state === state);
                if (!findings.length) return null;
                return (
                  <div key={state}>
                    <h4>{technologyStateLabel(state)}</h4>
                    <ul>
                      {findings.map((finding) => (
                        <li key={finding.id}>
                          <strong>{finding.name}{finding.version ? ` ${finding.version}` : ''}</strong>
                          <span>{finding.category} · {Math.round(finding.confidence * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {supportedClaims.length ? (
            <section className="site-analysis__section site-analysis__claims">
              <h3>Evidence-backed claims</h3>
              <ul>
                {supportedClaims.map((claim, index) => (
                  <li key={`${claim.kind}:${claim.text}:${index}`}>
                    <strong>{claim.text}</strong>
                    <span>
                      {titleCase(claim.kind)} · {Math.round(claim.confidence * 100)}%
                      {claim.evidenceIds.length
                        ? ` · ${claim.evidenceIds.join(', ')}`
                        : ' · No captured evidence'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {detail.mobilePageUrl ? (
            <section className="site-analysis__section">
              <h3>Mobile render</h3>
              <img
                className="site-analysis__mobile"
                src={detail.mobilePageUrl}
                alt={`${detail.site.name} mobile page capture`}
              />
            </section>
          ) : null}

          {analysis.warnings.length ? (
            <section className="site-analysis__section site-analysis__warnings">
              <h3>Limitations</h3>
              <ul>{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length
        ? <ul>{items.map((item, index) => <li key={`${title}:${index}`}>{item}</li>)}</ul>
        : <p>Not determined.</p>}
    </section>
  );
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function technologyStateLabel(value: typeof TECHNOLOGY_STATES[number]): string {
  return {
    'observed-in-use': 'Observed in use',
    confirmed: 'Confirmed',
    loaded: 'Loaded',
    inferred: 'Inferred',
    'not-detected': 'Not detected',
  }[value];
}
