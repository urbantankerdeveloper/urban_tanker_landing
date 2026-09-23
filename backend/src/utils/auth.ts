import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      id: user.uid,
      email: user.email,
      role: user.role,
      clientId: user.client_id,
      displayName: user.display_name,
      phoneNumber: user.phone_number,
    },
    process.env.JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRE || '24h') as any }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
