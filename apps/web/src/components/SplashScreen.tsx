import { useEffect, useState } from "react";

import { APP_STAGE_LABEL } from "../branding";
import { resolveAppChannel } from "../branding.logic";

const ROOT = "~/x/ski/";
const APP = "code";
const TYPE_INTERVAL_MS = 40;
const MOUNT_PAUSE_MS = 520;

type SplashPhase = "typing" | "mounting" | "resolved";

function StaticMark({ channel }: { channel: string }) {
  return (
    <span className="whitespace-nowrap font-brand text-[15px] font-medium text-foreground">
      <span className="opacity-40">{ROOT}</span>
      {APP}
      <span className="opacity-40">/{channel}</span>
    </span>
  );
}

export function SplashScreen() {
  const channel = resolveAppChannel({ stageLabel: APP_STAGE_LABEL });
  const command = `cd ${ROOT}${APP}/${channel}`;
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState<SplashPhase>(prefersReducedMotion ? "resolved" : "typing");
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typedLength >= command.length) {
      setPhase("mounting");
      return;
    }
    const timer = setTimeout(() => setTypedLength((length) => length + 1), TYPE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [phase, typedLength, command.length]);

  useEffect(() => {
    if (phase !== "mounting") return;
    const timer = setTimeout(() => setPhase("resolved"), MOUNT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3" aria-label="xski code splash screen">
        {phase === "resolved" ? (
          <StaticMark channel={channel} />
        ) : (
          <span className="whitespace-nowrap font-brand text-[15px] font-medium text-foreground">
            {command.slice(0, typedLength)}
            <span className="ml-px inline-block h-4 w-2 animate-pulse bg-foreground align-text-bottom" />
          </span>
        )}
        <span className="h-4 font-mono text-xs text-muted-foreground">
          {phase === "mounting" ? "mounting directory…" : ""}
        </span>
      </div>
    </div>
  );
}
