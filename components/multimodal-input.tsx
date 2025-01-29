"use client";

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from "ai";
import cx from "classnames";
import type React from "react";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { generateUUID, sanitizeUIMessages } from "@/lib/utils";
import { ArrowUpIcon, PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { useCommandInput } from "@/hooks/use-command";
import { CommandSuggestions } from "./command-suggestion";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { SuggestedActions } from "./suggested-actions";
import equal from "fast-deep-equal";
import { customFetch } from "@/lib/customFetch";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  setIsLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  // handleSubmit,
  className,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  // handleSubmit: (
  //   event?: {
  //     preventDefault?: () => void;
  //   },
  //   chatRequestOptions?: ChatRequestOptions
  // ) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${
        textareaRef.current.scrollHeight + 2
      }px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  const [currentBotId, setCurrentBotId] = useLocalStorage("currentBotId", "");

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const {
    suggestions,
    isCommandMode,
    highlightedIndex,
    handleKeyDown,
    handleSelect,
    activeCommand,
    getProcessedInput,
    onBotSelect,
    setActiveCommand,
  } = useCommandInput({
    input,
    setInput,
    onBotSelect: (botId) => {
      setCurrentBotId(botId);
    },
  });

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;

    // clear command if input no longer matches
    if (
      activeCommand &&
      !(
        newValue.startsWith(`/${activeCommand.name.toLowerCase()}`) ||
        newValue.startsWith(`/${activeCommand.name}`)
      )
    ) {
      setActiveCommand(null);
      onBotSelect("");
    }

    setInput(newValue);
    adjustHeight();
  };

  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      if (event?.preventDefault) event.preventDefault();

      if (isLoading) {
        toast.error("Please wait for the model to finish its response!");
        return;
      }

      if (!input.trim() && attachments.length === 0) {
        toast.error("Please enter a message or attach a file.");
        return;
      }

      append({
        role: "user",
        content: getProcessedInput(),
      });

      setInput("");
      const currentMessagesLength = messages.length;

      try {
        let currentChatId = chatId;
        let isNewChat = messages.length === 0;

        if (isNewChat) {
          const createChatResponse = await customFetch(
            "http://localhost:8000/api/v1/chat/user",
            {
              method: "POST",
              body: JSON.stringify({
                bot_id: currentBotId,
              }),
            }
          );

          if (!createChatResponse.ok) {
            setMessages((messages) => messages.slice(0, currentMessagesLength));
            toast.error(
              createChatResponse.data?.error || "Failed to create chat"
            );
            console.log(createChatResponse.data);
            setIsLoading(false);
            return;
          }

          currentChatId = createChatResponse.data.id;
        }

        setIsLoading(true);

        const userMessageResponse = await customFetch(
          "http://localhost:8000/api/v1/message/user",
          {
            method: "POST",
            body: JSON.stringify({
              human_query: getProcessedInput(),
              chat_id: currentChatId,
              documents: attachments.map((att) => att.url),
              bot_id: currentBotId,
              model: "gpt-3.5-turbo",
            }),
          }
        );

        if (!userMessageResponse.ok) {
          setMessages((messages) => messages.slice(0, currentMessagesLength));
          toast.error(
            userMessageResponse.data?.error || "Failed to send message"
          );
          setIsLoading(false);
          return;
        }

        setIsLoading(false);

        append({
          role: "assistant",
          content: userMessageResponse.data.ai_reply,
        });

        if (isNewChat) {
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
            toast.error(
              patchChatTitleResponse.data?.error || "Failed to set chat title"
            );
          }
        }
        setLocalStorageInput("");
        window.history.replaceState({}, "", `/chat/${currentChatId}`);

        if (width && width > 768) {
          textareaRef.current?.focus();
        }
      } catch (error) {
        console.error("Error submitting message:", error);
        toast.error("An unexpected error occurred. Please try again.");
        setIsLoading(false);
      }
    },
    [
      chatId,
      input,
      attachments,
      isLoading,
      setInput,
      setAttachments,
      setLocalStorageInput,
      append,
      width,
      currentBotId,
      messages.length,
      getProcessedInput,
    ]
  );

  const getOrCreatePersonalCollection = async (): Promise<string> => {
    try {
      const getCollectionResponse = await customFetch(
        "http://localhost:8000/api/v1/collection/documents?name=personal_docs",
        {
          method: "GET",
        }
      );

      console.log("Get collection response:", getCollectionResponse);

      if (
        getCollectionResponse.ok &&
        Array.isArray(getCollectionResponse.data) &&
        getCollectionResponse.data.length > 0
      ) {
        const firstItem = getCollectionResponse.data[0];
        const collectionId = Object.keys(firstItem)[0];

        if (!collectionId) {
          throw new Error("Collection found but ID is missing");
        }

        console.log("Found collection ID:", collectionId);
        return collectionId;
      }

      console.log("No existing collection found, creating new one");

      const createCollectionResponse = await customFetch(
        "http://localhost:8000/api/v1/collection",
        {
          method: "POST",
          body: JSON.stringify({
            name: "personal_docs",
          }),
        }
      );

      console.log("Create collection response:", createCollectionResponse);

      if (!createCollectionResponse.ok) {
        throw new Error(
          `Failed to create collection: ${
            createCollectionResponse.data?.error || "Unknown error"
          }`
        );
      }

      const newCollectionId = createCollectionResponse.data?.id;
      if (!newCollectionId) {
        throw new Error("Created collection but ID is missing from response");
      }

      return newCollectionId;
    } catch (error) {
      console.error("Detailed error in getOrCreatePersonalCollection:", error);
      throw error;
    }
  };

  const uploadFile = async (file: File) => {
    try {
      let collectionId;
      try {
        collectionId = await getOrCreatePersonalCollection();
      } catch (error) {
        console.error("Failed to get/create collection:", error);
        throw new Error(`Collection error: ${error}`);
      }

      console.log("Using collection ID:", collectionId);

      const jsonBody = {
        source: file.name,
        content_type: file.type,
        filename: file.name,
      };

      const formData = new FormData();
      formData.append("json_body", JSON.stringify(jsonBody));
      formData.append("file", file);

      const response = await customFetch(
        `http://localhost:8000/api/v1/collection/${collectionId}/index`,
        {
          method: "POST",
          body: formData,
        }
      );

      console.log("Full upload response:", response);

      if (!response.ok) {
        console.error("Upload failed with status:", response.status);
        console.error("Error details:", response.data);
        throw new Error(
          response.data?.detail ||
            `Upload failed with status ${response.status}`
        );
      }

      return {
        url: response.data?.id || collectionId,
        name: file.name,
        contentType: file.type,
      };
    } catch (error) {
      console.error("Upload file error:", error);
      throw error;
    }
  };
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment): attachment is NonNullable<typeof attachment> =>
            attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error in handleFileChange:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to upload files";
        toast.error(errorMessage);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments]
  );

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            append={append}
            chatId={chatId}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            setCurrentBotId={setCurrentBotId}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-scroll items-end">
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: "",
                name: filename,
                contentType: "",
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <CommandSuggestions
          suggestions={suggestions}
          isVisible={isCommandMode}
          searchTerm={input.slice(1)}
          onSelect={handleSelect}
          highlightedIndex={highlightedIndex}
        />
        <div className="relative w-full">
          <div
            className={cx(
              "absolute inset-0 pointer-events-none overflow-hidden",
              "text-base bg-transparent pb-10 dark:border-zinc-700",
              "min-h-[24px] max-h-[calc(75dvh)] resize-none",
              "whitespace-pre-wrap break-words leading-[1.5]",
              "px-3 py-2"
            )}
            aria-hidden
          >
            {activeCommand ? (
              <>
                <span className="text-blue-500">/{activeCommand.name} </span>
                <span className="text-foreground">
                  {input.slice(activeCommand.name.length + 2)}
                </span>
              </>
            ) : (
              input
            )}
          </div>

          <Textarea
            ref={textareaRef}
            placeholder="Send a message..."
            value={input}
            onChange={(e) => {
              handleInput(e);
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }}
            onKeyDown={(e) => {
              handleKeyDown(e);
              if (e.key === "Enter" && !e.shiftKey && !isCommandMode) {
                handleSubmit(e);
              }
            }}
            onScroll={(e) => {
              const target = e.currentTarget;
              const preview = target.previousElementSibling as HTMLDivElement;
              if (preview) {
                preview.scrollTop = target.scrollTop;
                preview.scrollLeft = target.scrollLeft;
              }
            }}
            className={cx(
              "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl",
              "!text-base bg-muted pb-10 dark:border-zinc-700 text-transparent caret-foreground",
              "leading-[1.5]",
              className
            )}
            rows={2}
            autoFocus
          />
        </div>
      </div>
      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
        <AttachmentsButton fileInputRef={fileInputRef} isLoading={isLoading} />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {isLoading ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={handleSubmit}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
