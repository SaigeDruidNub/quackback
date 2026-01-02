import type { Message } from "./message";

export interface Conversation {
  _id?: string;
  title?: string;
  messages: Message[];
  createdAt?: string;
  updatedAt?: string;
}
