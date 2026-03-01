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

    // GET ?densities=true — material density records for SiteMeasure calculator
    const { densities } = event.queryStringParameters || {};
    if (densities === 'true') {
      const rows = await db.collection('material_densities')
        .find({})
        .sort({ materialName: 1 })
        .toArray();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          densities: rows.map(d => ({
            id: d._id.toString(),
            slug: d.slug,
            materialName: d.materialName,
            category: d.category,
            tonsPerCubicYard: d.tonsPerCubicYard,
            defaultDepthIn: d.defaultDepthIn,
            minDepthIn: d.minDepthIn,
            maxDepthIn: d.maxDepthIn,
          })),
        }),
      };
    }

    const materials = await db.collection('portal_materials')
      .find({ active: true })
      .sort({ name: 1 })
      .toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        materials: materials.map(m => ({
          id: m._id.toString(),
          slug: m.slug,
          name: m.name,
          nameEs: m.nameEs,
          available: m.available,
          pricePerTon: m.pricePerTon,
          unit: m.unit || 'tons',
        })),
      }),
    };
  } catch (err) {
    console.error('proportal-materials error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
