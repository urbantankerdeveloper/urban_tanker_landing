import express from 'express';
import { body, validationResult } from 'express-validator';
import { usersCollection } from '../database/connection.js';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../utils/auth.js';
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

      // Check if user already exists
      const existingUserSnapshot = await usersCollection.where('email', '==', email).limit(1).get();
      if (!existingUserSnapshot.empty) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user document
      const uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const userData = {
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
      };

      const userRef = await usersCollection.add(userData);
      const user = { id: userRef.id, ...userData };

      const token = generateToken(user);

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
      const { email, password } = req.body;

      // Find user by email
      const userSnapshot = await usersCollection.where('email', '==', email).limit(1).get();
      if (userSnapshot.empty) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const userDoc = userSnapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() };

      // Verify password
      const validPassword = await comparePassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Update last login
      await userDoc.ref.update({ last_login: new Date() });

      const token = generateToken(user);

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
    const userDoc = await usersCollection.doc(req.user.id).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userDoc.data();
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

      await usersCollection.doc(req.user.id).update(updateData);

      const userDoc = await usersCollection.doc(req.user.id).get();
      const user = userDoc.data();

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

      const userDoc = await usersCollection.doc(req.user.id).get();
      const user = userDoc.data();

      const validPassword = await comparePassword(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await userDoc.ref.update({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      });

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
  // In a stateless JWT system, logout is handled on the client side
  // This endpoint can be used for future features like token blacklisting
  res.json({ message: 'Logged out successfully' });
});

export default router;
