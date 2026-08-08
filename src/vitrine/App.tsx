import { Spinner } from './components/Spinner.tsx';
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { apiFetch } from './apiFetch.ts';
import { AnimatePresence } from "framer-motion";
import { Button, EmptyState } from "@astryxdesign/core";
import { useAuth } from "./AuthProvider";
import { ProgressBanner } from "./components/ProgressBanner";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { UnlockModal } from "./components/UnlockModal";
import { AdvancedSearchPreview } from "./components/AdvancedSearchPreview.tsx";
import { QuickSearch, quickSearchHandoff } from "./components/QuickSearch.tsx";
import { GuestCatalogControls } from "./components/GuestCatalogControls.tsx";
import { LoginDialog } from "./components/LoginDialog.tsx";
import { AppDetailLoadingPage } from "./components/AppDetailLoadingPage.tsx";
import {
  PublicAppPreviewModal,
  PublicAppPreviewPage,
} from "./components/PublicAppPreviewPage.tsx";
import { ApplicationSurface } from "./components/ApplicationSurface.tsx";
import { WorkspaceChromeProvider } from "./components/WorkspaceChromeContext.tsx";
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
} from "./components/AstryxDropdown.tsx";
import { AppsDiscoveryPage } from "./components/AppsDiscoveryPage.tsx";
import { FlowsPage } from "./components/FlowsPage.tsx";
import { ApplicationHeader } from "./components/ApplicationHeader.tsx";
import { SearchTrigger } from "./components/SearchTrigger.tsx";
import { ScreenDetail } from "./components/ScreenDetail";
import { SitesPage } from "./components/SitesPage.tsx";
import { SiteVersionPage } from "./components/SiteVersionPage";
import type { AppsFacet, AppsPlatform } from "./appsDiscovery.ts";
import { createAppsDiscoveryAdapter } from "./appsDiscoveryAdapter.ts";
import {
  createFlowsDiscoveryAdapter,
  selectedFlowDiscoverySearch,
} from "./flowsDiscoveryAdapter.ts";
import { createSitesDiscoveryAdapter } from "./sitesDiscoveryAdapter.ts";
import type { DiscoveryFilter } from "./discoveryTypes.ts";
import { useApps } from "./useApps";
import { useAppDetail } from "./useAppDetail";
import { usePublicAppPreview } from "./usePublicAppPreview.ts";
import { useCollections } from "./useCollections";
import {
  searchCatalog,
  type SearchFilters as LegacySearchFilters,
} from "./researchApi";
import { navigate, updateLocation, useRoute } from "./router";
import { loadSubscription, type SubscriptionView } from "./billingApi";
import type { CatalogSearchResult } from "../catalogResearch";
import type { SearchResultItem } from "../searchTypes.ts";
import type {
  SearchFilters as AdvancedSearchFilters,
  SearchScope,
} from "../searchTypes.ts";
import { defaultSearchState, readRecentSearches } from "./searchState.ts";
import { createSearchSession } from "./searchSession.ts";
import { activeFilterCount } from "../searchScope.ts";
import { trackAppFunnelEvent } from "./publicAppPreviewApi.ts";

