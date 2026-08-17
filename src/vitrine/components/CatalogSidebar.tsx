import {
  BasketIcon,
  BookIcon,
  BookmarkHollowIcon,
  BoxIcon,
  BrowserIcon,
  CalendarIcon,
  CameraIcon,
  CategoryIcon,
  ChatIcon,
  ChevronSmallDownIcon,
  ChevronSmallRightIcon,
  CogIcon,
  CreditIcon,
  DiamondIcon,
  EmailIcon,
  FolderIcon,
  GlobeIcon,
  GraphBarIcon,
  GridIcon,
  HeartHollowIcon,
  HomeIcon,
  LightningIcon,
  LocationIcon,
  MarkupIcon,
  PaintBrushIcon,
  PhotoIcon,
  ProfileIcon,
  RSSIcon,
  ShieldIcon,
  SparkleIcon,
  SpeakerIcon,
  StarHollowIcon,
  SupportIcon,
  TimeIcon,
  UsersIcon,
  VideoIcon,
  WandIcon,
} from '@storybook/icons';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { visibleCategoryRows, type CategoryRow } from '../categoryFacets.ts';

export type CatalogSidebarSection =
  | 'apps'
  | 'flows'
  | 'sites'
  | 'elements'
  | 'collections'
  | 'projects';

export interface CatalogSidebarEntitlement {
  plan: 'free' | 'pro';
  /* Permanent app unlocks already spent, and the plan's total. */
  used: number;
  total: number;
}

export interface CatalogSidebarProps {
  active: CatalogSidebarSection;
  categories: readonly CategoryRow[];
  selectedCategories: readonly string[];
  categoryLimit?: number;
  showAllCategories: boolean;
  onToggleShowAll: () => void;
  onSelectCategory: (value: string) => void;
  onSelectSection: (section: CatalogSidebarSection) => void;
  onSearch: () => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
  /* Category hover previews already exist on the taxonomy column; the sidebar
     passes the same handlers straight through rather than reimplementing them. */
  categoryHandlers?: (value: string) => {
    onPointerEnter?: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove?: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerLeave?: () => void;
  };
}

/* 75601 reads as noise in a nav row; 75.6K reads as a number someone chose. */
const SECTION_ICONS: Record<CatalogSidebarSection, ReactNode> = {
  apps: <GridIcon aria-hidden="true" />,
  flows: <SparkleIcon aria-hidden="true" />,
  sites: <BookIcon aria-hidden="true" />,
  elements: <CategoryIcon aria-hidden="true" />,
  collections: <BookmarkHollowIcon aria-hidden="true" />,
  projects: <FolderIcon aria-hidden="true" />,
};

const SECTION_LABELS: Record<CatalogSidebarSection, string> = {
  apps: 'Apps',
  flows: 'Flows',
  sites: 'Sites',
  elements: 'UI Elements',
  collections: 'Collections',
  projects: 'Projects',
};

/*
 * `elements` is deliberately absent. The catalog exposes no element facets or
 * per-screen element data to a signed-out visitor, and there is no rebuilt
 * surface behind it yet — a nav row that goes nowhere is worse than one that
 * is not offered. Add it back with the page, not before.
 */
const BROWSE: CatalogSidebarSection[] = ['apps', 'flows', 'sites'];

/* A row without a glyph reads as a different kind of thing to its neighbours,
   so every category carries one. Unmapped values fall back rather than blank. */
