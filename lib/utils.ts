import type {
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  Message,
  ToolInvocation,
} from "ai";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Message as DBMessage, Document } from "@/lib/db/schema";
import { ApiMessage } from "./types";
import { customFetch } from "./customFetch";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

// export const fetcher = async (url: string) => {
//   const access_token = localStorage.getItem("access_token");
//   const res = await customFetch(url, {
//     headers: {
//       token: `${access_token}`,
//       entity: "User",
//       "Content-Type": "application/json",
//     },
//   });

//   if (!res.ok) {
//     const error = new Error(
//       "An error occurred while fetching the data."
//     ) as ApplicationError;

//     error.info = await res.json();
//     error.status = res.status;

//     throw error;
//   }

//   return res.json();
// };

export const fetcher = async (url: string) => {
  const response = await customFetch(url);

  if (!response.ok) {
    const error = new Error(
      response.data?.error || "An error occurred while fetching the data."
    ) as ApplicationError;

    error.info = response.data;
    error.status = response.status;

    throw error;
  }

  return response.data;
};

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  return [];
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<Message>;
}): Array<Message> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: "result",
              result: toolResult.result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

// export function convertToUIMessages(
//   messages: Array<DBMessage>
// ): Array<Message> {
//   return messages.reduce((chatMessages: Array<Message>, message) => {
//     if (message.role === "tool") {
//       return addToolMessageToChat({
//         toolMessage: message as CoreToolMessage,
//         messages: chatMessages,
//       });
//     }

//     let textContent = "";
//     const toolInvocations: Array<ToolInvocation> = [];

//     if (typeof message.content === "string") {
//       textContent = message.content;
//     } else if (Array.isArray(message.content)) {
//       for (const content of message.content) {
//         if (content.type === "text") {
//           textContent += content.text;
//         } else if (content.type === "tool-call") {
//           toolInvocations.push({
//             state: "call",
//             toolCallId: content.toolCallId,
//             toolName: content.toolName,
//             args: content.args,
//           });
//         }
//       }
//     }

//     chatMessages.push({
//       id: message.id,
//       role: message.role as Message["role"],
//       content: textContent,
//       toolInvocations,
//     });

//     return chatMessages;
//   }, []);
// }

// Ensure ApiMessage is correctly imported

export function convertToUIMessages(
  apiMessages: Array<ApiMessage>
): Array<Message> {
  return apiMessages?.reduce((chatMessages: Array<Message>, apiMessage) => {
    if (apiMessage.human_query) {
      // Convert human queries to user messages
      chatMessages.push({
        id: apiMessage.id, // Use the ID from ApiMessage
        role: "user", // Define this as a user message
        content: apiMessage.human_query,
        toolInvocations: [], // No tool invocation handling
      });
    }

    if (apiMessage.ai_reply) {
      // Convert AI replies to assistant messages
      chatMessages.push({
        id: generateUUID(), // Optionally generate a new ID or use apiMessage.id
        role: "assistant", // Define this as an assistant message
        content: apiMessage.ai_reply,
        toolInvocations: [], // No tool invocation handling
      });
    }

    return chatMessages;
  }, []);
}

export function sanitizeResponseMessages(
  messages: Array<CoreToolMessage | CoreAssistantMessage>
): Array<CoreToolMessage | CoreAssistantMessage> {
  const toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === "tool") {
      for (const content of message.content) {
        if (content.type === "tool-result") {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== "assistant") return message;

    if (typeof message.content === "string") return message;

    const sanitizedContent = message.content.filter((content) =>
      content.type === "tool-call"
        ? toolResultIds.includes(content.toolCallId)
        : content.type === "text"
        ? content.text.length > 0
        : true
    );

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => message.content.length > 0
  );
}

export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== "assistant") return message;

    if (!message.toolInvocations) return message;

    const toolResultIds: Array<string> = [];

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === "result") {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === "result" ||
        toolResultIds.includes(toolInvocation.toolCallId)
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 ||
      (message.toolInvocations && message.toolInvocations.length > 0)
  );
}

export function getMostRecentUserMessage(messages: Array<CoreMessage>) {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export function getMessageIdFromAnnotations(message: Message) {
  if (!message.annotations) return message.id;

  const [annotation] = message.annotations;
  if (!annotation) return message.id;

  // @ts-expect-error messageIdFromServer is not defined in MessageAnnotation
  return annotation.messageIdFromServer;
}
