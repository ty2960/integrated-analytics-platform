// Analytics storage interface for BI/BA/PA demo
// All data is managed on the frontend via localStorage
// This server storage is not used in the current implementation

export interface IStorage {
  // Placeholder for future server-side analytics operations
}

export class MemStorage implements IStorage {
  constructor() {
    // Analytics data is stored in localStorage on client side
  }
}

export const storage = new MemStorage();
