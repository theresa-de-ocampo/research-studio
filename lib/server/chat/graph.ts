import "server-only";

import { HumanMessage } from "@langchain/core/messages";
import { END, MessagesValue, START, StateGraph, StateSchema } from "@langchain/langgraph";
import type { GraphNode } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { getAssistantMessageId } from "@/lib/chat/message-ids";
import { conversationIdSchema } from "@/lib/schemas/chat";
import { getRuntimeCheckpointer } from "@/lib/server/db/checkpointer";
import { readModelConfig } from "@/lib/server/environment";

const stateSchema = new StateSchema({ messages: MessagesValue });

let model: ChatOpenAI | undefined;

const callModel: GraphNode<typeof stateSchema> = async ({ messages }, config) => {
  const userMessage = messages.at(-1);

  if (!HumanMessage.isInstance(userMessage) || userMessage.id === undefined) {
    throw new Error("A model turn requires a user message with a stable ID.");
  }

  const assistantId = getAssistantMessageId(userMessage.id);
  model ??= new ChatOpenAI({
    ...readModelConfig(),
    useResponsesApi: true,
    zdrEnabled: true,
    modelKwargs: { store: false },
  });

  const response = await model.invoke(messages, {
    ...config,
    include: ["reasoning.encrypted_content"],
  });

  response.id = assistantId;
  return { messages: [response] };
};

const graph = new StateGraph(stateSchema)
  .addNode("callModel", callModel)
  .addEdge(START, "callModel")
  .addEdge("callModel", END);

let compiledGraph: ReturnType<typeof graph.compile> | undefined;

export function getConversationGraph() {
  compiledGraph ??= graph.compile({ checkpointer: getRuntimeCheckpointer() });
  return compiledGraph;
}

export function getConversationGraphConfig(conversationId: string, signal?: AbortSignal) {
  return {
    configurable: { thread_id: conversationIdSchema.parse(conversationId) },
    durability: "sync" as const,
    signal,
  };
}
