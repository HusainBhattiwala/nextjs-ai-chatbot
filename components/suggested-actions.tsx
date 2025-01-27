"use client";

import { motion } from "framer-motion";
import { Button } from "./ui/button";
import type { ChatRequestOptions, CreateMessage, Message } from "ai";
import { toast } from "sonner";
import { memo, use } from "react";
import { customFetch } from "@/lib/customFetch";
interface SuggestedActionsProps {
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  chatId: string;
  setCurrentBotId: (botId: string) => void;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

function PureSuggestedActions({
  chatId,
  append,
  isLoading,
  setIsLoading,
  setCurrentBotId,
}: SuggestedActionsProps) {
  const BOT_ID = "4cb58a3e-2e6e-4ed3-a057-a4b5ae18e330";

  const handleClick = async (message: string) => {
    if (isLoading) {
      toast.error("Please wait for the previous action to complete");
      return;
    }

    try {
      setIsLoading(true);

      // First append the user message
      append({
        role: "user",
        content: message,
      });

      const newChat = await customFetch(
        "http://localhost:8000/api/v1/chat/user",
        {
          method: "POST",
          body: JSON.stringify({
            bot_id: BOT_ID,
          }),
        }
      );

      if (!newChat.ok) {
        throw new Error(newChat.data?.error || "Failed to create chat");
      }

      const currentChatId = newChat.data.id;
      // router.push(`/chat/${currentChatId}`);

      const userMessageResponse = await customFetch(
        "http://localhost:8000/api/v1/message/user",
        {
          method: "POST",
          body: JSON.stringify({
            human_query: message,
            chat_id: currentChatId,
            documents: [],
            model: "gpt-3.5-turbo",
          }),
        }
      );

      if (!userMessageResponse.ok) {
        throw new Error(
          userMessageResponse.data?.error || "Failed to send message"
        );
      }

      // Append assistant's response
      await append({
        role: "assistant",
        content: userMessageResponse.data.ai_reply,
      });

      setCurrentBotId(userMessageResponse.data.bot_id);

      const patchChatTitleResponse = await customFetch(
        `http://localhost:8000/api/v1/chat/${currentChatId}/title`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: userMessageResponse.data.title,
          }),
        }
      );

      if (!patchChatTitleResponse.ok) {
        console.error(
          "Failed to set chat title:",
          patchChatTitleResponse.data?.error
        );
      }
      window.history.replaceState({}, "", `/chat/${currentChatId}`);
    } catch (error) {
      console.error("Error in handleClick:", error);
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedActions = [
    {
      title: "What are the advantages",
      label: "of using Next.js?",
      action: "What are the advantages of using Next.js?",
    },
    {
      title: "Write code that",
      label: "demonstrates dijkstra's algorithm",
      action: "Write code that demonstrates dijkstra's algorithm",
    },
    {
      title: "Help me write an essay",
      label: "about Silicon Valley",
      action: "Help me write an essay about Silicon Valley",
    },
    {
      title: "What is the weather",
      label: "in San Francisco?",
      action: "What is the weather in San Francisco?",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-2 w-full">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${index}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            variant="ghost"
            onClick={() => handleClick(suggestedAction.action)}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
            disabled={isLoading}
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
