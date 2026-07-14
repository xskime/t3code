import { describe, expect, it } from "vite-plus/test";

import { SplashScreen } from "./components/SplashScreen";
import { Route } from "./routes/__root";

describe("root route", () => {
  // Regression guard: SplashScreen was shipped but wired in nowhere, so the typing
  // mount sequence never rendered. The root route is the initial app-shell gate, so its
  // pendingComponent is the seam that shows the splash on startup. If this unmounts
  // again (pendingComponent dropped or repointed), this test fails.
  it("shows the SplashScreen as the initial-load pending component", () => {
    expect(Route.options.pendingComponent).toBe(SplashScreen);
    expect(Route.options.pendingMs).toBe(0);
  });
});
