import { useState } from "react";
import { T } from "./theme.js";
import { findSection } from "./sections.jsx";
import NFF_DATA from "./data/nff-data.json";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SectionHeader from "./components/SectionHeader.jsx";
import SectionContent from "./components/SectionContent.jsx";
import DetailModal from "./components/DetailModal.jsx";

export default function App() {
  const [currentSection, setCurrentSection] = useState("overview");
  const [scheduleDetail, setScheduleDetail] = useState(null);

  const section = findSection(currentSection) || findSection("overview");
  const isSpeciesPage = section.id.startsWith("livestock_");

  return (
    <div style={{ background: T.bg, color: T.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.body, fontSize: 13 }}>
      <TopBar data={NFF_DATA} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar current={currentSection} onSelect={setCurrentSection} data={NFF_DATA} />
        <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
          <SectionHeader section={section} data={NFF_DATA} noBottomBorder={isSpeciesPage} />
          <SectionContent section={section} data={NFF_DATA} onShowDetail={setScheduleDetail} />
        </main>
      </div>
      {scheduleDetail && <DetailModal item={scheduleDetail} onClose={() => setScheduleDetail(null)} />}
    </div>
  );
}
