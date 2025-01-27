import type { Attachment } from "ai";

import { LoaderIcon } from "./icons";
import { Avatar } from "./ui/avatar";
import { FileIcon } from "lucide-react";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: {
  attachment: Attachment;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="flex flex-col gap-2">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex items-center justify-center">
        {isUploading ? (
          <div className="animate-spin text-zinc-500">
            <LoaderIcon />
          </div>
        ) : (
          <div className="text-muted-foreground">
            <FileIcon className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
