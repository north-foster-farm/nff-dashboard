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

