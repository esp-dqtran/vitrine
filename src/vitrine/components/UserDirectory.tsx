import { useEffect, useRef, useState } from 'react';
import { AlertDialog, Badge, Button, ClickableCard, DropdownMenu, Icon, Selector, Spinner, TextInput } from '@astryxdesign/core';
import type { AdminUser, UserFilter } from '../types.ts';
import { formatJoinedDate, USER_FILTER_LABELS, userInitial, userPlanLabel } from '../usersPageModel.ts';

interface UserDirectoryProps {
  users: AdminUser[];
  total: number;
  query: string;
  filter: UserFilter;
  hasMore: boolean;
  loadingMore: boolean;
  refreshing?: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: UserFilter) => void;
  onLoadMore: () => void;
  onSetActive: (user: AdminUser, active: boolean) => Promise<void>;
  onSelectUser: (user: AdminUser) => void;
}

function MemberRow({ user, onSetActive, onSelectUser }: Pick<UserDirectoryProps, 'onSetActive' | 'onSelectUser'> & { user: AdminUser }) {
  const [pendingDisable, setPendingDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = userPlanLabel(user);

  const update = async (active: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onSetActive(user, active);
      setPendingDisable(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="admin-users-member-row">
      <ClickableCard className="admin-users-member-identity" label={`${user.email} Joined ${formatJoinedDate(user.created_at)}`} padding={0} onClick={() => onSelectUser(user)} style={{ border: 0, background: 'transparent' }}>
        <span className="admin-users-avatar" data-tone={user.id % 5} aria-hidden="true">{userInitial(user.email)}</span>
        <span className="admin-users-member-copy">
          <strong>{user.email}</strong>
          <span>Joined {formatJoinedDate(user.created_at)}</span>
        </span>
      </ClickableCard>

      <div className="admin-users-member-badges" aria-label={`Role ${user.role}, plan ${plan}`}>
        <Badge variant={user.role === 'admin' ? 'purple' : 'neutral'} label={user.role === 'admin' ? 'Admin' : 'User'} />
        <Badge variant={plan === 'Pro' ? 'success' : 'neutral'} label={plan} />
      </div>

      <span className={`admin-users-status${user.active ? '' : ' is-disabled'}`}>
        <span aria-hidden="true" />{user.active ? 'Active' : 'Disabled'}
      </span>

      <DropdownMenu
        button={{ label: 'Actions', size: 'sm', variant: 'ghost', isDisabled: busy }}
        menuWidth={150}
        items={[{
          label: user.active ? 'Disable' : 'Enable',
          onClick: () => user.active ? setPendingDisable(true) : void update(true),
        }]}
      />

      {error && <p className="admin-users-row-error" role="alert">{error}</p>}
      <AlertDialog
        isOpen={pendingDisable}
        onOpenChange={setPendingDisable}
        title="Disable this account?"
        description={`${user.email} will be signed out and will not be able to sign in until re-enabled.`}
        actionLabel="Disable account"
        isActionLoading={busy}
        onAction={() => void update(false)}
      />
    </li>
  );
}

export function UserDirectory(props: UserDirectoryProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const hasFilters = Boolean(props.query.trim()) || props.filter !== 'all';

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !props.hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !props.loadingMore) props.onLoadMore();
    }, { rootMargin: '240px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.hasMore, props.loadingMore, props.onLoadMore]);

  return (
    <section className="admin-users-directory" aria-labelledby="admin-users-directory-title">
      <div className="admin-users-directory-heading">
        <div>
          <h2 id="admin-users-directory-title">Members</h2>
          <p aria-live="polite">
            {props.users.length} of {props.total} shown
            {props.refreshing && <span className="admin-users-refreshing"> · Updating…</span>}
          </p>
        </div>
      </div>

      <div className="admin-users-toolbar">
        <div className="admin-users-search-control">
          <TextInput label="Search members" isLabelHidden value={props.query} onChange={props.onQueryChange} placeholder="Search by email…" startIcon={<Icon icon="search" size="sm" />} hasClear={Boolean(props.query)} width="100%" />
        </div>
        <div className="admin-users-filter-control">
          <Selector label="Filter members" isLabelHidden value={props.filter} onChange={(value) => props.onFilterChange(value as UserFilter)} options={Object.entries(USER_FILTER_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
      </div>

      {props.users.length === 0 ? (
        <div className="admin-users-empty">
          <h3>{hasFilters ? 'No members match these filters' : 'No members yet'}</h3>
          <p>{hasFilters ? 'Try another email or reset the current segment.' : 'New accounts will appear here when they join.'}</p>
          {hasFilters && <Button label="Clear filters" size="sm" clickAction={() => { props.onQueryChange(''); props.onFilterChange('all'); }} />}
        </div>
      ) : (
        <>
          <ul className="admin-users-list">
            {props.users.map((user) => <MemberRow key={user.id} user={user} onSetActive={props.onSetActive} onSelectUser={props.onSelectUser} />)}
          </ul>
          <div ref={sentinel} className="admin-users-load-more">
            {props.hasMore && <Button label="Load more" size="sm" variant="ghost" isLoading={props.loadingMore} clickAction={props.onLoadMore} />}
            {props.loadingMore && <Spinner size="sm" />}
          </div>
        </>
      )}
    </section>
  );
}
