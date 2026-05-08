import { useMemo, useState } from "react";
import { findSection, findFlyoutParentForChild } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import EventEditor from "./components/EventEditor.jsx";
import Rounds from "./pages/Rounds.jsx";
import { useReferenceData } from "./lib/data/useReferenceData.js";

// `session` is always non-null here — LoginGate only renders <App /> after
// the user is authenticated AND passes the admins check.
export default function App({ session }) {
  const [currentSection, setCurrentSection] = useState("overview");
  // EventEditor seed — null when closed; otherwise carries the edit/new
  // mode and (for edits) the seriesId + occurrence date that was clicked.
  const [eventSeed, setEventSeed] = useState(null);
  // Rounds is a full-screen takeover — when open, the rest of the
  // app (TopBar / Sidebar / SectionHeader) gets out of the way.
  const [roundsOpen, setRoundsOpen] = useState(false);

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
    section.id === "overview" ||
    section.id === "chores" ||
    section.id === "settings" ||
    section.id === "roadmap" ||
    section.comingSoon === true;

  if (roundsOpen) {
    return <Rounds data={data} onClose={() => setRoundsOpen(false)} />;
  }

  return (
    <div className="bg-bg text-fg h-screen flex flex-col overflow-hidden font-body text-[13px]">
      <TopBar
        data={data}
        session={session}
        onOpenSettings={() => setCurrentSection("settings")}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          current={currentSection}
          onSelect={setCurrentSection}
          onOpenRounds={() => setRoundsOpen(true)}
          data={data}
        />
        <main className="flex-1 px-10 py-8 overflow-y-auto min-w-0">
          {!isSelfHeadered && (
            <SectionHeader
              section={section}
              parent={findFlyoutParentForChild(section.id)}
              onNavigate={setCurrentSection}
              noBottomBorder={isSpeciesPage}
            />
          )}
          <SectionContent
            section={section}
            data={data}
            onOpenEvent={setEventSeed}
            onNavigate={setCurrentSection}
          />
        </main>
      </div>
      <EventEditor
        open={!!eventSeed}
        seed={eventSeed}
        kinds={data.events?.kinds ?? []}
        onClose={() => setEventSeed(null)}
      />
    </div>
  );
}
