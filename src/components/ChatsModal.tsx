import React, { useState, useEffect } from 'react';
import { CustomModal } from './ui/custom-modal';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { MessageSquare, Trash2, Edit3, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Chat {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: number) => void;
}

export function ChatsModal({ isOpen, onClose, onSelectChat }: ChatsModalProps) {
  const { t } = useTranslation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChats();
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = chats.filter(chat =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredChats(filtered);
  }, [chats, searchTerm]);

  const loadChats = async () => {
    try {
      const allChats = await window.electronAPI.getAllChats();
      setChats(allChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleDeleteChat = async (chatId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (window.confirm('האם אתה בטוח שברצונך למחוק את השיחה?')) {
      try {
        await window.electronAPI.deleteChat(chatId);
        setChats(chats.filter(chat => chat.id !== chatId));
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
      const updatedChat = await window.electronAPI.updateChat({
        id: chatId,
        title: editingTitle.trim()
      });
      
      if (updatedChat) {
        setChats(chats.map(chat => 
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
    <CustomModal isOpen={isOpen} onClose={onClose} title="שיחות קודמות" width="max-w-lg">
      <div className="space-y-" style={{scrollbarWidth: 'none'}}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש שיחות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            dir="rtl"
          />
        </div>

        <ScrollArea className="h-96 pt-6" disableScrollBar={true}>
          <div className="space-y-2 ">
            {filteredChats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" dir="ltr">
                <MessageSquare className="mx-auto h-12 w-12 mb-4"/>
                <p>אין שיחות קודמות</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id} dir="rtl"
                  className="flex max-w-full items-center justify-start p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex-1 min-w-0">
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(chat.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          onBlur={() => handleSaveEdit(chat.id)}
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
                            handleSaveEdit(chat.id);
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
                        onClick={(e) => handleEditChat(chat.id, chat.title, e)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

      </div>
    </CustomModal>
  );
} 