import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import * as z from "zod/v4";

vi.mock("open", () => ({
  default: async () => undefined,
}));

const { McpServerManager } = await import("../server-manager.js");

async function startTestServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createMcpExpressApp();

  app.post("/mcp", async (req, res) => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      "greet",
      {
        description: "Test greeting tool",
        inputSchema: {
          name: z.string(),
        },
      },
      async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${name}!` }],
      })
    );

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } finally {
      res.on("close", () => {
        transport.close();
        server.close();
      });
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  const httpServer = await new Promise<import("node:http").Server>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/mcp`,
    close: () => new Promise((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve())),
  };
}

describe("McpServerManager URL interpolation", () => {
  afterEach(() => {
    delete process.env.MCP_TEST_PORT;
  });

  it("connects to HTTP servers using $VAR interpolation in url", async () => {
    const server = await startTestServer();
    const manager = new McpServerManager();
    const port = new URL(server.url).port;
    process.env.MCP_TEST_PORT = port;

    try {
      const connection = await manager.connect("test", {
        url: "http://127.0.0.1:$MCP_TEST_PORT/mcp",
      });

      expect(connection.tools.map((tool) => tool.name)).toContain("greet");
    } finally {
      await manager.closeAll();
      await server.close();
    }
  });

  it("connects to HTTP servers using ${VAR:-default} interpolation in url", async () => {
    const server = await startTestServer();
    const manager = new McpServerManager();
    const port = new URL(server.url).port;

    try {
      const connection = await manager.connect("test", {
        url: `http://127.0.0.1:${"${MCP_TEST_PORT:-" + port + "}"}/mcp`,
      });

      expect(connection.tools.map((tool) => tool.name)).toContain("greet");
    } finally {
      await manager.closeAll();
      await server.close();
    }
  });
});
