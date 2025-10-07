export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  id: string;
  role: "assistant";
  content: string;
  analysis?: string;
  sql?: string;
}
