const jwt = require('jsonwebtoken');
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
  } catch {
    return { valid: false, error: 'Invalid token' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const auth = verifyToken(authHeader, ['foreman', 'supervisor']);
  if (!auth.valid) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
  }

  try {
    const { db } = await connectToDatabase();
    const projects = await db.collection('contractor_projects')
      .find({ contractorId: auth.user.contractorId, status: 'active' })
      .sort({ name: 1 })
      .toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        projects: projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          po: p.po,
          status: p.status,
        })),
      }),
    };
  } catch (err) {
    console.error('proportal-projects error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
