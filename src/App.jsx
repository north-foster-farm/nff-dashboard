import { useState } from "react";
import { T } from "./theme.js";
import { findSection } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import DetailModal from "./components/DetailModal.jsx";

// `session` is always non-null here — LoginGate only renders <App /> after
// the user is authenticated AND passes the admins check.
export default function App({ session }) {
  const [currentSection, setCurrentSection] = useState("overview");
  const [scheduleDetail, setScheduleDetail] = useState(null);

  const section = findSection(currentSection) || findSection("overview");
  const isSpeciesPage = section.id.startsWith("livestock_");
  // Pages that render their own header row (title + tabs/actions inline).
  const isSelfHeadered = section.id === "overview" || section.id === "chores";

  return (
    <div style={{ background: T.bg, color: T.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.body, fontSize: 13 }}>
      <TopBar data={NFF_DATA} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar current={currentSection} onSelect={setCurrentSection} data={NFF_DATA} session={session} />
        <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
          {!isSelfHeadered && <SectionHeader section={section} noBottomBorder={isSpeciesPage} />}
          <SectionContent section={section} data={NFF_DATA} onShowDetail={setScheduleDetail} onNavigate={setCurrentSection} />
        </main>
      </div>
      {scheduleDetail && <DetailModal item={scheduleDetail} onClose={() => setScheduleDetail(null)} />}
    </div>
  );
}
