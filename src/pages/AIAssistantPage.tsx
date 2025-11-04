import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, History, Paperclip, Plus, Send, StarsIcon, StopCircle, XCircle } from 'lucide-react';
import { SiteHeader } from '../components/site-header';
import { CustomModal } from '../components/ui/custom-modal';
import { ChatsModal } from '../components/ChatsModal';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { apiClient } from '@/lib/api-client';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '../components/ai-elements/conversation';
import { Message, MessageAvatar, MessageContent } from '../components/ai-elements/message';
import { Response } from '../components/ai-elements/response';
import ShimmerText from '../components/kokonutui/shimmer-text';
import { Task, TaskContent, TaskItem, TaskTrigger } from '../components/ai-elements/task';
import {
  PromptInputProvider,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputSpeechButton,
  PromptInputButton,
  PromptInputAttachments,
  PromptInputAttachment,
  type PromptInputMessage,
  usePromptInputAttachments,
  usePromptInputController,
} from '../components/ai-elements/prompt-input';
import { Loader } from '../components/ai-elements/loader';

type MessagePart = {
  type: 'text' | 'tool';
  content: string;
  toolName?: string;
  toolPhase?: 'start' | 'end';
  timestamp?: number;
};

type AttachmentItem = {
  id: string;
  filename: string;
  url?: string;
  mediaType?: string;
};

type ThreadMessageStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'stopped';

type ThreadMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  parts: MessagePart[];
  currentTextPart?: string;
  attachments: AttachmentItem[];
  status: ThreadMessageStatus;
  requiresConfirmation?: boolean;
  timestamp: Date;
};

type ConfirmationState = {
  open: boolean;
    action?: string;
    data?: any;
  message?: string;
};

type ChatComposerProps = {
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onStop: () => void;
  isReady: boolean;
  isStreaming: boolean;
};


