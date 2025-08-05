/// <reference path="../../types/electron.d.ts" />
import { Chat, ChatMessage } from './schema-interface';

export async function getAllChats(clinicId?: number): Promise<Chat[]> {
  try {
    if (clinicId) {
      return await window.electronAPI.db('getChatsByClinicId', clinicId);
    } else {
      return await window.electronAPI.db('getAllChats');
    }
  } catch (error) {
    console.error('Error getting all chats:', error);
    return [];
  }
}

export async function getChatById(id: number): Promise<Chat | null> {
  try {
    return await window.electronAPI.db('getChatById', id);
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

export async function createChat(title: string, clinicId?: number): Promise<Chat | null> {
  try {
    return await window.electronAPI.db('createChat', title, clinicId);
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
}

export async function updateChat(chat: Chat): Promise<Chat | null> {
  try {
    return await window.electronAPI.db('updateChat', chat);
  } catch (error) {
    console.error('Error updating chat:', error);
    return null;
  }
}

export async function deleteChat(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteChat', id);
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

export async function getChatMessagesByChatId(chatId: number): Promise<ChatMessage[]> {
  try {
    return await window.electronAPI.db('getChatMessagesByChatId', chatId);
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
}

export async function createChatMessage(chatMessage: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage | null> {
  try {
    return await window.electronAPI.db('createChatMessage', chatMessage);
  } catch (error) {
    console.error('Error creating chat message:', error);
    return null;
  }
}

export async function updateChatMessage(chatMessage: ChatMessage): Promise<ChatMessage | null> {
  try {
    return await window.electronAPI.db('updateChatMessage', chatMessage);
  } catch (error) {
    console.error('Error updating chat message:', error);
    return null;
  }
}

export async function deleteChatMessage(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteChatMessage', id);
  } catch (error) {
    console.error('Error deleting chat message:', error);
    return false;
  }
} 