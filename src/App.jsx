import { useMemo, useState } from "react";
import { T } from "./theme.js";
import { findSection } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import DetailModal from "./components/DetailModal.jsx";
import { useReferenceData } from "./lib/data/useReferenceData.js";

// `session` is always non-null here — LoginGate only renders <App /> after
// the user is authenticated AND passes the admins check.
export default function App({ session }) {
  const [currentSection, setCurrentSection] = useState("overview");
  const [scheduleDetail, setScheduleDetail] = useState(null);

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
  // Pages that render their own header row (title + tabs/actions inline).
  const isSelfHeadered = section.id === "overview" || section.id === "chores";

  return (
    <div style={{ background: T.bg, color: T.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.body, fontSize: 13 }}>
      <TopBar data={data} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar current={currentSection} onSelect={setCurrentSection} data={data} session={session} />
        <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
          {!isSelfHeadered && <SectionHeader section={section} noBottomBorder={isSpeciesPage} />}
          <SectionContent section={section} data={data} onShowDetail={setScheduleDetail} onNavigate={setCurrentSection} />
        </main>
      </div>
      {scheduleDetail && <DetailModal item={scheduleDetail} onClose={() => setScheduleDetail(null)} />}
    </div>
  );
}
