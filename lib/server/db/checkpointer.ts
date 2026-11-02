import "server-only";

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import { getRuntimePool } from "./pool";

let checkpointer: PostgresSaver | undefined;

export function getRuntimeCheckpointer(): PostgresSaver {
  if (!checkpointer) {
    // Schema setup belongs to human-managed tooling, never runtime initialization.
    checkpointer = new PostgresSaver(getRuntimePool(), undefined, {
      schema: "langgraph",
    });
  }

  return checkpointer;
}
