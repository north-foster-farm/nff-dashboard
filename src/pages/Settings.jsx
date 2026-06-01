import { useState } from "react";
import { useUserPreferences } from "../lib/data/useUserPreferences.js";
import { usePushNotifications } from "../lib/data/usePushNotifications.js";
import { useAutomations } from "../lib/data/useAutomations.js";
import {
  Sun, Moon, ALargeSmall, Bell, BellOff, Sparkles,
} from "lucide-react";

// User settings page. Stays focused — three settings, each with a tight
// segmented-control style picker so the affordance is consistent.

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
];

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact", description: "Default — packs the most info on screen." },
  { value: "comfortable", label: "Comfortable", description: "15% larger across the board." },
  { value: "spacious", label: "Spacious", description: "30% larger; easiest to read at distance." },
];

export default function Settings() {
  const {
    theme, density,
    setTheme, setDensity,
    loading,
  } = useUserPreferences();

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-8 py-2">
      <div>
        <h2 className="font-heading text-[28px] font-bold -tracking-[0.02em] m-0 text-fg">
          User settings
        </h2>
        <p className="text-[13px] text-dim mt-2 leading-relaxed">
          Preferences sync across every device you sign in on. They take
          effect immediately.
        </p>
      </div>

      <Section title="Appearance" subtitle={loading ? "Loading…" : null}>
        <Field label="Theme">
          <SegmentedControl
            value={theme}
            onChange={setTheme}
            options={THEME_OPTIONS.map(({ value, label, Icon }) => ({
              value,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={13} /> {label}
                </span>
              ),
            }))}
          />
        </Field>
        <Field
          label={<span className="inline-flex items-center gap-2"><ALargeSmall size={14} /> Text density</span>}
          description="Scales every text size in the app uniformly."
        >
          <SegmentedControl
            value={density}
            onChange={setDensity}
            options={DENSITY_OPTIONS.map(({ value, label }) => ({ value, label }))}
          />
          <div className="text-[11px] text-faint mt-2">
            {DENSITY_OPTIONS.find(o => o.value === density)?.description}
          </div>
        </Field>
      </Section>

      <NotificationsSection />

      <AutomationsSection />
    </div>
  );
}

// ── Automations section ──────────────────────────────────────────────
// Lists the trigger rules (Batch 19). Each can be enabled/disabled;
// the broiler-lifecycle rule's week offsets are editable inline.
function AutomationsSection() {
  const { automations, loading, setEnabled, updateConfig } = useAutomations();

  return (
    <Section
      title="Automations"
      subtitle={loading ? "Loading…" : null}
    >
      <p className="text-[12px] text-dim leading-relaxed m-0 -mt-2">
        Rules that create events and chores for you. Anything they create
        shows up with a <Sparkles size={11} className="inline -translate-y-px" /> sparkle
        and lands in the dashboard's "Heads up" lane until someone
        acknowledges it.
      </p>
      {automations.map((a) => (
        <AutomationRow
          key={a.id}
          automation={a}
          onToggle={(enabled) => setEnabled(a.id, enabled)}
          onUpdateConfig={(cfg) => updateConfig(a.id, cfg)}
        />
      ))}
      {!loading && automations.length === 0 && (
        <div className="text-[12px] text-dim italic">
          No automation rules found.
        </div>
      )}
    </Section>
  );
}

// Per-trigger-kind copy describing what the rule does.
const AUTOMATION_COPY = {
  batch_created: "When a new broiler batch is added, creates its arrival, "
    + "pasture-move, and processing events plus a brooder cleanout chore.",
  inventory_reorder: "When a feed's on-hand amount (Records → Feeds) drops "
    + "to or below its reorder point, creates a feed-order chore and a "
    + "delivery event.",
};

