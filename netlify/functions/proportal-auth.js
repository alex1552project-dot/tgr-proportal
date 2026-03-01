const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { connectToDatabase, headers, handleOptions } = require('./utils/db');

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(authHeader, allowedRoles) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'No token provided' };
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (allowedRoles && !allowedRoles.includes(decoded.role)) {
      return { valid: false, error: 'Insufficient permissions' };
    }
    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, error: 'Invalid token' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';

    const { db } = await connectToDatabase();
    const users = db.collection('portal_users');

    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };
      }
      const user = await users.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }
      const contractor = await db.collection('contractors').findOne({ _id: new ObjectId(user.contractorId) });
      const siteMeasureEnabled = contractor?.siteMeasureEnabled || false;
      const payload = {
        userId: user._id.toString(),
        name: user.name,
        role: user.role,
        contractorId: user.contractorId,
        language: user.language || 'en',
        siteMeasureEnabled,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          token,
          user: {
            id: user._id.toString(),
            name: user.name,
            role: user.role,
            contractorId: user.contractorId,
            language: user.language || 'en',
            siteMeasureEnabled,
          }
        })
      };
    }

    // ── REFRESH ────────────────────────────────────────────────────────────
    if (action === 'refresh') {
      const auth = verifyToken(authHeader, null);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }
      const { userId, name, role, contractorId, language, siteMeasureEnabled } = auth.user;
      const token = jwt.sign({ userId, name, role, contractorId, language, siteMeasureEnabled: siteMeasureEnabled || false }, JWT_SECRET, { expiresIn: '8h' });
      return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    // ── LANGUAGE ───────────────────────────────────────────────────────────
    if (action === 'language') {
      const auth = verifyToken(authHeader, null);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }
      const { language } = body;
      if (!['en', 'es'].includes(language)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid language' }) };
      }
      await users.updateOne(
        { _id: new ObjectId(auth.user.userId) },
        { $set: { language } }
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── AVAILABILITY ───────────────────────────────────────────────────────
    if (action === 'availability') {
      const auth = verifyToken(authHeader, ['supervisor']);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }
      const { isAvailable } = body;
      await users.updateOne(
        { _id: new ObjectId(auth.user.userId) },
        { $set: { isAvailable: Boolean(isAvailable) } }
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('proportal-auth error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
