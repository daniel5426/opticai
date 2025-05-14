import { useState } from 'react';
import { Client } from './schema';

// Define return types for each database operation
type DbOperationResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

export const useDatabase = () => {
  // General state for ongoing operations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a client
  const createClient = async (client: Client): Promise<DbOperationResult<number>> => {
    setLoading(true);
    setError(null);
    
    try {
      const clientId = await window.ipcRenderer.invoke('db-create-client', client);
      setLoading(false);
      return { data: clientId, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  // Get a client by ID
  const getClient = async (id: number): Promise<DbOperationResult<Client>> => {
    setLoading(true);
    setError(null);
    
    try {
      const client = await window.ipcRenderer.invoke('db-get-client', id);
      setLoading(false);
      return { data: client, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  // Get a client by national ID
  const getClientByNationalId = async (nationalId: string): Promise<DbOperationResult<Client>> => {
    setLoading(true);
    setError(null);
    
    try {
      const client = await window.ipcRenderer.invoke('db-get-client-by-national-id', nationalId);
      setLoading(false);
      return { data: client, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  // Get all clients
  const getAllClients = async (): Promise<DbOperationResult<Client[]>> => {
    setLoading(true);
    setError(null);
    
    try {
      const clients = await window.ipcRenderer.invoke('db-get-all-clients');
      setLoading(false);
      return { data: clients, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  // Update a client
  const updateClient = async (id: number, clientData: Partial<Client>): Promise<DbOperationResult<boolean>> => {
    setLoading(true);
    setError(null);
    
    try { 
      const success = await window.ipcRenderer.invoke('db-update-client', id, clientData);
      setLoading(false);
      return { data: success, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  // Delete a client
  const deleteClient = async (id: number): Promise<DbOperationResult<boolean>> => {
    setLoading(true);
    setError(null);
    
    try { 
      const success = await window.ipcRenderer.invoke('db-delete-client', id);
      setLoading(false);
      return { data: success, loading: false, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      return { data: null, loading: false, error };
    }
  };

  return {
    loading,
    error,
    createClient,
    getClient,
    getClientByNationalId,
    getAllClients,
    updateClient,
    deleteClient
  };
}; 