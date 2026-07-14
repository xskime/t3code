import { type ReactNode, type SVGProps } from "react";
import { cn } from "~/lib/utils";
import { ClaudeAI, CursorIcon, GrokIcon, type Icon, OpenAI, OpenCodeIcon } from "../Icons";
import { type CollabAgentLogoKind } from "./MessagesTimeline.logic";

// Shared lucide-compatible outer-svg attributes (see
// node_modules/lucide-react/dist/esm/defaultAttributes.js) so the
// running↔settled swap against the real lucide icons in WorkEntryIconSvg
// doesn't jump in size/stroke.
const LUCIDE_SVG_PROPS: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export type AnimatedToolIconCategory = "terminal" | "edit" | "read" | "web" | "mcp" | "tool";

/**
 * Animated running glyphs. Category determines the glyph (icon/category
 * branch orders mirror each other by construction — see
 * `workEntryToolCategory`/`workEntryIconName`). Path geometry is copied from
 * the installed lucide-react icons (terminal, square-pen, eye, globe,
 * wrench, hammer) so the running↔settled swap doesn't jump.
 */
export function AnimatedToolIcon(props: {
  category: AnimatedToolIconCategory;
  className?: string;
}): ReactNode {
  const { category, className } = props;
  switch (category) {
    case "terminal":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-terminal", className)} aria-hidden>
          <path d="m4 17 6-6-6-6" />
          <path className="t-cursor" d="M12 19h8" />
        </svg>
      );
    case "edit":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-edit", className)} aria-hidden>
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path
            className="t-pen"
            d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
          />
        </svg>
      );
    case "read":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-read", className)} aria-hidden>
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "web":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-web", className)} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path className="t-meridian" d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case "mcp":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-mcp", className)} aria-hidden>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
        </svg>
      );
    case "tool":
      return (
        <svg {...LUCIDE_SVG_PROPS} className={cn("tool-anim-tool", className)} aria-hidden>
          <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
          <path d="m18 15 4-4" />
          <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
        </svg>
      );
  }
}

const COLLAB_AGENT_LOGO_COMPONENT: Record<CollabAgentLogoKind, Icon> = {
  openai: OpenAI,
  claude: ClaudeAI,
  cursor: CursorIcon,
  grok: GrokIcon,
  opencode: OpenCodeIcon,
};

/** Provider logo for collab agent rows (re-exports from ../Icons). */
export function CollabAgentLogo(props: {
  kind: CollabAgentLogoKind;
  className?: string;
}): ReactNode {
  const LogoComponent = COLLAB_AGENT_LOGO_COMPONENT[props.kind];
  return <LogoComponent className={props.className} aria-hidden />;
}