function AutomationRow({ automation: a, onToggle, onUpdateConfig }) {
  const cfg = a.triggerConfig;
  const lastFired = a.lastFiredAt
    ? new Date(a.lastFiredAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "never";

  return (
    <div className="border border-line bg-surface-alt p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Sparkles size={14} className="text-accent-deep shrink-0 translate-y-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-fg">{a.name}</div>
          <p className="text-[12px] text-dim leading-relaxed m-0 mt-1">
            {AUTOMATION_COPY[a.triggerKind] ?? a.triggerKind}
          </p>
          <div className="text-[11px] text-faint mt-1.5">
            Last fired: {lastFired}
          </div>
        </div>
        <Toggle checked={a.enabled} onChange={onToggle} />
      </div>
      {a.triggerKind === "batch_created" && (
        <div className="flex items-center gap-4 flex-wrap pl-7">
          <NumberSetting
            label="Pasture move"
            unit="weeks after arrival"
            value={cfg.pasture_move_weeks ?? 3}
            min={1} max={12}
            onCommit={(v) =>
              onUpdateConfig({ ...cfg, pasture_move_weeks: v })}
          />
          <NumberSetting
            label="Processing"
            unit="weeks after arrival"
            value={cfg.processing_weeks ?? 8}
            min={4} max={20}
            onCommit={(v) =>
              onUpdateConfig({ ...cfg, processing_weeks: v })}
          />
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative w-9 h-5 rounded-full border transition-colors cursor-pointer shrink-0 " +
        (checked
          ? "bg-accent border-accent"
          : "bg-surface border-line")
      }
    >
      <span
        className={
          "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform " +
          (checked
            ? "left-0.5 translate-x-4 bg-on-accent"
            : "left-0.5 bg-dim")
        }
      />
    </button>
  );
}

// Small inline number editor: label + stepper input + unit hint.
// Commits on blur or Enter so half-typed numbers don't thrash the DB.
function NumberSetting({ label, unit, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(null); // null = not editing

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n) && n >= min && n <= max && n !== value) {
      onCommit(Math.round(n));
    }
    setDraft(null);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-[12px] text-fg font-medium">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        className="w-14 bg-surface border border-line px-2 py-1 text-[12px] text-fg font-[inherit] outline-none text-center"
      />
      <span className="text-[11px] text-faint">{unit}</span>
    </label>
  );
}

// ── Notifications section ────────────────────────────────────────────
function NotificationsSection() {
  const {
    support, permission, subscribed, pending, error,
    needsInstall, missingVapid,
    enable, disable,
  } = usePushNotifications();

  const status = describeStatus({
    support, permission, subscribed, needsInstall, missingVapid,
  });

  return (
    <Section title="Notifications" subtitle={pending ? "Working…" : null}>
      <Field
        label={<span className="inline-flex items-center gap-2">
          <Bell size={14} /> Round-done push
        </span>}
        description="When a round flips to done on this device or any other, we'll push a notification with the duration and overrun (if any) to every device that's enabled them."
      >
        <div className="flex items-center gap-3 flex-wrap">
          {subscribed ? (
            <button
              onClick={disable}
              disabled={pending}
              className="inline-flex items-center gap-1.5 bg-surface-alt border border-line text-fg font-[inherit] text-[12px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BellOff size={13} className="shrink-0" /> Disable on this device
            </button>
          ) : (
            <button
              onClick={enable}
              disabled={pending || support !== "ok" || permission === "denied"
                || needsInstall || missingVapid}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[12px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Bell size={13} className="shrink-0" /> Enable on this device
            </button>
          )}
          <span className="text-[11px] text-dim">{status}</span>
        </div>
        {error && (
          <div className="text-[11px] text-warn mt-2">
            {error.message ?? String(error)}
          </div>
        )}
      </Field>
    </Section>
  );
}

function describeStatus({
  support, permission, subscribed, needsInstall, missingVapid,
}) {
  if (support !== "ok") {
    return "This browser doesn't support web push.";
  }
  if (missingVapid) {
    return "Set VITE_VAPID_PUBLIC_KEY (and the function's private key) in env to use push.";
  }
  if (needsInstall) {
    return "iOS only delivers push to installed PWAs — Add to Home Screen first, then re-open from the home-screen icon.";
  }
  if (permission === "denied") {
    return "Notifications are blocked for this site. Re-enable them in your browser's site settings, then come back.";
  }
  if (subscribed) return "Push enabled on this device.";
  if (permission === "granted") return "Permission granted — tap to subscribe.";
  return "No push subscription on this device yet.";
}

function Section({ title, subtitle, children }) {
  return (
    <section className="bg-surface border border-line p-5 flex flex-col gap-5">
      <header className="flex items-baseline gap-3">
        <div className="font-ui text-xs text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-faint">{subtitle}</div>}
      </header>
      {children}
    </section>
  );
}

function Field({ label, description, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium text-fg">{label}</label>
      {description && (
        <p className="text-[12px] text-dim leading-relaxed m-0">{description}</p>
      )}
      <div>{children}</div>
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="inline-flex border border-line bg-surface-alt">
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={
              "px-3 py-1.5 text-[12px] font-medium border-0 cursor-pointer " +
              (active
                ? "bg-surface text-fg shadow-[inset_0_-2px_0_0_var(--c-accent)]"
                : "bg-transparent text-dim hover:text-fg") +
              (i > 0 ? " border-l border-line" : "")
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