const ProjectsPage = lazy(() =>
  import("./components/ProjectsPage").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const CollectionsWorkspacePage = lazy(() =>
  import("./components/CollectionsWorkspacePage.tsx").then((module) => ({
    default: module.CollectionsWorkspacePage,
  })),
);
const SettingsWorkspacePage = lazy(() =>
  import("./components/SettingsWorkspacePage").then((module) => ({
    default: module.SettingsWorkspacePage,
  })),
);
const ProjectPlayground = lazy(() =>
  import("./components/ProjectPlaygroundPage").then((module) => ({
    default: module.ProjectPlayground,
  })),
);
const ProjectDocumentPage = lazy(() =>
  import("./components/ProjectDocumentPage").then((module) => ({
    default: module.ProjectDocumentPage,
  })),
);
const ProjectFilesPage = lazy(() =>
  import("./components/ProjectFilesPage").then((module) => ({
    default: module.ProjectFilesPage,
  })),
);
const AdvancedSearchPage = lazy(() =>
  import("./components/AdvancedSearchPage.tsx").then((module) => ({
    default: module.AdvancedSearchPage,
  })),
);

export function App() {
  const { user, authenticate, register, completeLogin, logout } = useAuth();
  const isGuest = user === null;
  const route = useRoute();
  const stickyChromeEnabled =
    route.name === "apps" || route.name === "sites" || route.name === "flows";
  const [stickyChromeMerged, setStickyChromeMerged] = useState(false);
  const [flowsDiscoveryAdapter] = useState(() => createFlowsDiscoveryAdapter());
  const flowDiscoveryState =
    route.name === "flows"
      ? flowsDiscoveryAdapter.parse(
          typeof window === "undefined" ? "" : window.location.search,
        )
      : null;
  const isAdmin = user?.role === "admin";
  const [loginOpen, setLoginOpen] = useState(false);
  const [appFacet, setAppFacet] = useState<AppsFacet | null>(null);
  const [appPlatform, setAppPlatform] = useState<AppsPlatform>("web");
  const [siteQuery, setSiteQuery] = useState("");
  // Seed the search from a query handed off by the marketing landing (Home) across sign-in.
  const [q, setQ] = useState(() => {
    const seed =
      sessionStorage.getItem("astryx:q") ?? sessionStorage.getItem("vitrine:q");
    if (seed) {
      sessionStorage.removeItem("astryx:q");
      sessionStorage.removeItem("vitrine:q");
    }
    return seed ?? "";
  });
  const [filters, setFilters] = useState<LegacySearchFilters>({ kind: "all" });
  const [searchResult, setSearchResult] = useState<CatalogSearchResult | null>(
    null,
  );
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const {
    collections,
    loaded: collectionsLoaded,
    ensureCollections,
    setCollections,
  } = useCollections();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchSession] = useState(() =>
    createSearchSession({
      ...defaultSearchState,
      query: q,
    }),
  );

  useEffect(() => {
    if (!stickyChromeEnabled) {
      setStickyChromeMerged(false);
      return;
    }

    let frame = 0;
    const updateStickyChrome = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const toolbar = document.querySelector<HTMLElement>(".apps-filterbar");
        const header = document.querySelector<HTMLElement>(
          ".reference-discovery-nav.apps-top-nav",
        );

        if (!toolbar || !header) return;

        const toolbarTop = toolbar.getBoundingClientRect().top;
        const headerBottom = header.getBoundingClientRect().bottom;
        setStickyChromeMerged(
          window.scrollY > 0 && toolbarTop <= headerBottom + 1,
        );
      });
    };

    updateStickyChrome();
    window.addEventListener("scroll", updateStickyChrome, { passive: true });
    window.addEventListener("resize", updateStickyChrome);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateStickyChrome);
      window.removeEventListener("resize", updateStickyChrome);
    };
  }, [stickyChromeEnabled]);
  const searchSnapshot = useSyncExternalStore(
    searchSession.subscribe,
    searchSession.snapshot,
    searchSession.snapshot,
  );
  const [advancedPreview, setAdvancedPreview] =
    useState<SearchResultItem | null>(null);
  const [comparison, setComparison] = useState<SearchResultItem[]>([]);
  const [entitlements, setEntitlements] = useState<SubscriptionView | null>(
    null,
  );
  const [entitlementsResolved, setEntitlementsResolved] = useState(isAdmin);
  const [entitlementsError, setEntitlementsError] = useState("");
  const [entitlementsRevision, setEntitlementsRevision] = useState(0);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);
  const researchProjectsEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_RESEARCH_PROJECTS_ENABLED === "true";
  const advancedSearchEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_ADVANCED_SEARCH_ENABLED === "true";
  const customerPlan: "free" | "pro" = isAdmin
    ? "pro"
    : (entitlements?.plan ?? "free");
  const canUseProResearch = isAdmin || customerPlan === "pro";
  const canUseAdvancedSearch = advancedSearchEnabled && user !== null;
  const openPricing = () => navigate({ name: "pricing" });
  const paletteCollections = isGuest ? [] : collections;
  const palettePlan = isGuest ? "free" : customerPlan;
  const paletteUpgrade = isGuest ? () => setLoginOpen(true) : openPricing;
  const closeSettings = () => {
    setSettingsOpen(false);
    if (route.name === "settings-billing") navigate({ name: "apps" });
  };

  const isFreeGated = (appId: string) =>
    user?.role !== "admin" &&
    entitlements?.plan === "free" &&
    !entitlements.freeUnlocks.includes(appId);
  const detailGateLoading = route.name === "app" && !entitlementsResolved;
  const detailLocked = route.name === "app" && isFreeGated(route.appId);
  const detailPreview =
    route.name === "app" && entitlementsResolved && (isGuest || detailLocked);
  // Debounce the palette's search text before it hits the catalog endpoint,
  // matching the pacing already used for the pro adaptive-search request below.
  const [debouncedLegacyQuery, setDebouncedLegacyQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLegacyQuery(q), 180);
    return () => window.clearTimeout(timer);
  }, [q]);
  // The Apps page owns its catalog request through the discovery controller.
  // Keep this legacy list lazy and isolated to the legacy command palette.
  const { apps } = useApps(
    user?.role,
    searchSnapshot.open && (!canUseAdvancedSearch || route.name === "flows"),
    debouncedLegacyQuery,
  );
  const {
    detail,
    loading: detailLoading,
    error: detailError,
  } = useAppDetail(
    route.name === "app" ? route.appId : undefined,
    route.name === "app" &&
      !detailGateLoading &&
      !entitlementsError &&
      !detailPreview,
  );
  const {
    preview: publicPreview,
    loading: publicPreviewLoading,
    error: publicPreviewError,
  } = usePublicAppPreview(
    route.name === "app" ? route.appId : undefined,
    detailPreview,
  );
  const {
    preview: modalPublicPreview,
    loading: modalPublicPreviewLoading,
    error: modalPublicPreviewError,
  } = usePublicAppPreview(previewTarget ?? undefined, previewTarget !== null);

  useEffect(() => {
    if (user?.role !== "user") {
      setEntitlements(null);
      setEntitlementsResolved(true);
      setEntitlementsError("");
      return;
    }
    setEntitlementsResolved(false);
    setEntitlementsError("");
    void loadSubscription()
      .then(setEntitlements)
      .catch((reason: Error) => {
        setEntitlements(null);
        setEntitlementsError(reason.message);
      })
      .finally(() => setEntitlementsResolved(true));
  }, [entitlementsRevision, user?.id, user?.role]);

  const retryEntitlements = () => setEntitlementsRevision((value) => value + 1);

  const openPalette = (
    scope: SearchScope,
    seed: Partial<AdvancedSearchFilters> = {},
  ) => {
    searchSession.open(scope, seed);
    if (user) void ensureCollections().catch(() => []);
  };

  const closeDiscoveryOverlays = () => {
    setSettingsOpen(false);
    setLoginOpen(false);
    setAdvancedPreview(null);
    setPreviewTarget(null);
    searchSession.close();
  };

  useEffect(() => {
    if (advancedSearchEnabled) {
      setSearchResult(null);
      setSearchError("");
      setSearchLoading(false);
      return;
    }
    if (!canUseProResearch) {
      setSearchResult(null);
      setSearchError("");
      setSearchLoading(false);
      return;
    }
    if (!q.trim()) {
      setSearchResult(null);
      setSearchError("");
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      searchCatalog(q, filters, controller.signal)
        .then((result) => {
          setSearchResult(result);
          setSearchError("");
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") setSearchError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [advancedSearchEnabled, canUseProResearch, q, filters, searchRetry]);

  const openApp = async (appId: string) => {
    closeDiscoveryOverlays();
    if (isGuest || isFreeGated(appId)) {
      setPreviewTarget(appId);
      setUnlockTarget(null);
      return;
    }
    navigate({ name: "app", appId });
    setUnlockTarget(null);
  };

  const requestFullAppAnalysis = (appId: string) => {
    setPreviewTarget(null);
    if (isGuest) {
      setLoginOpen(true);
      return;
    }
    if (!entitlements || entitlements.plan !== "free") return;
    const action =
      entitlements.freeUnlocksRemaining < 1
        ? "paywall_viewed"
        : "unlock_clicked";
    void trackAppFunnelEvent(appId, action).catch(() => undefined);
    setUnlockTarget(appId);
  };

  const confirmUnlock = async () => {
    if (!unlockTarget || !entitlements) return;
    const response = await apiFetch(`/api/apps/${unlockTarget}/unlock`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? `Unlock returned ${response.status}`);
    }
    const result = (await response.json()) as {
      status:
        | "unlocked"
        | "already_unlocked"
        | "limit_reached"
        | "app_not_found";
      remaining: number;
    };
    if (result.status === "app_not_found")
      throw new Error("This app is no longer available.");
    if (result.status === "limit_reached") {
      setEntitlements({ ...entitlements, freeUnlocksRemaining: 0 });
      void trackAppFunnelEvent(unlockTarget, "paywall_viewed").catch(
        () => undefined,
      );
      return;
    }
    setEntitlements({
      ...entitlements,
      freeUnlocks: entitlements.freeUnlocks.includes(unlockTarget)
        ? entitlements.freeUnlocks
        : [...entitlements.freeUnlocks, unlockTarget],
      freeUnlocksRemaining: result.remaining,
    });
    const appId = unlockTarget;
    closeDiscoveryOverlays();
    setUnlockTarget(null);
    navigate({ name: "app", appId });
  };

  const accountControls = user ? (
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
      }}
    >
      <AstryxDropdown
        label={user.email}
        ariaLabel={`Account menu: ${user.email}`}
        open={accountMenuOpen}
        menuWidth={220}
        onOpenChange={setAccountMenuOpen}
      >
        {isAdmin ? (
          <AstryxDropdownItem
            label="Admin"
            onSelect={() => {
              setAccountMenuOpen(false);
              navigate({ name: "admin" });
            }}
          />
        ) : null}
        {researchProjectsEnabled ? (
          <AstryxDropdownItem
            label="Projects"
            onSelect={() => {
              setAccountMenuOpen(false);
              navigate({ name: "projects" });
            }}
          />
        ) : null}
        <AstryxDropdownItem
          label="Settings"
          onSelect={() => {
            setAccountMenuOpen(false);
            setSettingsOpen(true);
          }}
        />
        <AstryxDropdownDivider />
        <AstryxDropdownItem
          label="Log out"
          tone="destructive"
          onSelect={() => {
            setAccountMenuOpen(false);
            logout();
          }}
        />
      </AstryxDropdown>
    </div>
  ) : (
    <GuestCatalogControls onLogin={() => setLoginOpen(true)} />
  );
  const catalogLoginDialog = isGuest ? (
    <LoginDialog
      isOpen={loginOpen}
      onClose={() => setLoginOpen(false)}
      authenticate={authenticate}
      register={register}
      onSignedIn={completeLogin}
    />
  ) : null;

  const discoveryOverlays = (
    <AnimatePresence>
      {settingsOpen && user && (
        <SettingsPanel
          user={user}
          subscription={entitlements}
          onUpgrade={() => {
            setSettingsOpen(false);
            navigate({ name: "pricing" });
          }}
          onEntitlementsChanged={retryEntitlements}
          onClose={closeSettings}
        />
      )}
      {searchSnapshot.open &&
        (canUseAdvancedSearch && route.name !== "flows" ? (
          <QuickSearch
            state={searchSnapshot.state}
            recent={
              typeof window === "undefined"
                ? []
                : readRecentSearches(window.localStorage)
            }
            onStateChange={searchSession.update}
            onClose={searchSession.close}
            onPreview={(item) => {
              searchSession.close();
              setAdvancedPreview(item);
            }}
            onViewAll={(state) => {
              const handoff = quickSearchHandoff(state);
              searchSession.close();
              updateLocation(
                `/search${handoff.search ? `?${handoff.search}` : ""}`,
              );
            }}
          />
        ) : (
          <CommandPalette
            apps={apps ?? []}
            query={q}
            result={searchResult}
            searchLoading={searchLoading}
            searchError={searchError}
            collections={paletteCollections}
            plan={palettePlan}
            publicBrowse={isGuest}
            initialNav={route.name === "flows" ? "flows" : undefined}
            initialFlowQuery={
              route.name === "flows"
                ? (flowDiscoveryState?.query ?? "")
                : undefined
            }
            initialPlatform={
              route.name === "flows"
                ? (flowDiscoveryState?.platform ?? "web")
                : undefined
            }
            onUpgrade={paletteUpgrade}
            onCollectionsChange={user ? setCollections : () => undefined}
            onQueryChange={setQ}
            onRetrySearch={() => setSearchRetry((value) => value + 1)}
            onClose={searchSession.close}
            onSelectApp={(appId) => void openApp(appId)}
            onSelectScreen={(appId) => {
              closeDiscoveryOverlays();
              navigate({ name: "app", appId, section: "screens" });
            }}
            onSelectFlow={(appId, flow) => {
              closeDiscoveryOverlays();
              navigate({
                name: "app",
                appId,
                section: "flows",
                ...(flow ? { flow } : {}),
              });
            }}
            onSearchFlow={(flowTitle, platform, flowGroup) => {
              if (route.name === "flows") {
                const nextSearch = selectedFlowDiscoverySearch(
                  window.location.search,
                  flowTitle,
                  platform,
                  flowGroup,
                );
                closeDiscoveryOverlays();
                updateLocation(`/flows?${nextSearch}`);
                return;
              }
              setQ("");
              setFilters({ kind: "all" });
              setAppFacet({ group: "flows", value: flowTitle });
              setAppPlatform(platform);
              closeDiscoveryOverlays();
              navigate({ name: "apps" });
            }}
            onSelectCategory={(value) =>
              setAppFacet(
                value === "All" ? null : { group: "categories", value },
              )
            }
          />
        ))}
      {canUseAdvancedSearch && advancedPreview ? (
        <AdvancedSearchPreview
          item={advancedPreview}
          onClose={() => setAdvancedPreview(null)}
          collections={collections}
          onCollectionsChange={setCollections}
          plan={customerPlan}
          comparison={comparison}
          onComparisonChange={setComparison}
        />
      ) : null}
    </AnimatePresence>
  );

  const discoveryRoute =
    route.name === "project" ||
    route.name === "project-documents" ||
    route.name === "project-settings" ||
    route.name === "project-canvas" ||
    route.name === "project-document-file" ||
    route.name === "project-playground" ||
    route.name === "project-document"
      ? "projects"
      : route.name === "apps" ||
          route.name === "sites" ||
          route.name === "flows" ||
          route.name === "projects"
        ? route.name
        : null;
  const discoveryLocationSearch =
    typeof window === "undefined" ? "" : window.location.search;
  const appsDiscoveryHeaderState =
    route.name === "apps"
      ? createAppsDiscoveryAdapter({
          platform: appPlatform,
          facet: appFacet,
          source: isAdmin ? "admin" : "catalog",
        }).parse(discoveryLocationSearch)
      : null;
  const sitesDiscoveryHeaderState =
    route.name === "sites"
      ? createSitesDiscoveryAdapter({ query: siteQuery }).parse(
          discoveryLocationSearch,
        )
      : null;
  const discoverySearchSeed: Partial<AdvancedSearchFilters> =
    appsDiscoveryHeaderState
      ? {
          platform: [appsDiscoveryHeaderState.platform],
          ...searchSeedFromDiscoveryFilters(appsDiscoveryHeaderState.filters, {
            categories: "appCategory",
            screens: "pageType",
            elements: "component",
            flows: "flow",
          }),
        }
      : sitesDiscoveryHeaderState
        ? searchSeedFromDiscoveryFilters(sitesDiscoveryHeaderState.filters, {
            categories: "appCategory",
            sections: "siteSection",
            styles: "siteStyle",
          })
        : {};

  let page: ReactNode;

  switch (route.name) {
    case "flows":
      page = (
        <FlowsPage
          onOpenSearch={() => void openPalette("apps")}
          onSelectFlow={(title, platform) => {
            setQ("");
            setSearchResult(null);
            setFilters({ kind: "all" });
            setAppFacet({ group: "flows", value: title });
            setAppPlatform(platform);
            closeDiscoveryOverlays();
            navigate({ name: "apps" });
          }}
          onSelectApp={(appId) => void openApp(appId)}
          accountControls={accountControls}
          userRole={isAdmin ? "admin" : "user"}
        />
      );
      break;
    case "sites":
      page = (
        <SitesPage
          isAdmin={isAdmin}
          query={siteQuery}
          onQueryChange={setSiteQuery}
          onOpenSearch={(seed) => void openPalette("sites", seed)}
          searchMode={canUseAdvancedSearch ? "advanced" : "legacy"}
          activeFilterCount={activeFilterCount(searchSnapshot.state.filters)}
          memberControls={accountControls}
        />
      );
      break;
    case "site-version":
      page = (
        <SiteVersionPage
          {...("siteSlug" in route
            ? { siteSlug: route.siteSlug, selectedVersionId: route.version }
            : { siteId: route.siteId, versionId: route.versionId })}
          isAdmin={isAdmin}
          query={siteQuery}
          onQueryChange={setSiteQuery}
          accountControls={accountControls}
          initialSection={route.section}
          initialSectionId={route.sectionId}
          onSectionChange={(section) =>
            navigate(
              "siteSlug" in route
                ? {
                    name: "site-version",
                    siteSlug: route.siteSlug,
                    version: route.version,
                    section,
                  }
                : {
                    name: "site-version",
                    siteId: route.siteId,
                    versionId: route.versionId,
                    section,
                  },
            )
          }
          onInspectorChange={(sectionId) =>
            navigate(
              "siteSlug" in route
                ? {
                    name: "site-version",
                    siteSlug: route.siteSlug,
                    version: route.version,
                    section: "sections",
                    ...(sectionId ? { sectionId } : {}),
                  }
                : {
                    name: "site-version",
                    siteId: route.siteId,
                    versionId: route.versionId,
                    section: "sections",
                    ...(sectionId ? { sectionId } : {}),
                  },
            )
          }
        />
      );
      break;
    case "projects":
      page = researchProjectsEnabled ? (
        <ProjectsPage />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "collections":
      page = user ? (
        <Suspense fallback={<ApplicationPageSpinner />}>
          <CollectionsWorkspacePage
            collections={collections}
            loaded={collectionsLoaded}
            plan={customerPlan}
            collectionId={route.collectionId}
            onLoad={ensureCollections}
            onChange={setCollections}
            onUpgrade={openPricing}
          />
        </Suspense>
      ) : null;
      break;
    case "project":
      page = researchProjectsEnabled ? (
        <ProjectFilesPage projectId={route.projectId} area="canvas" />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-documents":
      page = researchProjectsEnabled ? (
        <ProjectFilesPage projectId={route.projectId} area="documents" />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-settings":
      page = researchProjectsEnabled ? (
        <ProjectFilesPage projectId={route.projectId} area="settings" />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-canvas":
      page = researchProjectsEnabled ? (
        <ProjectPlayground
          projectId={route.projectId}
          canvasId={route.canvasId}
          userId={user?.id ?? 0}
          userName={user?.email ?? "Astryx member"}
        />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-document-file":
      page = researchProjectsEnabled ? (
        <ProjectDocumentPage
          projectId={route.projectId}
          documentId={route.documentId}
          userName={user?.email ?? "Astryx member"}
        />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-playground":
      page = researchProjectsEnabled ? (
        <ProjectPlayground
          projectId={route.projectId}
          userId={user?.id ?? 0}
          userName={user?.email ?? "Astryx member"}
        />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "project-document":
      page = researchProjectsEnabled ? (
        <ProjectDocumentPage
          projectId={route.projectId}
          userName={user?.email ?? "Astryx member"}
        />
      ) : (
        <ApplicationStatusPage title="Research projects are unavailable" />
      );
      break;
    case "search":
      page = advancedSearchEnabled ? (
        <AdvancedSearchPage
          onPreview={setAdvancedPreview}
          comparison={comparison}
          onComparisonChange={setComparison}
        />
      ) : (
        <ApplicationStatusPage title="Search is unavailable" />
      );
      break;
    case "app":
      if (
        detailGateLoading ||
        (detailPreview ? publicPreviewLoading : detailLoading)
      ) {
        page = (
          <AppDetailLoadingPage
            accountControls={accountControls}
            onOpenSearch={() => void openPalette("apps")}
          />
        );
      } else if (entitlementsError) {
        page = (
          <ApplicationStatusPage
            title="Could not load account access"
            description={entitlementsError}
            role="alert"
            actions={
              <Button
                label="Retry"
                variant="primary"
                clickAction={retryEntitlements}
              />
            }
          />
        );
      } else if (detailPreview && publicPreview) {
        page = (
          <PublicAppPreviewPage
            preview={publicPreview}
            freeUnlocksRemaining={
              isGuest ? null : (entitlements?.freeUnlocksRemaining ?? null)
            }
            isGuest={isGuest}
            accountControls={accountControls}
            onOpenSearch={() => void openPalette("apps")}
            onUnlock={() => requestFullAppAnalysis(route.appId)}
          />
        );
      } else if (
        (detailPreview && publicPreviewError) ||
        detailError ||
        !detail
      ) {
        page = (
          <ApplicationStatusPage
            title="Could not load app details"
            description={
              publicPreviewError
                ? `The public preview could not be loaded: ${publicPreviewError}`
                : detailError
                  ? `The app could not be loaded: ${detailError}`
                  : "No app detail data was returned."
            }
          />
        );
      } else {
        page = (
          <AnimatePresence mode="wait">
            <ScreenDetail
              key={`detail-${detail.id}`}
              app={detail}
              role={user?.role ?? "user"}
              initialSection={route.section}
              initialPlatform={route.platform}
              initialVersion={route.version}
              initialEvidence={route.evidence}
              initialFlow={route.flow}
              initialStep={route.step}
              initialFlowView={route.flowView}
              onSectionChange={(section, platform, version) =>
                navigate({
                  name: "app",
                  appId: detail.id,
                  section,
                  platform,
                  version,
                })
              }
              onEvidenceChange={(evidence, section, platform, version) =>
                navigate({
                  name: "app",
                  appId: detail.id,
                  section,
                  platform,
                  version,
                  ...(evidence ? { evidence } : {}),
                })
              }
              onFlowChange={(flow, step, flowView, platform, version) =>
                navigate({
                  name: "app",
                  appId: detail.id,
                  section: "flows",
                  platform,
                  version,
                  ...(flow ? { flow } : {}),
                  ...(step ? { step } : {}),
                  ...(flowView ? { flowView } : {}),
                })
              }
              onBack={() => navigate({ name: "apps" })}
              accountControls={accountControls}
              onOpenSearch={() => void openPalette("apps")}
              collections={collections}
              onCollectionsChange={setCollections}
            />
          </AnimatePresence>
        );
      }
      break;
    case "apps":
      page = (
        <AppsDiscoveryPage
          isAdmin={isAdmin}
          facet={appFacet}
          initialPlatform={appPlatform}
          onFacetChange={setAppFacet}
          onOpenSearch={(seed) => void openPalette("apps", seed)}
          searchMode={canUseAdvancedSearch ? "advanced" : "legacy"}
          activeFilterCount={activeFilterCount(searchSnapshot.state.filters)}
          onOpenApp={(appId) => void openApp(appId)}
          accountControls={accountControls}
          beforeGrid={
            <>
              {isAdmin ? <ProgressBanner /> : null}
              {searchError ? (
                <div role="alert" className="apps-discovery__search-error">
                  {searchError}
                </div>
              ) : null}
            </>
          }
        />
      );
      break;
    case "settings-billing":
      page = user ? (
        <Suspense fallback={<ApplicationPageSpinner />}>
          <SettingsWorkspacePage
            user={user}
            subscription={entitlements}
            onUpgrade={openPricing}
            onEntitlementsChanged={retryEntitlements}
            onBack={() => navigate({ name: "projects" })}
            onSignOut={logout}
          />
        </Suspense>
      ) : null;
      break;
    case "admin":
    case "landing":
    case "not-found":
    case "build-in-public":
    case "pricing":
    case "billing-success":
    case "signin":
    case "feature-document-share":
      page = (
        <ApplicationStatusPage title="This page is outside the application" />
      );
      break;
    default:
      page = assertNeverRoute(route);
  }

  const dialogs = (
    <>
      {catalogLoginDialog}
      {previewTarget ? (
        <PublicAppPreviewModal
          preview={modalPublicPreview}
          loading={modalPublicPreviewLoading}
          error={modalPublicPreviewError}
          freeUnlocksRemaining={
            isGuest ? null : (entitlements?.freeUnlocksRemaining ?? null)
          }
          isGuest={isGuest}
          onUnlock={() => requestFullAppAnalysis(previewTarget)}
          onClose={() => setPreviewTarget(null)}
        />
      ) : null}
      {unlockTarget && entitlements ? (
        <UnlockModal
          appId={unlockTarget}
          remaining={entitlements.freeUnlocksRemaining}
          onConfirm={confirmUnlock}
          onClose={() => {
            setUnlockTarget(null);
            if (route.name === "app" && detailLocked)
              navigate({ name: "apps" });
          }}
          onUpgrade={() => {
            setUnlockTarget(null);
            navigate({ name: "pricing" });
          }}
        />
      ) : null}
    </>
  );

  /*
   * Surfaces that render inside the hoisted workspace shell (rail + panel).
   *
   * Every full-viewport editor is deliberately absent, not just the canvas
   * board: each is 100dvh with its own brand mark, its own identity and its
   * own tool rail, so nesting one in the workspace panel gave it two headers,
   * a second rail eating 200px, and a 100dvh child inside an inset panel that
   * could not contain it. That ruled out the document editor too — it shares
   * the same full-viewport shape as the canvas board, so it stays off this
   * list for the same reason, keeping every project editor equally chromeless.
   */
  const workspaceChromeRoutes = new Set([
    "projects",
    "project",
    "project-documents",
    "project-settings",
    "collections",
    "settings-billing",
  ]);
  const workspaceChromeEnabled = workspaceChromeRoutes.has(route.name);

  const hasPersistentDiscoveryHeader =
    discoveryRoute !== null &&
    route.name !== "projects" &&
    route.name !== "project" &&
    route.name !== "project-documents" &&
    route.name !== "project-document-file" &&
    route.name !== "project-document" &&
    route.name !== "project-settings" &&
    route.name !== "project-playground" &&
    route.name !== "project-canvas";

  const pageWithPersistentDiscoveryHeader = hasPersistentDiscoveryHeader ? (
    <div
      data-persistent-discovery-frame="true"
      data-sticky-chrome={
        stickyChromeEnabled
          ? stickyChromeMerged
            ? "merged"
            : "expanded"
          : undefined
      }
      style={{ display: "contents" }}
    >
      <ApplicationHeader
        active={discoveryRoute ?? "apps"}
        className="apps-top-nav"
        search={
          <SearchTrigger
            label={
              discoveryRoute === "apps"
                ? "Search Apps…"
                : discoveryRoute === "sites"
                  ? "Search Sites…"
                  : discoveryRoute === "flows"
                    ? "Search Flows…"
                    : discoveryRoute === "projects"
                      ? "Search references…"
                      : "Search on Web..."
            }
            activeCategory={
              discoveryRoute === "flows"
                ? flowDiscoveryState?.query || null
                : null
            }
            onOpen={() =>
              void openPalette(
                discoveryRoute === "sites" ? "sites" : "apps",
                discoverySearchSeed,
              )
            }
            onClearCategory={() => {
              if (discoveryRoute !== "flows" || !flowDiscoveryState) return;
              updateLocation(
                `/flows?${flowsDiscoveryAdapter.serialize({
                  ...flowDiscoveryState,
                  query: "",
                })}`,
              );
            }}
            mode={
              discoveryRoute === "flows" || !canUseAdvancedSearch
                ? "legacy"
                : "advanced"
            }
            activeFilterCount={
              discoveryRoute === "flows"
                ? 0
                : activeFilterCount(searchSnapshot.state.filters)
            }
          />
        }
        accountControls={accountControls}
      />
      {page}
    </div>
  ) : (
    page
  );

  return (
    <ApplicationSurface
      page={
        <WorkspaceChromeProvider enabled={workspaceChromeEnabled}>
          <Suspense fallback={<ApplicationPageSpinner />}>
            {pageWithPersistentDiscoveryHeader}
          </Suspense>
        </WorkspaceChromeProvider>
      }
      overlays={discoveryOverlays}
      dialogs={dialogs}
    />
  );
}

function ApplicationPageSpinner() {
  return (
    <main
      className="vitrine-page"
      style={{ display: "grid", minHeight: "100vh", placeItems: "center" }}
      role="status"
      aria-label="Loading page"
    >
      <Spinner size="lg" />
    </main>
  );
}

function ApplicationStatusPage({
  title,
  description,
  actions,
  role,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <main
      className="vitrine-page"
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: 24,
      }}
      role={role}
    >
      <EmptyState title={title} description={description} actions={actions} />
    </main>
  );
}

function assertNeverRoute(value: never): never {
  throw new Error(`Unhandled application route: ${JSON.stringify(value)}`);
}

function searchSeedFromDiscoveryFilters(
  filters: readonly DiscoveryFilter[],
  groups: Record<string, keyof AdvancedSearchFilters>,
): Partial<AdvancedSearchFilters> {
  const seed: Partial<AdvancedSearchFilters> = {};
  for (const [group, target] of Object.entries(groups)) {
    const values = filters
      .filter((filter) => filter.group === group)
      .map(({ value }) => value);
    if (values.length > 0) {
      Object.assign(seed, { [target]: values });
    }
  }
  return seed;
}
