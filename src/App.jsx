import { useMemo, useState } from "react";
import { findSection, findFlyoutParentForChild } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import EventEditor from "./components/EventEditor.jsx";
import RecordsDrawer from "./components/RecordsDrawer.jsx";
import Processing from "./pages/Processing.jsx";
import Rounds from "./pages/Rounds.jsx";
import { useReferenceData } from "./lib/data/useReferenceData.js";

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

// `session` is always non-null here — LoginGate only renders <App /> after
// the user is authenticated AND passes the admins check.
export default function App({ session }) {
  const [currentSection, setCurrentSection] = useState(() =>
    isPhone() ? "now" : "map"
  );
  // EventEditor seed — null when closed; otherwise carries the edit/new
  // mode and (for edits) the seriesId + occurrence date that was clicked.
  const [eventSeed, setEventSeed] = useState(null);
  // Processing-day workspace state (Batch 14.2). When non-null, the
  // workspace renders in place of the normal section content. Set by
  // the EventEditor's "Open processing details →" link; cleared by
  // the workspace's Back button.
  const [processingTarget, setProcessingTarget] = useState(null);
  // Rounds is a full-screen takeover — when open, the rest of the
  // app (TopBar / Sidebar / SectionHeader) gets out of the way.
  // null = closed; { blockId } = open (blockId optionally deep-links
  // the cold open to a specific block — used by the Now surface).
  const [roundsTarget, setRoundsTarget] = useState(null);
  // Phone nav drawer (Batch 17). The fixed sidebar is desktop-only;
  // on phones it opens as an overlay from the TopBar hamburger.
  const [navOpen, setNavOpen] = useState(false);
  // Records drawer (Batch 18.2). Products / Sales / CRM / Comms /
  // Animals / resource lists + Settings, off the header avatar.
  const [recordsOpen, setRecordsOpen] = useState(false);

  const openRounds = (blockId) =>
    setRoundsTarget({ blockId: blockId ?? null });

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

  const section = findSection(currentSection) || findSection("overview");
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

  if (roundsTarget) {
    return (
      <Rounds
        data={data}
        initialBlockId={roundsTarget.blockId}
        onClose={() => setRoundsTarget(null)}
      />
    );
  }

  const handleSelect = (id) => {
    setCurrentSection(id);
    setNavOpen(false);
    setRecordsOpen(false);
  };
  const handleOpenRounds = (blockId) => {
    openRounds(blockId);
    setNavOpen(false);
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
        onOpenRecords={() => setRecordsOpen((o) => !o)}
        onToggleNav={() => setNavOpen((o) => !o)}
      />
      <div className="flex flex-1 items-stretch">
        {/* Desktop sidebar */}
        <div className="hidden sm:flex shrink-0">
          <Sidebar
            current={currentSection}
            onSelect={handleSelect}
            onOpenRounds={handleOpenRounds}
            data={data}
          />
        </div>
        {/* Phone nav drawer (Batch 17) */}
        {navOpen && (
          <div className="fixed inset-0 z-40 flex sm:hidden">
            <div className="flex h-full bg-bg shadow-[2px_0_24px_rgba(0,0,0,0.4)]">
              <Sidebar
                current={currentSection}
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
              onNavigate={setCurrentSection}
              noBottomBorder={isSpeciesPage}
            />
          )}
          {inProcessingWorkspace ? (
            <Processing
              seriesId={processingTarget.seriesId}
              occursOn={processingTarget.occursOn}
              onClose={() => setProcessingTarget(null)}
            />
          ) : (
            <SectionContent
              section={section}
              data={data}
              onOpenEvent={setEventSeed}
              onNavigate={setCurrentSection}
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
      <RecordsDrawer
        open={recordsOpen}
        current={currentSection}
        data={data}
        session={session}
        onSelect={handleSelect}
        onClose={() => setRecordsOpen(false)}
      />
    </div>
  );
}
