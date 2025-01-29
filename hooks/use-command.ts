"use client";

import { customFetch } from "@/lib/customFetch";
import { Bot } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

interface UseCommandInputProps {
  input: string;
  setInput: (value: string) => void;
  onBotSelect: (botId: string) => void;
}

export const useCommandInput = ({
  input,
  setInput,
  onBotSelect,
}: UseCommandInputProps) => {
  const [allBots, setAllBots] = useState<Bot[]>([]);
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<{
    name: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    const fetchBots = async () => {
      const response = await customFetch("http://localhost:8000/api/v1/bot/");
      const data = await response.data;
      setAllBots(data.items);
    };
    fetchBots();
  }, []);

  useEffect(() => {
    if (!input.startsWith("/")) {
      setIsCommandMode(false);
      if (activeCommand) {
        setActiveCommand(null);
      }
      return;
    }

    const [command, ...rest] = input.split(" ");
    const cleanCommand = command.slice(1);

    // show suggestions when typing command
    if (!activeCommand || rest.length === 0) {
      setIsCommandMode(true);
    }

    const matchedBot = allBots?.find(
      (bot) => bot.name.toLowerCase() === cleanCommand.toLowerCase()
    );

    if (matchedBot) {
      if (!activeCommand && input.endsWith(" ")) {
        setActiveCommand({ name: matchedBot.name, id: matchedBot.id });
        onBotSelect(matchedBot.id);
        setIsCommandMode(false);
      }
      // keep command active if it's already set
      else if (activeCommand?.id === matchedBot.id) {
        setIsCommandMode(false);
      }
    } else if (input.startsWith("/")) {
      setActiveCommand(null);
    }
  }, [input, allBots, activeCommand, onBotSelect]);

  const handleSelect = useCallback(
    (bot: Bot) => {
      setActiveCommand({ name: bot.name, id: bot.id });
      onBotSelect(bot.id);
      setInput(`/${bot.name} `);
      setIsCommandMode(false);
    },
    [setInput, onBotSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && isCommandMode) {
        e.preventDefault();
        const filteredBots = allBots?.filter((bot) =>
          bot.name.toLowerCase().includes(input.slice(1).toLowerCase())
        );
        if (filteredBots?.[highlightedIndex]) {
          handleSelect(filteredBots[highlightedIndex]);
        }
        return;
      }

      if (!isCommandMode) return;

      const filteredBots = allBots?.filter((bot) =>
        bot.name.toLowerCase().includes(input.slice(1).toLowerCase())
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex(
            (prev) => (prev + 1) % (filteredBots?.length || 1)
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex(
            (prev) =>
              (prev - 1 + (filteredBots?.length || 1)) %
              (filteredBots?.length || 1)
          );
          break;

        case "Escape":
          setIsCommandMode(false);
          break;

        case "Backspace":
          if (activeCommand) {
            const commandPrefix = `/${activeCommand.name}`;

            // check if input exactly matches command (with or without space)
            if (input === commandPrefix || input === `${commandPrefix} `) {
              setActiveCommand(null);
              onBotSelect("");
              setInput("");
              e.preventDefault();
              break;
            }

            // check if cursor is at the end of the command
            const selectionEnd = (e.target as HTMLTextAreaElement).selectionEnd;
            if (selectionEnd === commandPrefix.length) {
              setActiveCommand(null);
              onBotSelect("");
              setInput("");
              e.preventDefault();
              break;
            }
            if (
              input.startsWith(commandPrefix) &&
              input.length <= commandPrefix.length
            ) {
              setActiveCommand(null);
              onBotSelect("");
              setInput("");
              e.preventDefault();
            }
          }
          break;
      }
    },
    [
      isCommandMode,
      input,
      allBots,
      highlightedIndex,
      handleSelect,
      activeCommand,
      onBotSelect,
    ]
  );

  const getProcessedInput = useCallback(() => {
    if (!input.startsWith("/") || !activeCommand) return input;
    return input.slice(activeCommand.name.length + 2).trim();
  }, [input, activeCommand]);

  return {
    suggestions: allBots?.filter((bot) =>
      bot.name.toLowerCase().includes(input.slice(1).toLowerCase())
    ),
    isCommandMode,
    onBotSelect,
    setActiveCommand,
    highlightedIndex,
    handleKeyDown,
    handleSelect,
    activeCommand,
    getProcessedInput,
    allBots,
  };
};