const CATEGORY_ICONS: Record<string, ReactNode> = {
  'AI': <SparkleIcon aria-hidden="true" />,
  'Business': <GraphBarIcon aria-hidden="true" />,
  'CRM': <ProfileIcon aria-hidden="true" />,
  'Collaboration': <UsersIcon aria-hidden="true" />,
  'Communication': <ChatIcon aria-hidden="true" />,
  'Crypto & Web3': <DiamondIcon aria-hidden="true" />,
  'Developer Tools': <MarkupIcon aria-hidden="true" />,
  'Education': <BookIcon aria-hidden="true" />,
  'Entertainment': <PlayGlyph />,
  'Finance': <CreditIcon aria-hidden="true" />,
  'Food & Drink': <BasketIcon aria-hidden="true" />,
  'Graphics & Design': <PaintBrushIcon aria-hidden="true" />,
  'Health & Fitness': <HeartHollowIcon aria-hidden="true" />,
  'Jobs & Recruitment': <SupportIcon aria-hidden="true" />,
  'Lifestyle': <HomeIcon aria-hidden="true" />,
  'Maps & Navigation': <LocationIcon aria-hidden="true" />,
  'Medical': <ShieldIcon aria-hidden="true" />,
  'Music & Audio': <SpeakerIcon aria-hidden="true" />,
  'News': <RSSIcon aria-hidden="true" />,
  'Newsletters': <EmailIcon aria-hidden="true" />,
  'Photo & Video': <PhotoIcon aria-hidden="true" />,
  'Productivity': <LightningIcon aria-hidden="true" />,
  'Real Estate': <BoxIcon aria-hidden="true" />,
  'Reference': <BookIcon aria-hidden="true" />,
  'Shopping': <BasketIcon aria-hidden="true" />,
  'Social Networking': <GlobeIcon aria-hidden="true" />,
  'Sports': <TimeIcon aria-hidden="true" />,
  'Travel & Transportation': <CalendarIcon aria-hidden="true" />,
  'Utilities': <CogIcon aria-hidden="true" />,
  'Agents': <WandIcon aria-hidden="true" />,
  'Security': <ShieldIcon aria-hidden="true" />,
  'Writing': <MarkupIcon aria-hidden="true" />,
  'Audio': <SpeakerIcon aria-hidden="true" />,
  'Video': <VideoIcon aria-hidden="true" />,
  'Coding': <MarkupIcon aria-hidden="true" />,
  'Marketing': <GraphBarIcon aria-hidden="true" />,
  'E-Commerce': <BasketIcon aria-hidden="true" />,
  'No-Code': <BrowserIcon aria-hidden="true" />,
  'Design': <PaintBrushIcon aria-hidden="true" />,
};

function PlayGlyph() {
  return <VideoIcon aria-hidden="true" />;
}

const categoryIcon = (value: string): ReactNode =>
  CATEGORY_ICONS[value] ?? <StarHollowIcon aria-hidden="true" />;
const LIBRARY: CatalogSidebarSection[] = ['collections', 'projects'];

/* Each catalog page mounts its own sidebar, so on a section change the old
   row is gone before it can animate out — leaving a hard cut on one side and
   a fade on the other. Remembering the last section outside the component
   survives that remount, so the row being left can animate out alongside the
   one coming in and the highlight reads as moving. */
let previousSection: CatalogSidebarSection | null = null;

function NavRow({
  section,
  active,
  leaving,
  onSelect,
}: {
  section: CatalogSidebarSection;
  active: boolean;
  leaving: boolean;
  onSelect: () => void;
}) {
  const label = SECTION_LABELS[section];
  return (
    <button
      type="button"
      className={`catalog-sidebar__nav${active ? ' is-active' : ''}${
        leaving ? ' is-leaving' : ''}`}
      data-section={section}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      onClick={onSelect}
    >
      <span className="catalog-sidebar__nav-icon">{SECTION_ICONS[section]}</span>
      <span className="catalog-sidebar__nav-label">{label}</span>
    </button>
  );
}

