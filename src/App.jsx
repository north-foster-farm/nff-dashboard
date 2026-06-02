import { useEffect, useMemo, useState } from "react";
import { findSection, findFlyoutParentForChild } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import EventEditor from "./components/EventEditor.jsx";
import Processing from "./pages/Processing.jsx";
import Rounds from "./pages/Rounds.jsx";
import { useReferenceData } from "./lib/data/useReferenceData.js";
import { useProcessRunner } from "./lib/data/useProcessRunner.js";
import {
  useRoute, usePath, navigate, navigateBack, pathForSection,
  usePersistedState,
} from "./lib/router.js";

// Phone-width media query — used once at boot to pick the landing
// section (farm-map workshop decisions 1 + 2: phones land on Now,
// desktop lands on the Farm map).
const PHONE_QUERY = "(max-width: 639px)";

function isPhone() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.(PHONE_QUERY)?.matches
  );
}

function defaultPath() {
  return isPhone() ? "/now" : "/map";
}

// `session` is always non-null here — LoginGate only renders <App /> after
// the user is authenticated AND passes the admins check.
export default function App({ session }) {
  // All primary navigation lives in the URL (lib/router.js): the
  // current section, the Rounds takeover, place pages, and the Chores
  // tab. Reload reopens the same screen; back/forward walk history.
  const route = useRoute();
  // EventEditor seed — null when closed; otherwise carries the edit/new
  // mode and (for edits) the seriesId + occurrence date that was clicked.
  const [eventSeed, setEventSeed] = useState(null);
  // Processing-day workspace state (Batch 14.2). When non-null, the
  // workspace renders in place of the normal section content. Set by
  // the EventEditor's "Open processing details →" link; cleared by
  // the workspace's Back button.
  const [processingTarget, setProcessingTarget] = useState(null);
  // Phone nav drawer (Batch 17). The fixed sidebar is desktop-only;
  // on phones it opens as an overlay from the TopBar hamburger.
  const [navOpen, setNavOpen] = useState(false);
  // Desktop sidebar collapse (2026-06 chore-ux fixes). Session-scoped
  // so it survives navigation but a fresh tab starts expanded.
  const [sidebarHidden, setSidebarHidden] = usePersistedState(
    "sidebar-hidden", false
  );

  // "/" lands on the device-appropriate default screen.
  useEffect(() => {
    if (route.kind === "home") {
      navigate(defaultPath(), { replace: true });
    }
  }, [route.kind]);

  // The processing workspace renders in place of section content but
  // isn't a URL of its own — any actual navigation (e.g. jumping to a
  // batch's lifecycle page from the workspace's picker) should win
  // over it.
  const path = usePath();
  useEffect(() => {
    setProcessingTarget(null);
  }, [path]);

  const openRounds = (blockId) =>
    navigate(blockId ? `/rounds/${blockId}` : "/rounds");

  // Live reference data from Postgres. Keys that haven't loaded yet come
  // back as `null`; the merge below only overrides JSON for keys that HAVE
  // loaded, so the UI never sees a half-hydrated state. As additional
  // reference tables migrate (Batches 2-4), the hook just grows more
  // non-null keys and App.jsx needs no further change.
  const refData = useReferenceData();
  const data = useMemo(() => {
    const merged = { ...NFF_DATA };
    for (const [key, val] of Object.entries(refData)) {
      if (val !== null) merged[key] = val;
    }
    return merged;
  }, [refData]);

  // The process expansion engine (Batch 23): watches active processes
  // + upcoming events, expands matching occurrences into projects /
  // chore modifiers. Idempotent across devices via process_expansions'
  // unique constraint.
  useProcessRunner(data);

  const currentSection = route.kind === "section" ? route.sectionId : null;
  const section =
    findSection(currentSection ?? (isPhone() ? "now" : "map")) ||
    findSection("overview");

  // Browser history entries get readable titles per screen.
  useEffect(() => {
    document.title = route.kind === "rounds"
      ? "Rounds — North Foster Farm"
      : `${section.label} — North Foster Farm`;
  }, [route.kind, section.label]);

  const isSpeciesPage = section.id.startsWith("livestock_");
  // Pages that render their own header row (title + tabs/actions inline) or
  // are full-page takeovers (Settings, ComingSoon stubs) that don't want any
  // SectionHeader chrome.
  const isSelfHeadered =
    section.id === "now" ||
    section.id === "map" ||
    section.id === "overview" ||
    section.id === "chores" ||
    section.id === "settings" ||
    section.id === "roadmap" ||
    section.comingSoon === true;
  // Processing-day workspace renders in place of the section content
  // (it carries its own header). Treat it as self-headered too.
  const inProcessingWorkspace = !!processingTarget;

  if (route.kind === "rounds") {
    return (
      <Rounds
        data={data}
        initialBlockId={route.blockId}
        onClose={() => navigateBack(defaultPath())}
      />
    );
  }

  const handleSelect = (id) => {
    navigate(pathForSection(id));
    setNavOpen(false);
  };
  const handleOpenRounds = (blockId) => {
    openRounds(blockId);
    setNavOpen(false);
  };
  // The TopBar hamburger: on phones it opens the overlay drawer; on
  // desktop it collapses / restores the fixed sidebar.
  const handleToggleNav = () => {
    if (isPhone()) setNavOpen((o) => !o);
    else setSidebarHidden((h) => !h);
  };

  // Layout note: the page scrolls as one normal document — no
  // h-screen / overflow-hidden inner-scroll trickery. The pinned
  // ("sticky") TopBar + scrolling <main> combination was buggy on iOS
  // (viewport-height jumps, scroll chaining), so the whole chrome
  // simply scrolls away with the content for now.
  return (
    <div className="bg-bg text-fg min-h-screen flex flex-col font-body text-[13px]">
      <TopBar
        data={data}
        session={session}
        onOpenSettings={() => handleSelect("settings")}
        onToggleNav={handleToggleNav}
      />
      <div className="flex flex-1 items-stretch">
        {/* Desktop sidebar (collapsible via the TopBar hamburger) */}
        {!sidebarHidden && (
          <div className="hidden sm:flex shrink-0">
            <Sidebar
              current={section.id}
              onSelect={handleSelect}
              onOpenRounds={handleOpenRounds}
              data={data}
            />
          </div>
        )}
        {/* Phone nav drawer (Batch 17) */}
        {navOpen && (
          <div className="fixed inset-0 z-40 flex sm:hidden">
            <div className="flex h-full bg-bg shadow-[2px_0_24px_rgba(0,0,0,0.4)]">
              <Sidebar
                current={section.id}
                onSelect={handleSelect}
                onOpenRounds={handleOpenRounds}
                data={data}
              />
            </div>
            <div
              className="flex-1 bg-black/60"
              onClick={() => setNavOpen(false)}
              aria-hidden
            />
          </div>
        )}
        <main className="flex-1 px-4 py-5 sm:px-10 sm:py-8 min-w-0">
          {!isSelfHeadered && !inProcessingWorkspace && (
            <SectionHeader
              section={section}
              parent={findFlyoutParentForChild(section.id)}
              onNavigate={handleSelect}
              noBottomBorder={isSpeciesPage}
            />
          )}
          {inProcessingWorkspace ? (
            <Processing
              seriesId={processingTarget.seriesId}
              occursOn={processingTarget.occursOn}
              data={data}
              onClose={() => setProcessingTarget(null)}
            />
          ) : (
            <SectionContent
              section={section}
              data={data}
              onOpenEvent={setEventSeed}
              onNavigate={handleSelect}
              onOpenRounds={openRounds}
            />
          )}
        </main>
      </div>
      <EventEditor
        open={!!eventSeed}
        seed={eventSeed}
        kinds={data.events?.kinds ?? []}
        onClose={() => setEventSeed(null)}
        onOpenProcessing={(target) => {
          setEventSeed(null);
          setProcessingTarget(target);
        }}
      />
    </div>
  );
}
