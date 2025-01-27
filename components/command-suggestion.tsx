import { BotIcon } from "lucide-react";
import { Bot } from "@/lib/types";

interface CommandSuggestionsProps {
  suggestions: Bot[];
  isVisible: boolean;
  searchTerm: string;
  onSelect: (bot: Bot) => void;
  highlightedIndex: number;
}

export const CommandSuggestions = ({
  suggestions,
  isVisible,
  searchTerm,
  onSelect,
  highlightedIndex,
}: CommandSuggestionsProps) => {
  if (!isVisible) return null;

  const filteredSuggestions = suggestions?.filter((bot) =>
    bot.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredSuggestions?.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-1 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto p-3">
      {filteredSuggestions?.map((bot, index) => (
        <div
          key={bot.id}
          onClick={() => onSelect(bot)}
          className={`flex items-center p-1 m-1 sm:p-2 hover:bg-muted cursor-pointer rounded-md sm:m-2  ${
            index === highlightedIndex ? "bg-muted" : ""
          }`}
        >
          <BotIcon className="mr-2 h-4 w-4" />
          <div>
            <div className="font-medium">{bot.name}</div>
            <div className="text-sm text-muted-foreground">
              {bot.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
