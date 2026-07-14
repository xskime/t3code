import { useEffect, useRef } from "react";

import {
  canSpawnShooter,
  CONSTELLATION_SETTINGS,
  createStars,
  isShooterExpired,
  nextShooterDelayMs,
  type Shooter,
  shooterFade,
  spawnShooter,
  type Star,
  stepShooter,
  twinkleAlpha,
} from "./ConstellationBackground.logic";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "~/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAX_FRAME_DELTA_SECONDS = 0.05;
const INITIAL_SHOOTER_SETTLE_MS = 1500;
const DEFAULT_STAR_RGB = "255, 255, 255";
const SHOOTER_HEAD_RADIUS = 1.4;
const SHOOTER_LINE_WIDTH = 1.3;
const SHOOTER_HEAD_ALPHA = 0.9;
const SHOOTER_TRAIL_ALPHA = 0.85;

/** Parses a canvas's computed `color` ("rgb(r, g, b)" / "rgba(r, g, b, a)") into an "r, g, b" triple. */
function parseStarRgb(color: string): string {
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color);
  if (!match) return DEFAULT_STAR_RGB;
  return `${match[1]}, ${match[2]}, ${match[3]}`;
}

/**
 * Absolutely-positioned canvas starfield for idle surfaces (splash, empty state, pairing).
 * Purely decorative: no pointer interaction, no accessibility surface. All star/shooter math
 * lives in `ConstellationBackground.logic.ts`; this component only owns the canvas/rAF/
 * ResizeObserver/visibility lifecycle. Under prefers-reduced-motion the field is drawn once
 * (no rAF loop) and only redrawn on resize or theme change.
 */
export function ConstellationBackground({ className }: { className?: string } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const parentEl = canvasEl?.parentElement;
    if (!canvasEl || !parentEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const parent: HTMLElement = parentEl;
    const maybeContext = canvas.getContext("2d");
    if (!maybeContext) return;
    const context: CanvasRenderingContext2D = maybeContext;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let shooters: Shooter[] = [];
    let nextShooterAt = 0;
    let last = performance.now();
    let running = true;
    let frameId: number | null = null;
    let starRgb = parseStarRgb(getComputedStyle(canvas).color);

    function resizeAndReseed() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars({ width, height, settings: CONSTELLATION_SETTINGS });
    }

    function scheduleNextShooter(now: number) {
      nextShooterAt = now + nextShooterDelayMs(CONSTELLATION_SETTINGS);
    }

    function drawStars(timeSeconds: number, dtSeconds: number, staticField: boolean) {
      const driftX =
        Math.cos(CONSTELLATION_SETTINGS.driftAngle) * CONSTELLATION_SETTINGS.driftSpeed;
      const driftY =
        Math.sin(CONSTELLATION_SETTINGS.driftAngle) * CONSTELLATION_SETTINGS.driftSpeed;
      for (const star of stars) {
        if (!staticField) {
          star.x += driftX * star.z * dtSeconds;
          star.y += driftY * star.z * dtSeconds;
          if (star.x > width + 4) star.x -= width + 8;
          if (star.x < -4) star.x += width + 8;
          if (star.y > height + 4) star.y -= height + 8;
          if (star.y < -4) star.y += height + 8;
        }
        const alpha = staticField
          ? star.baseAlpha
          : twinkleAlpha(star, timeSeconds, CONSTELLATION_SETTINGS.twinkleAmount);
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${starRgb}, ${alpha.toFixed(3)})`;
        context.fill();
      }
    }

    /** Reduced-motion path: one static frame, no drift/twinkle/shooters, no rAF loop. */
    function drawStaticField() {
      context.clearRect(0, 0, width, height);
      drawStars(0, 0, true);
    }

    function drawShooters(now: number, dtSeconds: number) {
      if (now >= nextShooterAt) {
        if (canSpawnShooter(shooters.length, CONSTELLATION_SETTINGS)) {
          shooters.push(spawnShooter({ width, height, settings: CONSTELLATION_SETTINGS }));
        }
        scheduleNextShooter(now);
      }

      const survivors: Shooter[] = [];
      for (const shooter of shooters) {
        const stepped = stepShooter(shooter, dtSeconds);
        if (isShooterExpired(stepped, width, height)) continue;
        survivors.push(stepped);

        const fade = shooterFade(stepped);
        const tailX = stepped.x - stepped.dx * stepped.trail;
        const tailY = stepped.y - stepped.dy * stepped.trail;
        const gradient = context.createLinearGradient(stepped.x, stepped.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(${starRgb}, ${(SHOOTER_TRAIL_ALPHA * fade).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${starRgb}, 0)`);
        context.strokeStyle = gradient;
        context.lineWidth = SHOOTER_LINE_WIDTH;
        context.beginPath();
        context.moveTo(stepped.x, stepped.y);
        context.lineTo(tailX, tailY);
        context.stroke();

        context.beginPath();
        context.arc(stepped.x, stepped.y, SHOOTER_HEAD_RADIUS, 0, Math.PI * 2);
        context.fillStyle = `rgba(${starRgb}, ${(SHOOTER_HEAD_ALPHA * fade).toFixed(3)})`;
        context.fill();
      }
      shooters = survivors;
    }

    function step(now: number) {
      if (!running) return;
      const dtSeconds = Math.min((now - last) / 1000, MAX_FRAME_DELTA_SECONDS);
      last = now;

      context.clearRect(0, 0, width, height);
      drawStars(now / 1000, dtSeconds, false);
      drawShooters(now, dtSeconds);

      frameId = requestAnimationFrame(step);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        running = false;
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      } else if (!running) {
        running = true;
        last = performance.now();
        frameId = requestAnimationFrame(step);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeAndReseed();
      if (reducedMotion) drawStaticField();
    });
    resizeObserver.observe(parent);

    const colorMutationObserver = new MutationObserver(() => {
      starRgb = parseStarRgb(getComputedStyle(canvas).color);
      if (reducedMotion) drawStaticField();
    });
    colorMutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resizeAndReseed();

    if (reducedMotion) {
      drawStaticField();
    } else {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      // Let the surface settle before the first shooter, mirroring the prototype's 1.5s delay.
      scheduleNextShooter(performance.now() + INITIAL_SHOOTER_SETTLE_MS);
      frameId = requestAnimationFrame(step);
    }

    return () => {
      running = false;
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      colorMutationObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}
