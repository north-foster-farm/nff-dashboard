import { useState } from "react";
import { T } from "../theme.js";
import { TabStrip, DataField, Subsection } from "../components/primitives.jsx";
import { computeAge, formatDate } from "../lib/dates.js";
import { computeStageCost } from "../lib/feedCost.js";
import { ChoreRow } from "./Chores.jsx";

export default function SpeciesPage({ species, data }) {
  const [tab, setTab] = useState("groups");
  const speciesChores = data.chores.definitions.filter(c => c.tags.includes(species.id));
  const speciesSchedules = data.feedSchedules.filter(fs => fs.speciesId === species.id);

  return (
    <div>
      <TabStrip
        tabs={[
          { id: "groups", label: `Groups · ${species.groups.length}` },
          { id: "feed", label: `Feed schedule · ${speciesSchedules.length}` },
          { id: "chores", label: `Chores · ${speciesChores.length}` },
          { id: "activity", label: `Activity Log · 0` },
          { id: "more", label: "More info" }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "groups" && <GroupsTab species={species} />}
      {tab === "feed" && <FeedScheduleTab species={species} schedules={speciesSchedules} feeds={data.feeds} />}
      {tab === "chores" && <SpeciesChoresTab species={species} chores={speciesChores} />}
      {tab === "activity" && <ActivityLogTab species={species} />}
      {tab === "more" && <MoreInfoView species={species} />}
    </div>
  );
}

function GroupsTab({ species }) {
  if (species.groups.length === 0) {
    return <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", padding: "32px 0", textAlign: "center" }}>No groups recorded yet.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
      {species.groups.map(g => <GroupCard key={g.id} group={g} species={species} />)}
    </div>
  );
}

function GroupCard({ group, species }) {
  const isSheep = species.id === "sheep";
  const showCount = species.trackingModel !== "individual";
  const age = computeAge(group.knownAge);
  const arrivalDisplay = formatDate(group.arrivalDate) || "Unknown";
  const countDisplay = group.count != null ? group.count.toLocaleString() : "Unknown";
  const locationValue = group.currentLocation || "Unknown";
  const locationKnown = locationValue !== "Unknown" && locationValue !== "TBD";
  const fields = [
    ...(!isSheep ? [{ label: "Age", value: age }] : []),
    ...(showCount && !isSheep ? [{ label: "Count", value: countDisplay }] : []),
    ...(!isSheep ? [{ label: "Arrived", value: arrivalDisplay }] : []),
    ...(!isSheep ? [{ label: "Location", value: locationValue, highlight: locationKnown }] : [])
  ];
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{group.label}</div>
          {species.breed && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{species.breed}</div>}
        </div>
        {group.ordinal != null && <div style={{ fontSize: 10, color: T.textMuted }}>#{group.ordinal}</div>}
      </div>
      {fields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 5, columnGap: 12, marginTop: 10 }}>
          {fields.map(f => {
            const isUnknown = f.value === "Unknown" || f.value === "TBD";
            return (
              <div key={f.label} style={{ display: "contents" }}>
                <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", paddingTop: 2 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: isUnknown ? T.textFaint : (f.highlight ? T.accent : T.text), fontStyle: isUnknown ? "italic" : "normal" }}>{f.value}</div>
              </div>
            );
          })}
        </div>
      )}
      {group.cohabits && (
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, lineHeight: 1.5 }}>{group.cohabits}</div>
      )}
    </div>
  );
}

function SpeciesChoresTab({ species, chores }) {
  if (chores.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>No chores tagged for {species.name.toLowerCase()}.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        Recurring chore definitions tagged for {species.name.toLowerCase()}. Once the recurrence engine generates instances, upcoming ones will appear here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {chores.map(c => <ChoreRow key={c.id} chore={c} />)}
      </div>
    </div>
  );
}

function ActivityLogTab({ species }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "36px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>No activity logged yet for {species.name.toLowerCase()}.</div>
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
        This tab will show LogEntry instances relevant to {species.name.toLowerCase()} — chore completions, feed logs, weight logs, and species-specific entries. Storage architecture is open — see thread_log_storage.
      </div>
    </div>
  );
}

function MoreInfoView({ species }) {
  return (
    <div>
      <DataField label="Acquisition" value={species.acquisition} />
      <DataField label="Feed regimen" value={species.feedRegimen ? species.feedRegimen.join(", ") + (species.feedNote ? `. ${species.feedNote}` : "") : null} />
      <DataField label="Processing" value={species.processingTimeline} />
      <DataField label="Feed tracking" value={species.feedTracking} />
      <DataField label="Brooder→Tractor" value={species.brooderToTractorTransition} />
      {species.lifecycle && species.lifecycle.length > 0 && (
        <Subsection title="Lifecycle">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {species.lifecycle.map((stage, idx) => (
              <div key={idx} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600 }}>{stage.stage}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{stage.duration}</div>
                </div>
                {stage.graduationCriteria && <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: T.accent }}>→</span> {stage.graduationCriteria}</div>}
                {stage.notes && <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>{stage.notes}</div>}
              </div>
            ))}
          </div>
        </Subsection>
      )}
      {species.constraints && species.constraints.length > 0 && (
        <Subsection title="Constraints">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.text, lineHeight: 1.8 }}>
            {species.constraints.map((c, idx) => <li key={idx}>{c}</li>)}
          </ul>
        </Subsection>
      )}
    </div>
  );
}

