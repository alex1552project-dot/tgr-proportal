const jwt = require('jsonwebtoken');
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
  } catch {
    return { valid: false, error: 'Invalid token' };
  }
}

function formatMeasurement(m) {
  return {
    id: m._id.toString(),
    contractorId: m.contractorId,
    projectId: m.projectId,
    label: m.label,
    createdBy: m.createdBy,
    mode: m.mode,
    coordinates: m.coordinates,
    areaSqFt: m.areaSqFt,
    areaSqM: m.areaSqM,
    depthInches: m.depthInches,
    materialId: m.materialId,
    materialName: m.materialName,
    calculatedQty: m.calculatedQty,
    adjustedQty: m.adjustedQty,
    notes: m.notes,
    status: m.status,
    orderId: m.orderId,
    mapSnapshot: m.mapSnapshot,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const auth = verifyToken(authHeader, ['foreman', 'supervisor']);
  if (!auth.valid) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
  }

  if (!auth.user.siteMeasureEnabled) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'SiteMeasure not enabled for this contractor' }) };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection('measurements');

    // ── GET ────────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const { id, list, projectId } = event.queryStringParameters || {};

      // GET ?id=X — single measurement (includes full coordinates + mapSnapshot)
      if (id) {
        const m = await col.findOne({
          _id: new ObjectId(id),
          contractorId: auth.user.contractorId,
        });
        if (!m) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Measurement not found' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ measurement: formatMeasurement(m) }) };
      }

      // GET ?list=cart&projectId=X — all draft measurements for project
      if (list === 'cart' && projectId) {
        const measurements = await col
          .find({ contractorId: auth.user.contractorId, projectId, status: 'draft' })
          .sort({ createdAt: -1 })
          .toArray();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ measurements: measurements.map(formatMeasurement) }),
        };
      }

      // GET ?list=history&projectId=X — all non-archived for project
      if (list === 'history' && projectId) {
        const measurements = await col
          .find({ contractorId: auth.user.contractorId, projectId, status: { $ne: 'archived' } })
          .sort({ createdAt: -1 })
          .toArray();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ measurements: measurements.map(formatMeasurement) }),
        };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing query params' }) };
    }

    // ── POST ───────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action } = body;

      // POST { action: 'create', ... } — save a new measurement
      if (action === 'create') {
        const {
          label, projectId, mode, coordinates,
          areaSqFt, areaSqM, depthInches,
          materialId, materialName, calculatedQty,
          notes, mapSnapshot,
        } = body;

        if (!label || !projectId || !mode || !coordinates ||
            areaSqFt == null || depthInches == null ||
            !materialId || !materialName || !calculatedQty) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
        }
        if (!['gps_walk', 'aerial_trace'].includes(mode)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'mode must be gps_walk or aerial_trace' }) };
        }

        const now = new Date();
        const result = await col.insertOne({
          contractorId: auth.user.contractorId,
          projectId,
          label: label.trim(),
          createdBy: { userId: auth.user.userId, name: auth.user.name },
          mode,
          coordinates,
          areaSqFt: Number(areaSqFt),
          areaSqM: Number(areaSqM) || 0,
          depthInches: Number(depthInches),
          materialId,
          materialName,
          calculatedQty,
          adjustedQty: null,
          notes: notes || '',
          status: 'draft',
          orderId: null,
          mapSnapshot: mapSnapshot || null,
          createdAt: now,
          updatedAt: now,
        });
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ success: true, id: result.insertedId.toString() }),
        };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

    // ── PUT — update label, depth, material, qty, notes, mapSnapshot ──────────
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id } = body;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
      }

      const m = await col.findOne({ _id: new ObjectId(id), contractorId: auth.user.contractorId });
      if (!m) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Measurement not found' }) };
      }
      if (m.status !== 'draft') {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Only draft measurements can be edited' }) };
      }

      const $set = { updatedAt: new Date() };
      if (body.label !== undefined)        $set.label = body.label.trim();
      if (body.depthInches !== undefined)  $set.depthInches = Number(body.depthInches);
      if (body.materialId !== undefined)   $set.materialId = body.materialId;
      if (body.materialName !== undefined) $set.materialName = body.materialName;
      if (body.calculatedQty !== undefined) $set.calculatedQty = body.calculatedQty;
      if (body.adjustedQty !== undefined)  $set.adjustedQty = body.adjustedQty;
      if (body.notes !== undefined)        $set.notes = body.notes;
      if (body.mapSnapshot !== undefined)  $set.mapSnapshot = body.mapSnapshot;

      if (Object.keys($set).length === 1) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
      }

      await col.updateOne({ _id: new ObjectId(id) }, { $set });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── DELETE ?id=X — archive measurement (preserves data, removes from cart) ─
    if (event.httpMethod === 'DELETE') {
      const { id } = event.queryStringParameters || {};
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
      }

      const result = await col.updateOne(
        { _id: new ObjectId(id), contractorId: auth.user.contractorId, status: 'draft' },
        { $set: { status: 'archived', updatedAt: new Date() } }
      );
      if (result.matchedCount === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Measurement not found or not archiveable' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('proportal-measurements error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
