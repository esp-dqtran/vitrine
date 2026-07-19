import { useEffect, useState } from 'react';
import { Badge, Button, Dialog, Heading, Spinner, Text } from '@astryxdesign/core';
import type { AdminUser, UsageRangeKey, UserFeatureUsage } from '../types.ts';
import { fetchUserFeatureUsage } from '../usersApi.ts';
import { formatJoinedDate, userPlanLabel } from '../usersPageModel.ts';

function actionLabel(action: string) {
  return action.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function UserUsageDialog({ user, range, onClose, loadUsage = fetchUserFeatureUsage }: { user: AdminUser | null; range: UsageRangeKey; onClose: () => void; loadUsage?: typeof fetchUserFeatureUsage }) {
  const [usage, setUsage] = useState<UserFeatureUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    setUsage(null);
    setError(null);
    loadUsage(user.id, range)
      .then((value) => { if (current) setUsage(value); })
      .catch((cause: Error) => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [loadUsage, range, user]);

  return (
    <Dialog isOpen={Boolean(user)} onOpenChange={(open) => { if (!open) onClose(); }} purpose="info" width={420} maxHeight="100vh" position={{ top: 0, right: 0, bottom: 0 }} className="admin-users-detail-dialog">
      {user && (
        <div className="admin-users-detail">
          <div className="admin-users-detail-header">
            <div><Heading level={3}>{user.email}</Heading><Text color="secondary">Joined {formatJoinedDate(user.created_at)}</Text></div>
            <Button label="Close" variant="ghost" size="sm" clickAction={onClose} />
          </div>
          <div className="admin-users-detail-badges">
            <Badge variant={user.role === 'admin' ? 'purple' : 'neutral'} label={user.role === 'admin' ? 'Admin' : 'User'} />
            <Badge variant={userPlanLabel(user) === 'Pro' ? 'success' : 'neutral'} label={userPlanLabel(user)} />
            <Badge variant={user.active ? 'success' : 'neutral'} label={user.active ? 'Active' : 'Disabled'} />
          </div>
          {error ? <p role="alert" className="admin-users-detail-error">{error}</p> : !usage ? <div className="admin-users-detail-loading"><Spinner size="md" /></div> : (
            <>
              <dl className="admin-users-detail-summary">
                <div><dt>Feature uses</dt><dd>{usage.summary.totalEvents}</dd></div>
                <div><dt>Last active</dt><dd>{usage.summary.lastActiveAt ? formatJoinedDate(usage.summary.lastActiveAt) : 'No activity'}</dd></div>
              </dl>
              <section><h4>Feature breakdown</h4><ul className="admin-users-detail-features">{usage.features.map((feature) => <li key={feature.key}><span>{feature.label}</span><strong>{feature.uses}</strong></li>)}</ul></section>
              <section><h4>Recent activity</h4><ol className="admin-users-activity-list">{usage.recentEvents.map((event) => <li key={event.id}><span><strong>{actionLabel(event.action)}</strong><small>{event.featureLabel}{event.appSlug ? ` · ${event.appSlug}` : ''}</small></span><time dateTime={event.createdAt}>{formatJoinedDate(event.createdAt)}</time></li>)}</ol></section>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