function FeedScheduleTab({ species, schedules, feeds }) {
  if (schedules.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted }}>No feed schedule defined for {species.name.toLowerCase()}.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
        Read-only display of feed schedules for {species.name.toLowerCase()}. Editor and full week-by-week customization coming.
      </div>
      {schedules.map(s => <FeedSchedulePanel key={s.id} schedule={s} feeds={feeds} species={species} />)}
    </div>
  );
}

function FeedSchedulePanel({ schedule, feeds, species }) {
  const stagesWithCost = schedule.stages.map(stage => ({
    ...stage,
    feed: feeds.find(f => f.id === stage.feedTypeId),
    costInfo: computeStageCost(stage, feeds.find(f => f.id === stage.feedTypeId))
  }));
  const meteredCosts = stagesWithCost.filter(s => s.costInfo && s.costInfo.cost != null);
  const totalCost = meteredCosts.reduce((sum, s) => sum + s.costInfo.cost, 0);
  const totalAmount = meteredCosts.reduce((sum, s) => sum + s.costInfo.totalAmount, 0);
  const totalUnit = meteredCosts[0]?.costInfo.totalUnit || "";
  const assignedLabels = schedule.assignedGroupIds.map(gid => species.groups.find(g => g.id === gid)?.label || gid);
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <header style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}>
        <h3 style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, margin: 0 }}>{schedule.name}</h3>
        {schedule.description && <p style={{ fontSize: 12, color: T.textDim, margin: "4px 0 0", lineHeight: 1.6 }}>{schedule.description}</p>}
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}` }}>
          <span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8, fontSize: 9 }}>Assigned to</span>
          {assignedLabels.join(", ") || "No groups assigned"}
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {stagesWithCost.map(s => <StageRow key={s.id} stage={s} anchorLabel={schedule.cycleAnchorLabel} />)}
      </div>
      {meteredCosts.length > 0 && (
        <div style={{ padding: "16px 22px", background: T.surfaceAlt, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Total estimated cost (metered stages)
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.accent }}>${totalCost.toFixed(2)}</div>
        </div>
      )}
      {meteredCosts.length > 0 && (
        <div style={{ fontSize: 10, color: T.textFaint, padding: "0 22px 14px", lineHeight: 1.5, fontStyle: "italic" }}>
          {totalAmount.toLocaleString()} {totalUnit} across {meteredCosts.length} metered stage{meteredCosts.length === 1 ? "" : "s"}. Excludes free-choice and TBD stages.
        </div>
      )}
    </section>
  );
}

function StageRow({ stage }) {
  const dayRange = stage.endDay == null ? `Day ${stage.startDay}+` : `Days ${stage.startDay}–${stage.endDay}`;
  const days = stage.endDay == null ? null : stage.endDay - stage.startDay;
  let consumptionText, costText;
  if (stage.consumption.type === "free_choice") {
    consumptionText = "Free choice";
    costText = "Not estimated";
  } else if (stage.consumption.type === "tbd") {
    consumptionText = "TBD";
    costText = "Not yet computable";
  } else if (stage.consumption.type === "metered") {
    consumptionText = `${stage.consumption.amount} ${stage.consumption.unit} / ${stage.consumption.per} per ${stage.consumption.basis}`;
    if (stage.costInfo && stage.costInfo.cost != null) {
      costText = `$${stage.costInfo.cost.toFixed(2)} (${stage.costInfo.totalAmount.toLocaleString()} ${stage.costInfo.totalUnit} × $${stage.feed.costPerUnit.amount.toFixed(2)}/${stage.feed.costPerUnit.unit})`;
    } else if (stage.costInfo?.unitMismatch) {
      costText = "Unit mismatch — cost not computable";
    } else {
      costText = "Ongoing — not estimated";
    }
  } else {
    consumptionText = "Unknown";
    costText = "—";
  }
  return (
    <div style={{ background: T.surface, padding: "14px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600 }}>{stage.name}</div>
        <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {dayRange}{days != null && ` · ${days} day${days === 1 ? "" : "s"}`}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 11 }}>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Feed</span><span style={{ color: T.text }}>{stage.feed?.name || stage.feedTypeId}</span></div>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Amount</span><span style={{ color: T.text }}>{consumptionText}</span></div>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Cost</span><span style={{ color: stage.costInfo?.cost != null ? T.accent : T.textDim }}>{costText}</span></div>
      </div>
      {stage.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{stage.notes}</div>}
    </div>
  );
}
