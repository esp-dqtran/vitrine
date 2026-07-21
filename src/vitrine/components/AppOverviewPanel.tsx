import { Badge, Card, Heading, Text } from '@astryxdesign/core';
import type { AppMetadata } from '../types';
import { PLATFORM_LABEL } from '../../platformFromUrl';

export function AppOverviewPanel({ app }: { app: AppMetadata }) {
  const stats = [
    ['Screens', app.totalScreens],
    ['UI Elements', app.totalUiElements],
    ['Flows', app.totalFlows],
  ] as const;
  return (
    <div style={{ display: 'grid', gap: 18, paddingTop: 28 }}>
      <div>
        <Heading level={2}>App overview</Heading>
        <div style={{ marginTop: 7 }}><Text type="body" color="secondary">{app.description || 'Catalog metadata is available immediately. Open a section to load its captured data.'}</Text></div>
        {app.websiteUrl && <div style={{ marginTop: 8 }}><a href={app.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-accent)', fontSize: 14 }}>Open website</a></div>}
      </div>
      {app.previewVideoUrl && (
        <Card padding={2}>
          <video
            src={app.previewVideoUrl}
            aria-label={`${app.app} continuous scrolling preview`}
            autoPlay
            loop
            muted
            playsInline
            controls
            style={{ display: 'block', width: '100%', maxHeight: 560, objectFit: 'contain', background: '#0a0a0a', borderRadius: 8 }}
          />
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {stats.map(([label, value]) => <Card key={label} padding={4}><Text type="supporting" color="secondary">{label}</Text><div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>{value}</div></Card>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={app.cat} variant="neutral" />
        {(app.platforms ?? []).map((platform) => <Badge key={platform} label={PLATFORM_LABEL[platform]} variant="neutral" />)}
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {app.analyzedScreens !== undefined && <Text type="supporting" color="secondary">{app.analyzedScreens} analyzed</Text>}
        {app.lastCapturedAt && <Text type="supporting" color="secondary">Last captured {new Date(app.lastCapturedAt).toLocaleDateString()}</Text>}
      </div>
    </div>
  );
}
