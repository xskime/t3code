/**
 * Pure math for the constellation starfield background: settings, star generation,
 * twinkle modulation, and shooting-star spawn/step/fade. No DOM/canvas access lives here —
 * `ConstellationBackground.tsx` owns the canvas/rAF/ResizeObserver lifecycle and calls into
 * this module every frame.
 *
 * Ported verbatim from the approved prototype (constants restated in the implementation plan's
 * "Global Constraints").
 */

export interface ConstellationSettings {
  readonly starCount: number;
  readonly driftSpeed: number;
  readonly driftAngle: number;
  readonly twinkleAmount: number;
  readonly starSize: number;
  readonly shooterMinGapMs: number;
  readonly shooterMaxGapMs: number;
  readonly shooterMax: number;
}

export const CONSTELLATION_SETTINGS: ConstellationSettings = {
  starCount: 190,
  driftSpeed: 8,
  driftAngle: -Math.PI / 5,
  twinkleAmount: 0.55,
  starSize: 1.3,
  shooterMinGapMs: 3000,
  shooterMaxGapMs: 15000,
  shooterMax: 2,
};

interface StarLayer {
  readonly z: number;
  readonly share: number;
}

// Three depth layers: far stars are smaller, dimmer, and drift slower (scaled by `z`).
const STAR_LAYERS: readonly StarLayer[] = [
  { z: 0.35, share: 0.45 },
  { z: 0.65, share: 0.35 },
  { z: 1.0, share: 0.2 },
];

export interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export function createStars(input: {
  width: number;
  height: number;
  settings: ConstellationSettings;
  random?: () => number;
}): Star[] {
  const { width, height, settings } = input;
  const random = input.random ?? Math.random;
  const stars: Star[] = [];
  for (const layer of STAR_LAYERS) {
    const count = Math.round(settings.starCount * layer.share);
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: random() * width,
        y: random() * height,
        z: layer.z,
        r: (0.35 + random() * 0.65) * settings.starSize * layer.z,
        baseAlpha: (0.35 + random() * 0.5) * (0.45 + 0.55 * layer.z),
        twinklePhase: random() * Math.PI * 2,
        twinkleSpeed: 0.3 + random() * 0.9,
      });
    }
  }
  return stars;
}

const TWINKLE_ALPHA_FLOOR = 0.05;

export function twinkleAlpha(star: Star, timeSeconds: number, twinkleAmount: number): number {
  const modulation =
    1 -
    twinkleAmount *
      (0.5 +
        0.5 * Math.sin(timeSeconds * star.twinkleSpeed * Math.PI * 2 * 0.25 + star.twinklePhase));
  return Math.max(TWINKLE_ALPHA_FLOOR, star.baseAlpha * modulation);
}

export function nextShooterDelayMs(
  settings: ConstellationSettings,
  random: () => number = Math.random,
): number {
  return (
    settings.shooterMinGapMs + random() * (settings.shooterMaxGapMs - settings.shooterMinGapMs)
  );
}

export function canSpawnShooter(activeShooters: number, settings: ConstellationSettings): boolean {
  return activeShooters < settings.shooterMax;
}

export interface Shooter {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  life: number;
  maxLife: number;
  trail: number;
}

const SHOOTER_ANGLE_JITTER_SPAN = 0.35; // (random - 0.5) * span → ±0.175 rad, per the prototype
const SHOOTER_MIN_SPEED = 420;
const SHOOTER_SPEED_RANGE = 260;
const SHOOTER_MIN_LIFE_SECONDS = 0.9;
const SHOOTER_LIFE_RANGE_SECONDS = 0.5;
const SHOOTER_MIN_TRAIL = 90;
const SHOOTER_TRAIL_RANGE = 70;
const SHOOTER_SPAWN_MARGIN = 40;
const SHOOTER_FADE_IN_END = 0.15;
const SHOOTER_FADE_OUT_START = 0.7;

export function spawnShooter(input: {
  width: number;
  height: number;
  settings: ConstellationSettings;
  random?: () => number;
}): Shooter {
  const { width, height, settings } = input;
  const random = input.random ?? Math.random;

  // Shooters fly opposite the ambient drift, with jitter so they don't all share one line.
  const jitter = (random() - 0.5) * SHOOTER_ANGLE_JITTER_SPAN;
  const angle = settings.driftAngle + Math.PI + jitter;
  const speed = SHOOTER_MIN_SPEED + random() * SHOOTER_SPEED_RANGE;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Enter from the edge the motion comes from, so the shooter's whole flight stays on screen.
  let x: number;
  let y: number;
  if (Math.abs(dx) > Math.abs(dy)) {
    x = dx > 0 ? -SHOOTER_SPAWN_MARGIN : width + SHOOTER_SPAWN_MARGIN;
    y = random() * height;
  } else {
    y = dy > 0 ? -SHOOTER_SPAWN_MARGIN : height + SHOOTER_SPAWN_MARGIN;
    x = random() * width;
  }

  return {
    x,
    y,
    dx,
    dy,
    speed,
    life: 0,
    maxLife: SHOOTER_MIN_LIFE_SECONDS + random() * SHOOTER_LIFE_RANGE_SECONDS,
    trail: SHOOTER_MIN_TRAIL + random() * SHOOTER_TRAIL_RANGE,
  };
}

export function stepShooter(shooter: Shooter, dtSeconds: number): Shooter {
  return {
    ...shooter,
    life: shooter.life + dtSeconds,
    x: shooter.x + shooter.dx * shooter.speed * dtSeconds,
    y: shooter.y + shooter.dy * shooter.speed * dtSeconds,
  };
}

/** 0..1 envelope: fades in over the first 15% of life, holds at 1, fades out over the last 30%. */
export function shooterFade(shooter: Shooter): number {
  const progress = shooter.life / shooter.maxLife;
  if (progress < SHOOTER_FADE_IN_END) return progress / SHOOTER_FADE_IN_END;
  if (progress > SHOOTER_FADE_OUT_START) return (1 - progress) / (1 - SHOOTER_FADE_OUT_START);
  return 1;
}

/** True once a shooter has burned through its life or drifted far enough off-screen to cull. */
export function isShooterExpired(shooter: Shooter, width: number, height: number): boolean {
  const offscreenMargin = 200;
  return (
    shooter.life >= shooter.maxLife ||
    shooter.x < -offscreenMargin ||
    shooter.x > width + offscreenMargin ||
    shooter.y < -offscreenMargin ||
    shooter.y > height + offscreenMargin
  );
}
