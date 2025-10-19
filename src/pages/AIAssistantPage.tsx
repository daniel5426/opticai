import React, { useState, useEffect, useRef, memo } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { CustomModal } from '../components/ui/custom-modal';
import { SiteHeader } from '../components/site-header';
import { ChatsModal } from '../components/ChatsModal';
import { User, Send, CheckCircle, XCircle, Clock, AlertTriangle, ArrowUp, ArrowDown, StopCircle, StarsIcon, MessageSquare, Plus, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Markdown } from '../components/markdown';
import { apiClient } from '@/lib/api-client';
interface MessagePart {
  type: 'text' | 'tool';
  content: string;
  toolName?: string;
  toolPhase?: 'start' | 'end';
  timestamp: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  parts?: MessagePart[];
  currentTextPart?: string;
  timestamp: Date;
  data?: {
    action?: string;
    data?: any;
    requiresConfirmation?: boolean;
    streaming?: boolean;
    lastChunk?: string;
  };
}

interface AIResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export function AIAssistantPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    action?: string;
    data?: any;
    message?: string;
  }>({ open: false });
  
  // Chat management state
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [chatsModalOpen, setChatsModalOpen] = useState(false);
  const [currentChatTitle, setCurrentChatTitle] = useState<string>('');
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Chat management functions
  const generateChatTitle = (userMessage: string): string => {
    const maxLength = 50;
    if (userMessage.length <= maxLength) {
      return userMessage;
    }
    return userMessage.substring(0, maxLength).trim() + '...';
  };

  const createNewChat = async (firstUserMessage?: string): Promise<number | null> => {
    try {
      const title = firstUserMessage ? generateChatTitle(firstUserMessage) : 'שיחה חדשה';
      const resp = await apiClient.createChat(title);
      const newChat = resp.data;
      if (newChat?.id) {
        setCurrentChatId(newChat.id);
        setCurrentChatTitle(title);
        return newChat.id;
      }
      return null;
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  const loadChat = async (chatId: number) => {
    try {
      const chat = (await apiClient.getChat(chatId)).data;
      const chatMessages = (await apiClient.getChatMessages(chatId)).data;
      
      if (chat && chatMessages) {
        setCurrentChatId(chatId);
        setCurrentChatTitle(chat.title);
        
        const formattedMessages: ChatMessage[] = chatMessages
          .filter((m: any) => m && typeof m.type === 'string' && typeof m.content === 'string' && m.content.trim().length > 0)
          .map((msg: any) => {
            const parsedData = msg.data ? JSON.parse(msg.data) : undefined;
            return {
              id: `${msg.type}-${msg.id}`,
              type: msg.type,
              content: msg.content,
              parts: parsedData?.parts || [],
              timestamp: new Date(msg.timestamp),
              data: parsedData
            };
          });
        
        setMessages(formattedMessages);
        setLastMessageCount(formattedMessages.length);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const saveMessageToChat = async (chatId: number, type: 'user' | 'ai', content: string, data?: any) => {
    try {
      const messageData = {
        chat_id: chatId,
        type,
        content,
        data: data ? JSON.stringify(data) : undefined
      };
      
      await apiClient.createChatMessage(messageData);
    } catch (error) {
      console.error('Error saving message to chat:', error);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setCurrentChatTitle('');
    setLastMessageCount(0);
    setIsAtBottom(true);
    try {
      localStorage.removeItem('ai-user-memory');
    } catch {}
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const checkIfAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAtBottom(atBottom);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(96, Math.min(textareaRef.current.scrollHeight, 320))}px`;
    }
  };

  useEffect(() => {
    if (messages.length > lastMessageCount) {
      scrollToBottom();
    }
  }, [messages.length]);

  useEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading]);

  useEffect(() => {
    initializeAI();
    
    // Cleanup function to remove listeners when component unmounts
    return () => {};
  }, []);

  const initializeAI = async () => {
    try {
      const result = await apiClient.aiInitialize();
      if (!result.error) setAiInitialized(true);
      else setInitError(result.error || 'Failed to initialize AI assistant');
    } catch (error) {
      setInitError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const addMessage = (type: 'user' | 'ai', content: string, data?: any) => {
    const newMessage: ChatMessage = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      data,
    };
    setMessages(prev => {
      setLastMessageCount(prev.length);
      return [...prev, newMessage];
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !aiInitialized) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI immediately for instant feedback
    addMessage('user', userMessage);
    setIsLoading(true);
    
    // Prepare conversation history for AI (including the current user message)
    const conversationHistory = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    // Handle chat management
    let chatId = currentChatId;
    if (!chatId) {
      chatId = await createNewChat(userMessage);
      if (!chatId) {
        console.error('Failed to create new chat');
        setIsLoading(false);
        return;
      }
    }

    // Save user message to database
    await saveMessageToChat(chatId, 'user', userMessage);

    if (textareaRef.current) {
      textareaRef.current.style.height = '96px';
    }

    // Add a small delay to ensure user message is rendered before AI message
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a placeholder AI message for streaming with a unique ID
    const aiMessageId = `ai-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      type: 'ai',
      content: '',
      timestamp: new Date(),
    };
    
    setMessages(prev => {
      setLastMessageCount(prev.length);
      return [...prev, aiMessage];
    });

    try {
      await apiClient.aiChatStream(
        userMessage,
        conversationHistory,
        chatId,
        (chunk, full, currentTextPartOrParts) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id !== aiMessageId || msg.type !== 'ai') return msg;

            const next = { ...msg, content: full, data: { ...(msg.data||{}), streaming: true, lastChunk: chunk } } as ChatMessage;
            if (typeof currentTextPartOrParts === 'string') {
              next.currentTextPart = currentTextPartOrParts;
              return next;
            }
            const serverParts = currentTextPartOrParts || [];
            // Preserve a pending currentTextPart by appending it after parts for rendering
            next.parts = serverParts;
            next.currentTextPart = undefined;
            return next;
          }));
        },
        async (full, parts) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id !== aiMessageId || msg.type !== 'ai') return msg;
            return {
              ...msg,
              content: full || '',
              parts: parts || [],
              currentTextPart: undefined,
              data: { ...(msg.data || {}), streaming: false }
            };
          }));

          if (chatId) {
            const messageData = {
              chat_id: chatId,
              type: 'ai',
              content: full || '',
              data: JSON.stringify({ parts: parts || [] })
            };
            await apiClient.createChatMessage(messageData);
          }
          setIsLoading(false);
        },
        (toolEvt) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id !== aiMessageId || msg.type !== 'ai') return msg;
            const updatedParts = [...(toolEvt.parts || [])];
            return {
              ...msg,
              parts: updatedParts,
              currentTextPart: toolEvt.phase === 'start' ? undefined : msg.currentTextPart,
              data: { ...(msg.data || {}), toolEvent: true }
            };
          }));
        }
      );
    } catch (error) {
      setMessages(prev => prev.map(msg => msg.id === aiMessageId && msg.type === 'ai' ? { ...msg, content: 'מצטער, אירעה שגיאה בחיבור לשרת.' } : msg));
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmationModal.action || !confirmationModal.data) return;

    try {
      const result = await apiClient.aiExecuteAction(confirmationModal.action, confirmationModal.data);
      const serverMessage = (result as any)?.data?.message;
      if (!result.error && serverMessage) addMessage('ai', serverMessage);
      else addMessage('ai', `שגיאה בביצוע הפעולה: ${result.error}`);
    } catch (error) {
      addMessage('ai', 'שגיאה בביצוע הפעולה.');
    } finally {
      setConfirmationModal({ open: false });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (initError) {
    return (
      <>
        <SiteHeader title="העוזר החכם" />
        <div className="flex flex-col flex-1 p-4 lg:p-6 gap-6 overflow-auto pb-16" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="flex flex-col items-center justify-center flex-1">
            <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">שגיאה באתחול העוזר החכם</h2>
            <p className="text-muted-foreground text-center mb-4">{initError}</p>
            <Button onClick={initializeAI}>נסה שוב</Button>
          </div>
        </div>
      </>
    );
  }

  if (!aiInitialized) {
    return (
      <>
        <SiteHeader title="העוזר החכם" />
      </>
    );
  }

  const Greeting = () => (
    <div className="flex items-center justify-center flex-1">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">ברוכים הבאים לעוזר החכם</h1>
          <p className="text-muted-foreground">
            איך אני יכול לעזור לך היום עם ניהול המרפאה?
          </p>
        </div>
      </div>
    </div>
  );

  const ThinkingMessage = () => (
    <div className={cn("w-full mx-auto max-w-2xl group/message")}>
      <div className="flex gap-4 w-full">
        {/* AI Avatar - on the left */}
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <StarsIcon className="size-4" />
        </div>

        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap leading-relaxed m-0 text-muted-foreground animate-pulse">
                חושב
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MessageComponent = memo(({ message, index, isNew }: { message: ChatMessage; index: number; isNew?: boolean }) => {
    const isUser = message.type === 'user';
    
    return (
      <div 
        className={cn(
          "w-full mx-auto max-w-2xl group/message",
        )}
        data-role={message.type}
        style={isNew ? {
          animationDelay: `${index * 100}ms`
        } : undefined}
      >
        <div className={cn(
          "flex gap-4 w-full",
          {
            "flex-row-reverse": isUser
          }
        )}>
          {/* AI Avatar - on the left */}
          {!isUser && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <StarsIcon className="size-4" />
            </div>
          )}

          {/* User Avatar - on the right */}

          <div className={cn(
            "flex flex-col gap-4",
            {
              "w-fit items-end": isUser,
              "w-full": !isUser
            }
          )}>
            <div className={cn(
              "flex flex-col gap-4",
              {
                "bg-primary text-primary-foreground px-4 py-3 rounded-2xl w-fit": isUser
              }
            )}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed m-0">
                    {message.content}
                  </p>
                ) : message.parts && message.parts.length > 0 ? (
                  <div className="space-y-2">
                    {message.parts.map((part, index) => (
                      <div key={index}>
                        {part.type === 'text' ? (
                          <Markdown>{part.content}</Markdown>
                        ) : (
                          <div className={cn(
                            "bg-muted/50 border rounded-md p-2 text-xs text-muted-foreground flex items-center gap-2",
                            part.toolPhase === 'start' ? 'animate-pulse' : ''
                          )} dir="rtl">
                            {part.toolPhase === 'start' && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            )}
                            {part.content}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Show current streaming text part if available */}
                    {message.currentTextPart && (
                      <div>
                        <Markdown>{message.currentTextPart}</Markdown>
                      </div>
                    )}
                  </div>
                ) : message.currentTextPart ? (
                  <Markdown>{message.currentTextPart}</Markdown>
                ) : (
                  <Markdown>{message.content}</Markdown>
                )}
              </div>

              {message.data?.requiresConfirmation && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    מחכה לאישור
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="flex flex-col h-full bg-background relative" style={{scrollbarWidth: 'none'}}>
      <SiteHeader title="העוזר החכם" />
      
      {/* Floating Chat Management Buttons */}
      <div className="absolute top-16 right-4 z-50 flex items-center gap-2" dir="rtl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setChatsModalOpen(true)}
          className="shadow-lg"
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={startNewChat}
          className="shadow-lg"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-auto pt-4 pb-38"
        style={{scrollbarWidth: 'none'}}
        onScroll={checkIfAtBottom}
      >
        {messages.length === 0 && <Greeting />}

        {messages
          .filter((message, index) => {
            // Hide only if last AI message truly has nothing to show
            if (
              isLoading &&
              message.type === 'ai' &&
              index === messages.length - 1 &&
              message.content === '' &&
              (!message.parts || message.parts.length === 0) &&
              !message.currentTextPart
            ) {
              return false;
            }
            return true;
          })
          .map((message, index) => (
            <MessageComponent 
              key={message.id} 
              message={message} 
              index={index} 
              isNew={index >= lastMessageCount}
            />
          ))}

        {isLoading && messages.length > 0 && (() => {
          const last = messages[messages.length - 1];
          return last.type === 'ai' && last.content === '' && (!last.parts || last.parts.length === 0) && !last.currentTextPart;
        })() && (
          <ThinkingMessage />
        )}

        <div ref={messagesEndRef} className="shrink-0 min-w-[24px] min-h-[24px]" />
      </div>

      {/* Scroll to Bottom Button */}
      {!isAtBottom && (
        <div className="absolute left-1/2 bottom-44 -translate-x-1/2 z-50">
          <Button
            className="rounded-full shadow-lg"
            size="icon"
            variant="outline"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Area - Fixed within the content area */}
      <div className="absolute bottom-9 left-0 right-0 bg-background p-4 pb-6 border-border/5">
        <div className=" mx-auto max-w-2xl">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="שלח הודעה..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyPress}
              className={cn(
                "min-h-[68px] h-24 focus-visible:ring-0 shadow-sm  max-h-[520px] overflow-hidden resize-none rounded-3xl text-base bg-muted border-1  pb-12 pr-4 pl-12",
              )}
              style={{ direction: 'rtl' }}
              rows={1}
              disabled={isLoading || !aiInitialized}
            />

            <div className="absolute bottom-2 left-2 flex items-center">
              {isLoading ? (
                <Button
                  className="rounded-full w-8 h-8 p-0"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsLoading(false)}
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="rounded-full w-8 h-8 p-0"
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || !aiInitialized}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3 text-center" dir="rtl">
            העוזר החכם יכול לטעות. אנא בדקו מידע חשוב.
          </p>
        </div>
      </div>

      <CustomModal
        isOpen={confirmationModal.open}
        onClose={() => setConfirmationModal({ open: false })}
        title="אישור פעולה"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {confirmationModal.message}
          </p>
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmationModal({ open: false })}
            >
              <XCircle className="h-4 w-4 mr-2" />
              ביטול
            </Button>
            <Button
              onClick={handleConfirmAction}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              אישור
            </Button>
          </div>
        </div>
      </CustomModal>

      <ChatsModal
        isOpen={chatsModalOpen}
        onClose={() => setChatsModalOpen(false)}
        onSelectChat={loadChat}
      />
    </div>
  );
} 