import { afterEach, describe, expect, it } from "vitest";
import { interpolateEnvVars } from "../utils.js";

describe("interpolateEnvVars", () => {
  afterEach(() => {
    delete process.env.PORT;
    delete process.env.TIDEWAVE_PORT;
    delete process.env.API_TOKEN;
  });

  it("replaces bare $VAR references", () => {
    process.env.PORT = "4567";

    expect(interpolateEnvVars("http://localhost:$PORT/tidewave/mcp")).toBe(
      "http://localhost:4567/tidewave/mcp"
    );
  });

  it("supports ${VAR:-default} fallbacks", () => {
    expect(interpolateEnvVars("http://localhost:${TIDEWAVE_PORT:-4000}/tidewave/mcp")).toBe(
      "http://localhost:4000/tidewave/mcp"
    );
  });

  it("prefers the environment value over ${VAR:-default}", () => {
    process.env.TIDEWAVE_PORT = "4321";

    expect(interpolateEnvVars("http://localhost:${TIDEWAVE_PORT:-4000}/tidewave/mcp")).toBe(
      "http://localhost:4321/tidewave/mcp"
    );
  });

  it("keeps existing ${VAR} and $env:VAR interpolation working", () => {
    process.env.PORT = "4100";
    process.env.API_TOKEN = "secret";

    expect(interpolateEnvVars("http://localhost:${PORT}/tidewave/mcp?token=$env:API_TOKEN")).toBe(
      "http://localhost:4100/tidewave/mcp?token=secret"
    );
  });
});
