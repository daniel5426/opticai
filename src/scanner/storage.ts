export async function phoneToken(value?: string): Promise<string | undefined> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('prysm-scanner', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('credentials');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('credentials', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('credentials'); const request = value === undefined ? store.get('token') : store.put(value, 'token');
      tx.oncomplete = () => resolve(value ?? request.result); tx.onerror = () => reject(tx.error);
    });
  } finally { database.close(); }
}
