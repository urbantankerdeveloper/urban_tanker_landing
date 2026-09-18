declare global {
  namespace Express {
    interface Request {
      user: {
        uid: string;
        id: string;
        email: string;
        role: 'customer' | 'vendor' | 'admin';
        clientId: string;
        displayName?: string;
        phoneNumber?: string | null;
      };
    }
  }
}

export {};