export function CatalogSidebar({
  active,
  categories,
  selectedCategories,
  categoryLimit = 8,
  showAllCategories,
  onToggleShowAll,
  onSelectCategory,
  onSelectSection,
  onSearch,
  entitlement,
  onUpgrade,
  categoryHandlers,
}: CatalogSidebarProps) {
  /* Read once per mount — this is the section we arrived from. */
  const [leaving] = useState(() => (previousSection === active ? null : previousSection));
  useEffect(() => {
    previousSection = active;
  }, [active]);

  /* One line for the whole sidebar rather than a border on each row, so it can
     travel between them. Measured from the rows themselves — the groups are
     separated by headings and margins, so no arithmetic here would stay right. */
  const rootRef = useRef<HTMLElement>(null);
  const [line, setLine] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const box = (section: CatalogSidebarSection | null) => {
      const row = section
        ? root.querySelector<HTMLElement>(`[data-section="${section}"]`)
        : null;
      return row ? { top: row.offsetTop, height: row.offsetHeight } : null;
    };
    const target = box(active);
    if (!target) {
      setLine(null);
      return;
    }
    /* Start on the row we came from so the first painted position is the old
       one; the transition then carries it to the new row. With no previous
       row it lands in place, which is what a fresh load should look like. */
    const from = box(leaving);
    if (!from) {
      setLine(target);
      return;
    }
    setLine(from);
    const frame = requestAnimationFrame(() => setLine(target));
    return () => cancelAnimationFrame(frame);
  }, [active, leaving]);

  const visible = visibleCategoryRows(
    categories,
    selectedCategories,
    categoryLimit,
    showAllCategories,
  );
  const canCollapse = categories.length > categoryLimit;

  return (
    <aside className="catalog-sidebar" aria-label="Catalog navigation" ref={rootRef}>
      {/* Brand lives in the sidebar column, not the header — the reference's
          sidebar runs the full height of the page and starts with the mark. */}
      <a
        className="catalog-sidebar__brand"
        href="/browse"
        aria-label="Vitrines catalog"
        onClick={(event) => {
          event.preventDefault();
          onSelectSection('apps');
        }}
      >
        <img src="/favicon.svg" alt="" aria-hidden="true" />
        <strong>Vitrines</strong>
      </a>

      {/* Opens the existing command palette rather than adding a second search
          surface — the field is the affordance, ⌘K is the shortcut. */}
      <button type="button" className="catalog-sidebar__search" onClick={onSearch}>
        <span className="catalog-sidebar__search-label">Search the catalog</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>

      {line ? (
        <span
          className="catalog-sidebar__indicator"
          aria-hidden="true"
          style={{ transform: `translateY(${line.top}px)`, height: line.height }}
        />
      ) : null}

      <nav className="catalog-sidebar__group" aria-label="Browse">
        {BROWSE.map((section) => (
          <NavRow
            key={section}
            section={section}
            active={active === section}
            leaving={leaving === section}
            onSelect={() => onSelectSection(section)}
          />
        ))}
      </nav>

      <nav className="catalog-sidebar__group" aria-label="Library">
        <p className="catalog-sidebar__heading">Library</p>
        {LIBRARY.map((section) => (
          <NavRow
            key={section}
            section={section}
            active={active === section}
            leaving={leaving === section}
            onSelect={() => onSelectSection(section)}
          />
        ))}
      </nav>

      {/* A heading with nothing under it reads as a broken section. */}
      {categories.length > 0 ? (
      <section className="catalog-sidebar__group" aria-label="Categories">
        <button
          type="button"
          className="catalog-sidebar__heading catalog-sidebar__heading--toggle"
          aria-expanded={showAllCategories}
          onClick={onToggleShowAll}
        >
          <span>Categories</span>
          {showAllCategories
            ? <ChevronSmallDownIcon aria-hidden="true" />
            : <ChevronSmallRightIcon aria-hidden="true" />}
        </button>
        {visible.map(({ value, count }) => {
          const selected = selectedCategories.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`catalog-sidebar__category${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              aria-label={count > 0 ? `${value}, ${count} ${count === 1 ? 'app' : 'apps'}` : value}
              data-has-app-preview="true"
              data-facet-preview="categories"
              onClick={() => onSelectCategory(value)}
              {...(categoryHandlers?.(value) ?? {})}
            >
              <span className="catalog-sidebar__nav-icon">{categoryIcon(value)}</span>
              <span className="catalog-sidebar__category-label">{value}</span>
              {count > 0 ? (
                <span className="catalog-sidebar__category-count" aria-hidden="true">{count}</span>
              ) : null}
            </button>
          );
        })}
        {canCollapse ? (
          <button
            type="button"
            className="catalog-sidebar__more"
            aria-expanded={showAllCategories}
            onClick={onToggleShowAll}
          >
            {showAllCategories ? 'Show less' : `Show all ${categories.length}`}
          </button>
        ) : null}
      </section>
      ) : null}

      {/* Free plan only. Pro has nothing left to meter, and a guest has no
          unlocks to spend yet — both would read as a nag. */}
      {entitlement?.plan === 'free' ? (
        <div className="catalog-sidebar__footer">
          <p className="catalog-sidebar__unlocks">
            {entitlement.total - entitlement.used} of {entitlement.total} unlocks left
          </p>
          <div
            className="catalog-sidebar__pips"
            role="img"
            aria-label={`${entitlement.used} of ${entitlement.total} app unlocks used`}
          >
            {Array.from({ length: entitlement.total }, (_, index) => (
              <span
                key={index}
                className={index < entitlement.used ? 'is-used' : undefined}
              />
            ))}
          </div>
          {onUpgrade ? (
            <button type="button" className="catalog-sidebar__upgrade" onClick={onUpgrade}>
              Go Pro
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

