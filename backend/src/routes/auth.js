import express from 'express';
import { body, validationResult } from 'express-validator';
import { sessionsCollection, usersCollection } from '../database/connection.js';
import { randomUUID } from 'node:crypto';
import { hashPassword, comparePassword, generateToken, hashToken } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Invalid email address');

const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters');

const validatePhone = body('phoneNumber')
  .optional()
  .matches(/^[6-9]\d{9}$/)
  .withMessage('Invalid Indian phone number');

const validateName = body('displayName')
  .isLength({ min: 2 })
  .trim()
  .escape()
  .withMessage('Name must be at least 2 characters');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function createSession(user, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sessionsCollection.insertOne({
    token_hash: hashToken(token),
    uid: user.uid,
    client_id: user.client_id,
    role: user.role,
    created_at: new Date(),
    expires_at: expiresAt,
  });
}

router.post('/google', async (req, res) => {
  try {
    const { idToken, role } = req.body;
    const clientId = typeof req.body.clientId === 'string' && req.body.clientId.trim() ? req.body.clientId.trim() : 'urban-tanker';
    const apiKey = process.env.GOOGLE_WEB_API_KEY;
    if (!apiKey || typeof idToken !== 'string') {
      return res.status(400).json({ message: 'Google sign-in is not configured.' });
    }

    const verification = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!verification.ok) return res.status(401).json({ message: 'Google sign-in could not be verified.' });
    const verified = await verification.json();
    const googleUser = verified.users?.[0];
    const email = typeof googleUser?.email === 'string' ? googleUser.email.toLowerCase() : '';
    if (!email) return res.status(401).json({ message: 'Google did not return an email address.' });

    let user = await usersCollection.findOne({ email, client_id: clientId });
    if (!user) {
      if (role && role !== 'customer') return res.status(403).json({ message: 'New Google accounts can only be created as customers.' });
      const now = new Date();
      user = {
        _id: randomUUID(),
        uid: randomUUID(),
        email,
        password_hash: await hashPassword(randomUUID()),
        display_name: googleUser.displayName || email.split('@')[0],
        phone_number: googleUser.phoneNumber || null,
        role: 'customer',
        email_verified: true,
        phone_verified: false,
        created_at: now,
        updated_at: now,
        last_login: now,
        client_id: clientId,
      };
      await usersCollection.insertOne(user);
    } else {
      if (role && user.role !== role) return res.status(403).json({ message: `This account is registered as ${user.role}. Select the matching role.` });
      await usersCollection.updateOne({ _id: user._id, client_id: clientId }, { $set: { last_login: new Date(), updated_at: new Date() } });
    }

    const token = generateToken(user);
    await createSession(user, token);
    return res.status(200).json({ message: 'Google sign-in successful', idToken: token, user: { uid: user.uid, email: user.email, displayName: user.display_name, phoneNumber: user.phone_number, role: user.role } });
  } catch (error) {
    console.error('Google sign-in error:', error);
    return res.status(500).json({ message: 'Google sign-in failed.' });
  }
});

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('displayName').optional().trim().escape(),
    body('phoneNumber').optional().matches(/^[6-9]\d{9}$/),
    body('role').optional().isIn(['customer', 'vendor', 'admin']),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, displayName, phoneNumber, role = 'customer' } = req.body;
      const clientId = typeof req.body.clientId === 'string' && req.body.clientId.trim() ? req.body.clientId.trim() : 'urban-tanker';

      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email, client_id: clientId });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user document
      const uid = randomUUID();
      const userData = {
        _id: uid,
        uid,
        email,
        password_hash: passwordHash,
        display_name: displayName || email.split('@')[0],
        phone_number: phoneNumber || null,
        role,
        email_verified: false,
        phone_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
        last_login: null,
        client_id: clientId,
      };

      await usersCollection.insertOne(userData);
      const user = userData;

      const token = generateToken(user);
      await createSession(user, token);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          role: user.role,
        },
        idToken: token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

/**
 * @route POST /api/auth/login
 * @desc Login user with email and password
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const clientId = typeof req.body.clientId === 'string' && req.body.clientId.trim() ? req.body.clientId.trim() : 'urban-tanker';

      // Find user by email
      const user = await usersCollection.findOne({ email, client_id: clientId });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (role && user.role !== role) {
        return res.status(403).json({ message: `This account is registered as ${user.role}. Select the matching role.` });
      }

      // Verify password
      const validPassword = await comparePassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Update last login
      await usersCollection.updateOne({ _id: user._id, client_id: clientId }, { $set: { last_login: new Date(), updated_at: new Date() } });

      const token = generateToken(user);
      await createSession(user, token);

      res.json({
        message: 'Login successful',
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          role: user.role,
        },
        idToken: token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userDoc = await usersCollection.findOne({ _id: req.user.id, client_id: req.user.clientId });

    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userDoc;
    res.json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.display_name,
        phoneNumber: user.phone_number,
        role: user.role,
        emailVerified: user.email_verified,
        phoneVerified: user.phone_verified,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user profile' });
  }
});

/**
 * @route PUT /api/auth/me
 * @desc Update user profile
 */
router.put(
  '/me',
  authenticateToken,
  [
    body('displayName').optional().trim().escape(),
    body('phoneNumber').optional().matches(/^[6-9]\d{9}$/),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { displayName, phoneNumber } = req.body;

      const updateData = { updated_at: new Date() };

      if (displayName) {
        updateData.display_name = displayName;
      }

      if (phoneNumber) {
        updateData.phone_number = phoneNumber;
      }

      await usersCollection.updateOne({ _id: req.user.id, client_id: req.user.clientId }, { $set: updateData });

      const user = await usersCollection.findOne({ _id: req.user.id, client_id: req.user.clientId });
      if (!user) return res.status(404).json({ message: 'User not found' });

      res.json({
        message: 'Profile updated successfully',
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }
);

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 */
router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await usersCollection.findOne({ _id: req.user.id, client_id: req.user.clientId });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const validPassword = await comparePassword(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await usersCollection.updateOne({ _id: req.user.id, client_id: req.user.clientId }, { $set: {
        password_hash: newPasswordHash,
        updated_at: new Date(),
      } });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  }
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user (optional - for future session management)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  await sessionsCollection.deleteOne({ token_hash: hashToken(token), client_id: req.user.clientId });
  res.json({ message: 'Logged out successfully' });
});

export default router;
