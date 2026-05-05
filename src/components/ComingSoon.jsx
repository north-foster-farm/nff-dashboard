import { Sparkles } from "lucide-react";

export default function ComingSoon({ featureName }) {
  return (
    <div className="flex items-center justify-center min-h-[360px] p-8">
      <div className="bg-surface border border-line py-10 px-12 text-center max-w-[480px]">
        <Sparkles size={28} className="text-accent mb-3.5 mx-auto" />
        <div className="font-heading text-[22px] font-bold tracking-tight text-fg mb-2">
          {featureName ? `${featureName} — coming soon` : "Coming soon"}
        </div>
        <div className="text-xs text-dim leading-relaxed">
          This page is on the roadmap. Check back after the next batch
          lands.
        </div>
      </div>
    </div>
  );
}
