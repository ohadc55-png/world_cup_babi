// Agent API — wrapper דק סביב api<T>() הקיים.
// משתמש ב-Bearer JWT (auth: 'session') כברירת מחדל — אותו דבר כמו כל endpoint protected.

import { api } from "./api";
import type { AgentChatResponse, AgentHistoryResponse } from "@/types";

export const agentApi = {
  sendMessage(message: string): Promise<AgentChatResponse> {
    return api<AgentChatResponse>("/api/agent/chat", {
      method: "POST",
      body: { message },
    });
  },

  getHistory(): Promise<AgentHistoryResponse> {
    return api<AgentHistoryResponse>("/api/agent/history");
  },

  resetConversation(): Promise<void> {
    return api<void>("/api/agent/conversation", { method: "DELETE" });
  },
};
