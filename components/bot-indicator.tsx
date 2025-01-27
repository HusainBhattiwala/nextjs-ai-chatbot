import { Avatar } from "@/components/ui/avatar";
import { Bot } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface BotIndicatorProps {
  activeBot: Bot | undefined;
  className?: string;
}

const BotIndicator = ({ activeBot, className }: BotIndicatorProps) => {
  if (!activeBot || activeBot === undefined) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg border bg-background hover:bg-accent cursor-pointer">
          <Avatar className="h-6 w-full">
            <span className="text-md font-medium">
              {activeBot.name.toUpperCase()}
            </span>
          </Avatar>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{activeBot.name}</p>
          {activeBot.description && (
            <p className="text-sm text-muted-foreground">
              {activeBot.description}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default BotIndicator;