const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const ChatComposer = ({ onSubmit, onStop, isReady, isStreaming }: ChatComposerProps) => {
  const attachments = usePromptInputAttachments();
  const controller = usePromptInputController();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = useCallback(
    async (payload: PromptInputMessage) => {
      if (!isReady) return;
      controller.textInput.setInput('');
      attachments.clear();
      await onSubmit(payload);
    },
    [isReady, onSubmit, controller, attachments]
  );

  return (
    <div className="space-y-3" dir="rtl">
      <PromptInputAttachments>
        {(file) => (
          <PromptInputAttachment
            key={file.id}
            data={file}
            className="border focus:border-none border-dashed border-muted-foreground/20 bg-muted/30 text-xs text-muted-foreground"
          />
        )}
      </PromptInputAttachments>
      <PromptInput onSubmit={handleSubmit} className="rounded-3xl bg-muted/20 p-2">
        <PromptInputTextarea
          dir="rtl"
          placeholder="כתוב הודעה..."
          disabled={!isReady}
          className="rounded-3xl bg-background px-4 text-base leading-relaxed"
          onFocus={(event) => {
            textareaRef.current = event.currentTarget;
          }}
        />
        <PromptInputFooter className="px-2 pt-2">
          <div className="flex items-center gap-2">
            <PromptInputButton
              aria-label="צרף מקור"
              variant="ghost"
              size="icon-sm"
              disabled={!isReady && !isStreaming}
              onClick={(event) => {
                event.preventDefault();
                attachments.openFileDialog();
              }}
            >
              <Paperclip className="size-4" />
            </PromptInputButton>
            <PromptInputSpeechButton
              textareaRef={textareaRef}
              onTranscriptionChange={(value) => controller.textInput.setInput(value)}
              disabled={!isReady}
            />
          </div>
          <PromptInputSubmit
            status={isStreaming ? 'streaming' : undefined}
            disabled={!isReady && !isStreaming}
            onClick={(event) => {
              if (isStreaming) {
                event.preventDefault();
                onStop();
              }
            }}
          >
            {isStreaming ? <StopCircle className="size-4" /> : <Send className="size-4" />}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};


export function AIAssistantPage() {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [chatsModalOpen, setChatsModalOpen] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationState>({ open: false });
  const activeStreamRef = useRef<string | null>(null);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);

  const hasMessages = messages.length > 0;
  const isStreaming = !!activeStreamId;

  const generateChatTitle = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 'שיחה חדשה';
    return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
  }, []);

  const createNewChat = useCallback(async (firstMessage?: string) => {
    try {
      const resp = await apiClient.createChat(generateChatTitle(firstMessage ?? ''));
      const created = resp.data;
      if (created?.id) {
        setCurrentChatId(created.id);
        return created.id;
      }
      return null;
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  }, [generateChatTitle]);

  const transformServerMessage = useCallback((raw: any): ThreadMessage | null => {
    if (!raw || typeof raw.type !== 'string' || typeof raw.content !== 'string') return null;
    const parsed = raw.data ? JSON.parse(raw.data) : {};
    const parts = Array.isArray(parsed?.parts) ? parsed.parts : [];
    const attachments = Array.isArray(parsed?.attachments)
      ? parsed.attachments.map((file: any, index: number) => ({
          id: file.id ?? createId(`attachment-${index}`),
          filename: file.filename ?? `קובץ ${index + 1}`,
          url: file.url,
          mediaType: file.mediaType,
        }))
      : [];
    return {
      id: `${raw.type}-${raw.id}`,
      role: raw.type === 'ai' ? 'assistant' : 'user',
      text: raw.content,
      parts,
      currentTextPart: undefined,
      attachments,
      status: 'complete',
      requiresConfirmation: Boolean(parsed?.requiresConfirmation),
      timestamp: new Date(raw.timestamp),
    };
  }, []);

  const loadChat = useCallback(async (chatId: number) => {
    try {
      const chatMessages = (await apiClient.getChatMessages(chatId)).data;
      const formatted = chatMessages
        .map(transformServerMessage)
        .filter((message): message is ThreadMessage => Boolean(message && message.text.trim()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setCurrentChatId(chatId);
      setMessages(formatted);
      setChatsModalOpen(false);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  }, [transformServerMessage]);

  const saveMessageToChat = useCallback(async (chatId: number, role: 'user' | 'ai', content: string, data?: any) => {
    try {
      const payload = {
        chat_id: chatId,
        type: role,
        content,
        data: data ? JSON.stringify(data) : undefined,
      };
      await apiClient.createChatMessage(payload);
    } catch (error) {
      console.error('Error saving message to chat:', error);
    }
  }, []);

  const startNewChat = useCallback(() => {
    activeStreamRef.current = null;
    setActiveStreamId(null);
    setMessages([]);
    setCurrentChatId(null);
    try {
      localStorage.removeItem('ai-user-memory');
    } catch {}
  }, []);

  const initializeAI = useCallback(async () => {
    try {
      const result = await apiClient.aiInitialize();
      if (!result.error) {
        setAiInitialized(true);
        setInitError(null);
      } else {
        setInitError(result.error || 'אירעה שגיאה באתחול העוזר');
      }
    } catch (error) {
      setInitError(error instanceof Error ? error.message : 'אירעה שגיאה באתחול העוזר');
    }
  }, []);

  useEffect(() => {
    initializeAI();
  }, [initializeAI]);

  const handleStopStreaming = useCallback(() => {
    if (!activeStreamRef.current) return;
    const streamId = activeStreamRef.current;
    activeStreamRef.current = null;
    setActiveStreamId(null);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === streamId ? { ...message, status: 'stopped', currentTextPart: undefined } : message
      )
    );
  }, []);


  const handleSendMessage = useCallback(
    async (payload: PromptInputMessage) => {
      const text = (payload.text ?? '').trim();
      const files = payload.files ?? [];
      if (!text && files.length === 0) return;
      if (!aiInitialized || activeStreamRef.current) return;

      const attachments: AttachmentItem[] = files.map((file, index) => ({
        id: createId(`file-${index}`),
        filename: file.filename ?? `קובץ ${index + 1}`,
        url: file.url,
        mediaType: file.mediaType,
      }));

      const userMessage: ThreadMessage = {
        id: createId('user'),
        role: 'user',
        text,
        parts: [],
        currentTextPart: undefined,
        attachments,
        status: 'complete',
        requiresConfirmation: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

    let chatId = currentChatId;
      if (!chatId) {
        chatId = await createNewChat(text);
        if (!chatId) {
        return;
        }
        setCurrentChatId(chatId);
      }

      await saveMessageToChat(chatId, 'user', userMessage.text, attachments.length ? { attachments } : undefined);

      const history = [...messages, userMessage].map((message) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.text,
      }));

      const assistantMessageId = createId('assistant');
      const assistantMessage: ThreadMessage = {
        id: assistantMessageId,
        role: 'assistant',
        text: '',
        parts: [],
        currentTextPart: undefined,
        attachments: [],
        status: 'streaming',
        requiresConfirmation: false,
      timestamp: new Date(),
    };
    
      activeStreamRef.current = assistantMessageId;
      setActiveStreamId(assistantMessageId);
      setMessages((prev) => [...prev, assistantMessage]);

    try {
      await apiClient.aiChatStream(
          userMessage.text,
          history,
        chatId,
          (chunk, full, current) => {
            if (activeStreamRef.current !== assistantMessageId) return;
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantMessageId) return message;
                if (typeof current === 'string') {
                  return {
                    ...message,
                    text: full,
                    currentTextPart: current,
                    status: 'streaming',
                  };
                }
                const serverParts = Array.isArray(current) ? current : message.parts;
                return {
                  ...message,
                  text: full,
                  parts: serverParts,
                  currentTextPart: undefined,
                  status: 'streaming',
                };
              })
            );
        },
        async (full, parts) => {
            activeStreamRef.current = null;
            setActiveStreamId(null);
            const finalParts = Array.isArray(parts) ? parts : [];
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, text: full || '', parts: finalParts, currentTextPart: undefined, status: 'complete' }
                  : message
              )
            );
          if (chatId) {
              await saveMessageToChat(chatId, 'ai', full || '', { parts: finalParts });
            }
          },
          (toolEvent) => {
            if (activeStreamRef.current !== assistantMessageId) return;
            const toolParts = Array.isArray(toolEvent.parts) ? toolEvent.parts : [];
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, parts: toolParts, currentTextPart: undefined, status: 'streaming' }
                  : message
              )
            );
        }
      );
    } catch (error) {
        activeStreamRef.current = null;
        setActiveStreamId(null);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  text: 'מצטער, אירעה שגיאה בחיבור לשרת.',
                  status: 'error',
                  currentTextPart: undefined,
                }
              : message
          )
        );
      }
    },
    [aiInitialized, createNewChat, currentChatId, messages, saveMessageToChat]
  );

  const handleConfirmAction = useCallback(async () => {
    if (!confirmationModal.action || !confirmationModal.data) return;
    try {
      const result = await apiClient.aiExecuteAction(confirmationModal.action, confirmationModal.data);
      const serverMessage = (result as any)?.data?.message;
      if (!result.error && serverMessage) {
        const message: ThreadMessage = {
          id: createId('assistant'),
          role: 'assistant',
          text: serverMessage,
          parts: [],
          currentTextPart: undefined,
          attachments: [],
          status: 'complete',
          requiresConfirmation: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, message]);
      }
    } catch (error) {
      console.error('Error executing action', error);
    } finally {
      setConfirmationModal({ open: false });
    }
  }, [confirmationModal]);

  if (initError) {
    return (
      <>
        <SiteHeader title="העוזר החכם" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <AlertTriangle className="h-16 w-16 text-red-500" />
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold">שגיאה באתחול העוזר החכם</h2>
            <p className="text-muted-foreground max-w-md">{initError}</p>
          </div>
          <Button onClick={initializeAI}>נסה שוב</Button>
        </div>
      </>
    );
  }

  if (!aiInitialized) {
    return (
      <>
        <SiteHeader title="העוזר החכם" />
        <div className="flex flex-1 items-center justify-center" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <Loader size={32} />
        </div>
      </>
    );
  }

  return (
    <PromptInputProvider>
      <div className="relative flex h-full flex-col bg-background" dir="rtl" style={{ scrollbarWidth: 'none' }}>
      <SiteHeader title="העוזר החכם" />
        <div className="absolute top-16 right-4 z-40 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setChatsModalOpen(true)}>
          <History className="h-4 w-4" />
        </Button>
          <Button variant="outline" size="sm" onClick={startNewChat}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
        <Conversation className="flex-1" style={{ scrollbarWidth: 'none' }}>
          <ConversationContent className="flex flex-col items-center gap-4 px-4 pb-44 pt-6">
            <div className="w-full max-w-2xl">
            {!hasMessages && (
              <ConversationEmptyState
                icon={<StarsIcon className="h-12 w-12 text-muted-foreground" />}
                title="ברוכים הבאים לעוזר החכם"
                description="איך אפשר לעזור היום בניהול המרפאה?"
              />
            )}
            {messages.map((message) => (
              <div key={message.id} className="mx-auto w-full max-w-3xl py-4">
                {message.role === 'user' ? (
                  <div className="flex w-full flex-col items-end gap-1">
                    <div className="rounded-3xl bg-primary px-5 py-2.5 text-primary-foreground">
                      <Response>{message.text}</Response>
                    </div>
                    {message.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {message.attachments.map((file) => (
                          <a
                            key={file.id}
                            href={file.url || '#'}
                            target={file.url ? '_blank' : undefined}
                            rel={file.url ? 'noreferrer' : undefined}
                            download={file.filename}
                            className={cn(
                              'rounded-full border border-muted-foreground/40 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition',
                              file.url ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
                            )}
                          >
                            {file.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex w-full gap-3">
                    <MessageAvatar 
                      name="עוזר חכם" 
                      src="https://github.com/openai.png"
                      className="size-8 shrink-0"
                    />
                    <div className="flex-1 pt-1">
                      {message.status === 'streaming' && !message.text && !message.currentTextPart ? (
                        <ShimmerText text="מחשב תשובה..." className="text-sm font-normal" />
                      ) : (
                        <>
                          <div className="text-foreground">
                            {message.parts.length > 0 ? (
                              message.parts.map((part, index) => (
                                <div key={`${message.id}-part-${index}`} className="mb-2">
                                  {part.type === 'text' ? (
                                    <Response>{part.content}</Response>
                                  ) : (
                                    <Task>
                                      <TaskTrigger title={part.toolName || 'Tool'} />
                                      <TaskContent>
                                        <TaskItem>{part.content}</TaskItem>
                                      </TaskContent>
                                    </Task>
                                  )}
                                </div>
                              ))
                            ) : (
                              <Response>{message.currentTextPart || message.text}</Response>
                            )}
                          </div>
                          {message.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.attachments.map((file) => (
                                <a
                                  key={file.id}
                                  href={file.url || '#'}
                                  target={file.url ? '_blank' : undefined}
                                  rel={file.url ? 'noreferrer' : undefined}
                                  download={file.filename}
                                  className={cn(
                                    'rounded-full border border-muted-foreground/40 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition',
                                    file.url ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
                                  )}
                                >
                                  {file.filename}
                                </a>
                              ))}
                            </div>
                          )}
                          {message.status === 'error' && (
                            <div className="mt-2 text-xs text-destructive">אירעה שגיאה בזמן עיבוד התשובה</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div>
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className=" border-border bg-background px-4 py-4">
          <div className="mx-auto max-w-2xl">
            <ChatComposer onSubmit={handleSendMessage} onStop={handleStopStreaming} isReady={aiInitialized} isStreaming={isStreaming} />
            <p className="mt-3 text-center text-xs text-muted-foreground">העוזר החכם יכול לטעות, הקפידו לאמת מידע חשוב.</p>
          </div>
        </div>
        <CustomModal isOpen={confirmationModal.open} onClose={() => setConfirmationModal({ open: false })} title="אישור פעולה">
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{confirmationModal.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmationModal({ open: false })}>
                <XCircle className="mr-2 size-4" />
              ביטול
            </Button>
              <Button onClick={handleConfirmAction}>
                <CheckCircle className="mr-2 size-4" />
              אישור
            </Button>
          </div>
        </div>
      </CustomModal>
        <ChatsModal isOpen={chatsModalOpen} onClose={() => setChatsModalOpen(false)} onSelectChat={loadChat} />
    </div>
    </PromptInputProvider>
  );
} 