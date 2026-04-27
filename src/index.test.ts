import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("agentic-bookkeeper", () => {
  it("exposes a semver-shaped VERSION constant", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/);
  });
});
