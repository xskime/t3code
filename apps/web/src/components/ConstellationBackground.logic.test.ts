import { describe, expect, it } from "vite-plus/test";
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

/** Cycles through a fixed sequence of values so tests get varied-but-deterministic randoms. */
function cyclicRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index += 1;
    return value;
  };
}

function makeStar(overrides: Partial<Star> = {}): Star {
  return {
    x: 0,
    y: 0,
    z: 1,
    r: 1,
    baseAlpha: 0.6,
    twinklePhase: 0,
    twinkleSpeed: 0.5,
    ...overrides,
  };
}

function makeShooter(overrides: Partial<Shooter> = {}): Shooter {
  return {
    x: 0,
    y: 0,
    dx: 1,
    dy: 0,
    speed: 500,
    life: 0,
    maxLife: 1,
    trail: 100,
    ...overrides,
  };
}

describe("createStars", () => {
  it("splits the star count across the three depth layers by 45/35/20% share (±1 rounding tolerance)", () => {
    const width = 800;
    const height = 600;
    const stars = createStars({
      width,
      height,
      settings: CONSTELLATION_SETTINGS,
      random: cyclicRandom([0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]),
    });

    const countByLayer = new Map<number, number>();
    for (const star of stars) {
      countByLayer.set(star.z, (countByLayer.get(star.z) ?? 0) + 1);
    }

    const expectedShares: Array<[z: number, share: number]> = [
      [0.35, 0.45],
      [0.65, 0.35],
      [1.0, 0.2],
    ];
    for (const [z, share] of expectedShares) {
      const expected = Math.round(CONSTELLATION_SETTINGS.starCount * share);
      const actual = countByLayer.get(z) ?? 0;
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps every star's radius, baseAlpha, and twinkleSpeed within the constraint formula bounds", () => {
    const width = 800;
    const height = 600;
    const stars = createStars({
      width,
      height,
      settings: CONSTELLATION_SETTINGS,
      random: cyclicRandom([0, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1]),
    });

    expect(stars.length).toBeGreaterThan(0);
    for (const star of stars) {
      const radiusMin = 0.35 * CONSTELLATION_SETTINGS.starSize * star.z;
      const radiusMax = 1.0 * CONSTELLATION_SETTINGS.starSize * star.z;
      expect(star.r).toBeGreaterThanOrEqual(radiusMin - 1e-9);
      expect(star.r).toBeLessThanOrEqual(radiusMax + 1e-9);

      const alphaMin = 0.35 * (0.45 + 0.55 * star.z);
      const alphaMax = 0.85 * (0.45 + 0.55 * star.z);
      expect(star.baseAlpha).toBeGreaterThanOrEqual(alphaMin - 1e-9);
      expect(star.baseAlpha).toBeLessThanOrEqual(alphaMax + 1e-9);

      expect(star.twinkleSpeed).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(star.twinkleSpeed).toBeLessThanOrEqual(1.2 + 1e-9);

      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(width);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(height);
    }
  });
});

describe("twinkleAlpha", () => {
  it("stays within [0.05, baseAlpha] across a sampled time sweep", () => {
    const star = makeStar({ baseAlpha: 0.7, twinklePhase: 1.234, twinkleSpeed: 0.9 });
    for (let t = 0; t <= 30; t += 0.37) {
      const alpha = twinkleAlpha(star, t, CONSTELLATION_SETTINGS.twinkleAmount);
      expect(alpha).toBeGreaterThanOrEqual(0.05);
      expect(alpha).toBeLessThanOrEqual(star.baseAlpha + 1e-9);
    }
  });

  it("differs between two stars with different phases at the same time", () => {
    const starA = makeStar({ twinklePhase: 0, twinkleSpeed: 0.6 });
    const starB = makeStar({ twinklePhase: Math.PI / 2, twinkleSpeed: 0.6 });
    const alphaA = twinkleAlpha(starA, 1.5, 0.55);
    const alphaB = twinkleAlpha(starB, 1.5, 0.55);
    expect(Math.abs(alphaA - alphaB)).toBeGreaterThan(1e-6);
  });
});

describe("nextShooterDelayMs", () => {
  it("hits exactly shooterMinGapMs at random()=0 and shooterMaxGapMs at random()=1", () => {
    expect(nextShooterDelayMs(CONSTELLATION_SETTINGS, () => 0)).toBe(
      CONSTELLATION_SETTINGS.shooterMinGapMs,
    );
    expect(nextShooterDelayMs(CONSTELLATION_SETTINGS, () => 1)).toBe(
      CONSTELLATION_SETTINGS.shooterMaxGapMs,
    );
  });

  it("stays within the [min, max] window for intermediate random values", () => {
    const delay = nextShooterDelayMs(CONSTELLATION_SETTINGS, () => 0.42);
    expect(delay).toBeGreaterThanOrEqual(CONSTELLATION_SETTINGS.shooterMinGapMs);
    expect(delay).toBeLessThanOrEqual(CONSTELLATION_SETTINGS.shooterMaxGapMs);
  });
});

describe("canSpawnShooter", () => {
  it("is false once the active count reaches the cap, true below it", () => {
    expect(canSpawnShooter(2, CONSTELLATION_SETTINGS)).toBe(false);
    expect(canSpawnShooter(0, CONSTELLATION_SETTINGS)).toBe(true);
    expect(canSpawnShooter(1, CONSTELLATION_SETTINGS)).toBe(true);
  });
});

describe("spawnShooter", () => {
  const width = 800;
  const height = 600;
  const baseAngle = CONSTELLATION_SETTINGS.driftAngle + Math.PI;

  function angleDeltaFromBase(shooter: Shooter): number {
    const angle = Math.atan2(shooter.dy, shooter.dx);
    return Math.atan2(Math.sin(angle - baseAngle), Math.cos(angle - baseAngle));
  }

  it("aims within ±0.175 rad of driftAngle + π ((random−0.5)×0.35), hitting the extremes at random()=0/1", () => {
    const low = spawnShooter({ width, height, settings: CONSTELLATION_SETTINGS, random: () => 0 });
    const high = spawnShooter({ width, height, settings: CONSTELLATION_SETTINGS, random: () => 1 });
    const mid = spawnShooter({
      width,
      height,
      settings: CONSTELLATION_SETTINGS,
      random: () => 0.5,
    });

    expect(angleDeltaFromBase(low)).toBeCloseTo(-0.175, 5);
    expect(angleDeltaFromBase(high)).toBeCloseTo(0.175, 5);
    expect(angleDeltaFromBase(mid)).toBeCloseTo(0, 5);
  });

  it("keeps speed within 420-680 px/s", () => {
    for (const randomValue of [0, 0.25, 0.5, 0.75, 1]) {
      const shooter = spawnShooter({
        width,
        height,
        settings: CONSTELLATION_SETTINGS,
        random: () => randomValue,
      });
      expect(shooter.speed).toBeGreaterThanOrEqual(420 - 1e-9);
      expect(shooter.speed).toBeLessThanOrEqual(680 + 1e-9);
    }
  });
});

describe("stepShooter", () => {
  it("advances position by velocity * dt and accumulates life", () => {
    const shooter = makeShooter({ x: 10, y: 20, dx: 1, dy: 0, speed: 100, life: 0.2 });
    const next = stepShooter(shooter, 0.5);
    expect(next.x).toBeCloseTo(60, 5);
    expect(next.y).toBeCloseTo(20, 5);
    expect(next.life).toBeCloseTo(0.7, 5);
    // stepShooter must not mutate its input.
    expect(shooter.x).toBe(10);
    expect(shooter.life).toBeCloseTo(0.2, 5);
  });
});

describe("shooterFade", () => {
  it("is ~0 at life 0, 1 at mid-life, and ~0 at the end of maxLife", () => {
    const shooter = makeShooter({ maxLife: 1 });
    expect(shooterFade({ ...shooter, life: 0 })).toBeCloseTo(0, 5);
    expect(shooterFade({ ...shooter, life: 0.5 })).toBeCloseTo(1, 5);
    expect(shooterFade({ ...shooter, life: 1 })).toBeCloseTo(0, 5);
  });

  it("ramps in over the first 15% of life and out over the last 30%", () => {
    const shooter = makeShooter({ maxLife: 1 });
    expect(shooterFade({ ...shooter, life: 0.075 })).toBeCloseTo(0.5, 5);
    expect(shooterFade({ ...shooter, life: 0.15 })).toBeCloseTo(1, 5);
    expect(shooterFade({ ...shooter, life: 0.7 })).toBeCloseTo(1, 5);
    expect(shooterFade({ ...shooter, life: 0.85 })).toBeCloseTo(0.5, 5);
  });
});

describe("isShooterExpired", () => {
  it("expires once life reaches maxLife", () => {
    const shooter = makeShooter({ x: 100, y: 100, life: 1, maxLife: 1 });
    expect(isShooterExpired(shooter, 800, 600)).toBe(true);
  });

  it("expires once it drifts far enough off-screen even mid-life", () => {
    const shooter = makeShooter({ x: -500, y: 100, life: 0.1, maxLife: 1 });
    expect(isShooterExpired(shooter, 800, 600)).toBe(true);
  });

  it("stays alive mid-flight and on-screen", () => {
    const shooter = makeShooter({ x: 400, y: 300, life: 0.4, maxLife: 1 });
    expect(isShooterExpired(shooter, 800, 600)).toBe(false);
  });
});
