/**
 * Tool Registry and Dispatcher
 *
 * Registers all function calling tools and dispatches calls
 * from the Gemma 4 reasoning engine.
 */

import { geoCluster } from "./geo-cluster";
import { checkHistory } from "./check-history";
import { assessRisk } from "./assess-risk";
import { updateEvent } from "./update-event";

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolExecutor> = {
  geo_cluster: geoCluster,
  check_history: checkHistory,
  assess_risk: assessRisk,
  update_event: updateEvent,
};

/**
 * Execute a tool by name with the given arguments.
 * Called by the agentic loop in gemma.ts.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const executor = toolRegistry[name];
  if (!executor) {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    return await executor(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Tool ${name} failed: ${message}` };
  }
}
