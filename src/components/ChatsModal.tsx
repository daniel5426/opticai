import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Chat } from '@/lib/db/schema-interface';
import { apiClient } from '@/lib/api-client';
import { MessageSquare, Trash2, Edit3, Search, Loader2 } from 'lucide-react';

interface ChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: number) => void;
}

export function ChatsModal({ isOpen, onClose, onSelectChat }: ChatsModalProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const LIMIT = 10;

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setChats([]);
      setOffset(0);
      setHasMore(true);
      setSearchTerm('');
      loadChats(true);
    }
  }, [isOpen]);

  // Handle search with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      // Reset and load with search term
      setChats([]);
      setOffset(0);
      setHasMore(true);
      loadChats(true, searchTerm);
    }, 300); // 300ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const loadChats = async (reset: boolean = false, search?: string) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const currentOffset = reset ? 0 : offset;
      const searchQuery = search !== undefined ? search : searchTerm;
      const response = await apiClient.getChats(
        undefined, 
        LIMIT, 
        currentOffset, 
        searchQuery.trim() || undefined
      );
      const newChats = response.data || [];
      
      if (reset) {
        setChats(newChats);
        setOffset(LIMIT);
      } else {
        setChats(prev => [...prev, ...newChats]);
        setOffset(prev => prev + LIMIT);
      }
      
      // If we got fewer chats than the limit, there are no more chats
      setHasMore(newChats.length === LIMIT);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoadingMore || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // Load more when user scrolls near the bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadChats(false, searchTerm);
    }
  }, [isLoadingMore, hasMore, offset, searchTerm]);

  const handleDeleteChat = async (chatId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (window.confirm('האם אתה בטוח שברצונך למחוק את השיחה?')) {
      try {
        await apiClient.deleteChat(chatId);
        setChats(prev => prev.filter(chat => chat.id !== chatId));
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const handleEditChat = (chatId: number, title: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingChatId(chatId);
    setEditingTitle(title);
  };

  const handleSaveEdit = async (chatId: number) => {
    if (!editingTitle.trim()) return;

    try {
      const updatedChatResponse = await apiClient.updateChat(chatId, {
        title: editingTitle.trim()
      });
      const updatedChat = updatedChatResponse.data;
      
      if (updatedChat) {
        setChats(prev => prev.map(chat => 
          chat.id === chatId ? { ...chat, title: editingTitle.trim() } : chat
        ));
      }
      
      setEditingChatId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Error updating chat:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleSelectChat = (chatId: number) => {
    onSelectChat(chatId);
    onClose();
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'תאריך לא ידוע';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'תאריך לא ידוע';
    }
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'היום';
    } else if (diffDays === 2) {
      return 'אתמול';
    } else if (diffDays <= 7) {
      return `לפני ${diffDays - 1} ימים`;
    } else {
      return date.toLocaleDateString('he-IL');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[500px] flex flex-col" style={{scrollbarWidth: 'none'}}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center">שיחות קודמות</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="relative flex-shrink-0">
            <Input
              placeholder="חיפוש שיחות..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              dir="rtl"
            />
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="space-y-2 overflow-auto flex-1" 
            style={{scrollbarWidth: 'none'}}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" dir="rtl">
                <p>אין שיחות קודמות</p>
              </div>
            ) : (
              <>
                {chats.map((chat) => (
                <div
                  key={chat.id} dir="rtl"
                  className="flex max-w-full items-center justify-start p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => chat.id && handleSelectChat(chat.id)}
                >
                  <div className="flex-1 min-w-0">
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && chat.id) {
                              handleSaveEdit(chat.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          onBlur={() => chat.id && handleSaveEdit(chat.id)}
                          className="text-sm"
                          dir="rtl"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            chat.id && handleSaveEdit(chat.id);
                          }}
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="min-w-0 max-w-full overflow-hidden">
                        <div className="font-medium text-sm truncate text-right">
                          {chat.title}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {formatDate(chat.updated_at)}
                        </div>
                      </div>
                    )}
                  </div>

                  {editingChatId !== chat.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => chat.id && chat.title && handleEditChat(chat.id, chat.title, e)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => chat.id && handleDeleteChat(chat.id, e)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Loading more indicator */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4" dir="rtl">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {/* No more chats indicator */}
              {!hasMore && chats.length > 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground" dir="rtl">
                  <p>אין עוד שיחות</p>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 