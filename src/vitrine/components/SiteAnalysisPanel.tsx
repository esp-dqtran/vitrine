import { useState } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { SiteTechnologyFinding } from '../../siteAnalysis.ts';
import type { SiteVersionDetail } from '../types.ts';

const ICON_BASE_URL = 'https://www.wappalyzer.com/images/icons/';

export function SiteAnalysisPanel({ detail }: { detail: SiteVersionDetail }) {
  const detected = (detail.analysis?.technology ?? [])
    .filter((finding) => finding.state !== 'not-detected')
    .sort((left, right) =>
      right.confidence - left.confidence || left.name.localeCompare(right.name)
    );
  const groups = groupTechnology(detected);
  const hasWappalyzer = detected.some((finding) =>
    finding.source === 'wappalyzer'
  );

  return (
    <section className="site-technology" aria-labelledby="site-technology-title">
      <header className="site-technology__header">
        <div>
          <p>Detected technology</p>
          <h2 id="site-technology-title">Technology</h2>
          <span>Frameworks, libraries, services, and platforms used by this page.</span>
        </div>
        <strong>{detected.length} detected</strong>
      </header>

      {detected.length && !hasWappalyzer ? (
        <p className="site-technology__notice">
          Extended technology detection was unavailable. Showing browser-evidence results.
        </p>
      ) : null}

      {!detected.length ? (
        <EmptyState
          title="No technologies detected"
          description="Import this page again with Wappalyzer enabled to build its technology profile."
          isCompact
        />
      ) : (
        <div className="site-technology__groups">
          {groups.map(([category, findings]) => (
            <section className="site-technology__group" key={category}>
              <div className="site-technology__group-heading">
                <h3>{category}</h3>
                <span>{findings.length}</span>
              </div>
              <div className="site-technology__grid">
                {findings.map((finding) => (
                  <TechnologyCard finding={finding} key={finding.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function TechnologyCard({ finding }: { finding: SiteTechnologyFinding }) {
  return (
    <article className="site-technology__card">
      <TechnologyIcon icon={finding.icon} />
      <div className="site-technology__card-copy">
        <strong>
          {finding.name}
          {finding.version ? <small>{finding.version}</small> : null}
        </strong>
        <span>
          {technologyStateLabel(finding.state)}
          {' · '}
          {Math.round(finding.confidence * 100)}%
        </span>
      </div>
    </article>
  );
}

function TechnologyIcon({ icon }: { icon: string | undefined }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? undefined : wappalyzerIconUrl(icon);
  return url ? (
    <img
      className="site-technology__icon"
      src={url}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="site-technology__icon-fallback" aria-hidden="true">
      &lt;/&gt;
    </span>
  );
}

export function wappalyzerIconUrl(icon: string | undefined): string | undefined {
  if (
    !icon ||
    icon.length > 200 ||
    icon.includes('..') ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+@'-]*\.(?:svg|png|webp)$/i.test(icon)
  ) {
    return undefined;
  }
  return `${ICON_BASE_URL}${encodeURIComponent(icon)}`;
}

function groupTechnology(
  findings: SiteTechnologyFinding[],
): Array<[string, SiteTechnologyFinding[]]> {
  const groups = new Map<string, SiteTechnologyFinding[]>();
  for (const finding of findings) {
    const category = finding.categories?.[0]
      ?? categoryLabel(finding.category);
    groups.set(category, [...(groups.get(category) ?? []), finding]);
  }
  return [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
}

function categoryLabel(category: SiteTechnologyFinding['category']): string {
  return {
    framework: 'Frameworks',
    renderer: 'Rendering',
    bundler: 'Build tools',
    animation: 'Animation',
    media: 'Media',
    service: 'Services',
  }[category];
}

function technologyStateLabel(
  state: SiteTechnologyFinding['state'],
): string {
  return {
    confirmed: 'Confirmed',
    'observed-in-use': 'Observed in use',
    loaded: 'Loaded',
    inferred: 'Inferred',
    'not-detected': 'Not detected',
  }[state];
}
