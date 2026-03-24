import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";

type RequestHandler = (
  request: unknown,
  extra: unknown,
) => Promise<unknown>;

interface ProtocolInternals {
  _requestHandlers?: Map<string, RequestHandler>;
}

/**
 * Pre-computes the tools/list response on first request and caches it,
 * avoiding repeated Zod → JSON Schema conversion on every poll.
 */
export function installToolsListCache(mcpServer: McpServer): void {
  const lowLevel = mcpServer.server as unknown as ProtocolInternals;
  const handlers = lowLevel._requestHandlers;

  if (!handlers) {
    logger.warn("Cannot access _requestHandlers; skipping tools/list cache");
    return;
  }

  const original = handlers.get("tools/list");
  if (!original) {
    logger.warn("tools/list handler not registered; skipping cache");
    return;
  }

  let cached: unknown = null;

  handlers.set("tools/list", async (request, extra) => {
    if (!cached) {
      cached = await original(request, extra);
      logger.debug("tools/list response cached");
    }
    return cached;
  });

  logger.debug("tools/list cache handler installed");
}
