import express from 'express';
import { body, validationResult } from 'express-validator';
import { sessionsCollection, usersCollection, vendorsCollection } from '../database/connection.js';
import { randomBytes, randomUUID } from 'node:crypto';
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
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await sessionsCollection.insertOne({
    token_hash: hashToken(token),
    uid: user.uid,
    client_id: user.client_id,
    role: user.role,
    created_at: new Date(),
    expires_at: expiresAt,
  });
}

async function notifyMainAdminOfApprovalRequest(user: Record<string, any>): Promise<void> {
  const adminEmail = process.env.MAIN_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const emailKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.MAIL_FROM;
  if (!adminEmail || !emailKey || !emailFrom) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${emailKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [adminEmail],
      subject: `Urban Tanker ${user.role} approval request`,
      html: `<p>A new ${user.role} account is waiting for approval.</p><p><strong>${user.display_name}</strong> · ${user.email}</p><p>Client: ${user.client_id}</p>`,
    }),
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
      const now = new Date();
      user = {
        _id: randomUUID(),
        uid: randomUUID(),
        email,
        password_hash: await hashPassword(randomUUID()),
        display_name: googleUser.displayName || email.split('@')[0],
        phone_number: googleUser.phoneNumber || null,
        role: role === 'vendor' || role === 'admin' ? role : 'customer',
        email_verified: true,
        phone_verified: false,
        created_at: now,
        updated_at: now,
        last_login: now,
        client_id: clientId,
        ...(role === 'vendor' || role === 'admin' ? { status: 'inactive', available: false, approval_status: 'pending' } : { status: 'active', approval_status: 'approved' }),
      };
      await usersCollection.insertOne(user);
      if (user.role === 'vendor') {
        await vendorsCollection.updateOne(
          { uid: user.uid, client_id: clientId },
          { $set: { uid: user.uid, client_id: clientId, name: user.display_name, email: user.email, phone: user.phone_number, driver: user.display_name, zone: '', vehicle: '', capacity: '', status: 'inactive', available: false, updated_at: new Date() } },
          { upsert: true },
        );
      }
      if (user.role === 'vendor' || user.role === 'admin') {
        await notifyMainAdminOfApprovalRequest(user).catch(error => console.error('Approval notification error:', error));
        return res.status(202).json({ message: `Your ${user.role} account was created and is awaiting administrator approval.` });
      }
    } else {
      if (['vendor', 'admin'].includes(user.role) && user.approval_status !== 'approved' && user.status !== 'active') return res.status(403).json({ message: `Your ${user.role} account is awaiting administrator approval.` });
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
        const approvalRequired = role === 'vendor' || role === 'admin';
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
        ...(approvalRequired ? { status: 'inactive', available: false, approval_status: 'pending' } : { status: 'active', approval_status: 'approved' }),
      };

      await usersCollection.insertOne(userData);
      if (role === 'vendor') {
        await vendorsCollection.updateOne(
          { uid, client_id: clientId },
          { $set: { uid, client_id: clientId, name: userData.display_name, email, phone: userData.phone_number, driver: userData.display_name, zone: '', vehicle: '', capacity: '', status: 'inactive', available: false, updated_at: new Date() } },
          { upsert: true },
        );
      }
      if (approvalRequired) {
        await notifyMainAdminOfApprovalRequest(userData).catch(error => console.error('Approval notification error:', error));
        return res.status(202).json({ message: `Your ${role} account was created and is awaiting administrator approval.` });
      }
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
      const { email, password } = req.body;
      const clientId = typeof req.body.clientId === 'string' && req.body.clientId.trim() ? req.body.clientId.trim() : 'urban-tanker';

      // Find user by email
      const user = await usersCollection.findOne({ email, client_id: clientId });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Verify password
      const validPassword = await comparePassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (['vendor', 'admin'].includes(user.role) && user.approval_status !== 'approved' && user.status !== 'active') {
        return res.status(403).json({ message: `Your ${user.role} account is awaiting administrator approval.` });
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

router.post('/password-reset', async (req, res) => {
  try {
    const action = req.body?.action === 'complete' ? 'complete' : 'request';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const clientId = typeof req.body?.clientId === 'string' && req.body.clientId.trim() ? req.body.clientId.trim() : 'urban-tanker';
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'A valid email address is required.' });

    if (action === 'request') {
      const user = await usersCollection.findOne({ email, client_id: clientId }, { projection: { _id: 1, email: 1, display_name: 1 } });
      if (user) {
        const token = randomBytes(32).toString('hex');
        await usersCollection.updateOne(
          { _id: user._id, client_id: clientId },
          { $set: { reset_token_hash: hashToken(token), reset_token_expires_at: new Date(Date.now() + 30 * 60 * 1000), updated_at: new Date() } },
        );
        const resetBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${resetBaseUrl}/?resetToken=${encodeURIComponent(token)}&resetEmail=${encodeURIComponent(email)}`;
        const emailKey = process.env.RESEND_API_KEY;
        const emailFrom = process.env.MAIL_FROM;
        if (emailKey && emailFrom) {
          await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${emailKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: emailFrom, to: [email], subject: 'Reset your Urban Tanker password', html: `<p>Hello ${user.display_name || 'there'},</p><p>Use this link to reset your Urban Tanker password. It expires in 30 minutes:</p><p><a href="${resetLink}">Reset password</a></p>` }) });
        } else if (process.env.NODE_ENV !== 'production') {
          console.log(`Password reset link for ${email}: ${resetLink}`);
        }
      }
      return res.json({ message: 'If the account exists, a reset link has been sent.' });
    }

    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!token || password.length < 8) return res.status(400).json({ message: 'A valid reset token and password of at least 8 characters are required.' });
    const result = await usersCollection.updateOne(
      { email, client_id: clientId, reset_token_hash: hashToken(token), reset_token_expires_at: { $gt: new Date() } },
      { $set: { password_hash: await hashPassword(password), updated_at: new Date() }, $unset: { reset_token_hash: '', reset_token_expires_at: '' } },
    );
    if (!result.matchedCount) return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Unable to reset the password.' });
  }
});

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

      const updateData: Record<string, any> = { updated_at: new Date() };

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
