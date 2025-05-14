import { Client } from "./schema";

// Mock client data for development
const mockClients: Client[] = [
  {
    id: 1,
    first_name: "דוד",
    last_name: "כהן",
    gender: "זכר",
    national_id: "123456789",
    date_of_birth: "1985-05-15",
    address_city: "תל אביב",
    phone_mobile: "0501234567",
    email: "david@example.com",
  },
  {
    id: 2,
    first_name: "שרה",
    last_name: "לוי",
    gender: "נקבה",
    national_id: "987654321",
    date_of_birth: "1990-10-20",
    address_city: "ירושלים",
    phone_mobile: "0507654321",
    email: "sarah@example.com",
  },
  {
    id: 3,
    first_name: "יוסי",
    last_name: "אברהם",
    gender: "זכר",
    national_id: "456789123",
    date_of_birth: "1978-03-25",
    address_city: "חיפה",
    phone_mobile: "0509876543",
    email: "yossi@example.com",
  },
  {
    id: 4,
    first_name: "רחל",
    last_name: "גולדברג",
    gender: "נקבה",
    national_id: "654321987",
    date_of_birth: "1995-12-10",
    address_city: "באר שבע",
    phone_mobile: "0503456789",
    email: "rachel@example.com",
  },
  {
    id: 5,
    first_name: "משה",
    last_name: "פרץ",
    gender: "זכר",
    national_id: "789123456",
    date_of_birth: "1982-07-30",
    address_city: "נתניה",
    phone_mobile: "0505678901",
    email: "moshe@example.com",
  }
];

// Function to get all clients
export function getAllClients(): Client[] {
  return mockClients;
}

// Function to get a client by ID
export function getClientById(id: number): Client | undefined {
  return mockClients.find(client => client.id === id);
}

// In a real app, we would add functions to create, update, and delete clients
// These would interact with the actual database
export function createClient(client: Client): Client {
  // This is a mock implementation
  const newClient = {
    ...client,
    id: Math.max(...mockClients.map(c => c.id ?? 0)) + 1
  };
  mockClients.push(newClient);
  return newClient;
}

export function updateClient(client: Client): Client | undefined {
  if (!client.id) return undefined;
  
  const index = mockClients.findIndex(c => c.id === client.id);
  if (index === -1) return undefined;
  
  mockClients[index] = client;
  return client;
}

export function deleteClient(id: number): boolean {
  const index = mockClients.findIndex(c => c.id === id);
  if (index === -1) return false;
  
  mockClients.splice(index, 1);
  return true;
} 