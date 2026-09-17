import { verifyToken } from '../utils/auth.js';
import { sessionsCollection } from '../database/connection.js';
import { hashToken } from '../utils/auth.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  const clientId = user.clientId || req.headers['x-client-id'] || 'urban-tanker';
  const session = await sessionsCollection.findOne({ token_hash: hashToken(token), client_id: clientId, expires_at: { $gt: new Date() } });
  if (!session) {
    return res.status(401).json({ message: 'Session expired or revoked' });
  }

  if (session.uid !== user.uid || session.role !== user.role) {
    return res.status(401).json({ message: 'Session identity does not match the account.' });
  }

  req.user = { ...user, clientId };
  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}
