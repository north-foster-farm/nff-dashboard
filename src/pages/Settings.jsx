import { useUserPreferences } from "../lib/data/useUserPreferences.js";
import { Sun, Moon, ALargeSmall } from "lucide-react";

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
    theme, density, autoExpandChoreGroups,
    setTheme, setDensity, setAutoExpandChoreGroups,
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

      <Section title="Chores">
        <Field
          label="Auto-expand chore groups"
          description="When on, chore-group accordions render expanded by default everywhere chores appear. Turn off to start them collapsed."
        >
          <ToggleSwitch
            checked={autoExpandChoreGroups}
            onChange={setAutoExpandChoreGroups}
          />
        </Field>
      </Section>
    </div>
  );
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

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-block w-10 h-6 rounded-full transition-colors " +
        "border-0 cursor-pointer p-0 " +
        (checked ? "bg-accent" : "bg-surface-alt border border-line")
      }
    >
      <span
        className={
          "absolute top-0.5 w-5 h-5 rounded-full bg-bg transition-[left] duration-150 " +
          (checked ? "left-[18px]" : "left-0.5")
        }
      />
    </button>
  );
}
