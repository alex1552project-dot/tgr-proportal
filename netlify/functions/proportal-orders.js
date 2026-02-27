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

function estimateDeliveryCost(totalTons) {
  if (totalTons <= 15) return 175;
  if (totalTons <= 24) return 260;
  if (totalTons <= 48) return 520;
  if (totalTons <= 96) return 780;
  return 1100;
}

function formatOrder(o) {
  return {
    id: o._id.toString(),
    projectId: o.projectId,
    projectName: o.projectName,
    po: o.po,
    foremanId: o.foremanId,
    foremanName: o.foremanName,
    supervisorId: o.supervisorId || null,
    items: o.items || [],
    deliveryDate: o.deliveryDate,
    notes: o.notes || '',
    deliveryCostEstimate: o.deliveryCostEstimate || 0,
    status: o.status,
    statusUpdatedAt: o.statusUpdatedAt || null,
    statusUpdatedBy: o.statusUpdatedBy || null,
    createdAt: o.createdAt,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const { db } = await connectToDatabase();
  const ordersCol = db.collection('portal_orders');

  try {
    // ── GET ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const auth = verifyToken(authHeader, ['foreman', 'supervisor']);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }

      const view = event.queryStringParameters?.view || auth.user.role;
      let query;

      if (view === 'foreman' || auth.user.role === 'foreman') {
        query = { foremanId: auth.user.userId };
      } else {
        // Supervisor sees all orders for their contractor
        query = { contractorId: auth.user.contractorId };
      }

      const orders = await ordersCol
        .find(query)
        // pending first, then by date desc
        .sort({ status: 1, createdAt: -1 })
        .limit(100)
        .toArray();

      // Re-sort: pending first regardless of alphabetical order
      const sorted = [
        ...orders.filter(o => o.status === 'pending'),
        ...orders.filter(o => o.status !== 'pending'),
      ];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ orders: sorted.map(formatOrder) }),
      };
    }

    // ── POST — foreman submits order ─────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const auth = verifyToken(authHeader, ['foreman']);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }

      const body = JSON.parse(event.body || '{}');
      const { action, projectId, items, deliveryDate, notes } = body;

      if (action !== 'submit') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
      }
      if (!projectId || !items || items.length === 0 || !deliveryDate) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }

      // Look up project
      const project = await db.collection('contractor_projects').findOne({ _id: new ObjectId(projectId) });
      if (!project) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Project not found' }) };
      }

      // Look up material prices
      const materialIds = items.map(i => {
        try { return new ObjectId(i.materialId); } catch { return null; }
      }).filter(Boolean);

      const materialDocs = await db.collection('portal_materials')
        .find({ _id: { $in: materialIds } })
        .toArray();

      const priceMap = {};
      materialDocs.forEach(m => { priceMap[m._id.toString()] = m.pricePerTon; });

      const itemsWithPrice = items.map(i => ({
        materialId: i.materialId,
        name: i.name,
        nameEs: i.nameEs || i.name,
        qty: Number(i.qty),
        pricePerTon: priceMap[i.materialId] || 0,
      }));

      // Find an available supervisor for this contractor
      const supervisor = await db.collection('portal_users').findOne({
        contractorId: auth.user.contractorId,
        role: 'supervisor',
        isAvailable: { $ne: false },
      });

      const totalTons = itemsWithPrice.reduce((s, i) => s + i.qty, 0);
      const deliveryCostEstimate = estimateDeliveryCost(totalTons);

      const result = await ordersCol.insertOne({
        contractorId: auth.user.contractorId,
        projectId,
        projectName: project.name,
        po: project.po,
        foremanId: auth.user.userId,
        foremanName: auth.user.name,
        supervisorId: supervisor?._id.toString() || null,
        items: itemsWithPrice,
        deliveryDate: new Date(deliveryDate),
        notes: notes || '',
        deliveryCostEstimate,
        status: 'pending',
        createdAt: new Date(),
      });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, orderId: result.insertedId.toString() }),
      };
    }

    // ── PATCH — supervisor approves or rejects ───────────────────────────────
    if (event.httpMethod === 'PATCH') {
      const auth = verifyToken(authHeader, ['supervisor']);
      if (!auth.valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
      }

      const body = JSON.parse(event.body || '{}');
      const { action, orderId } = body;

      if (!['approve', 'reject'].includes(action)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
      }
      if (!orderId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'orderId required' }) };
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const result = await ordersCol.updateOne(
        { _id: new ObjectId(orderId), contractorId: auth.user.contractorId, status: 'pending' },
        {
          $set: {
            status: newStatus,
            statusUpdatedAt: new Date(),
            statusUpdatedBy: auth.user.name,
          },
        }
      );

      if (result.matchedCount === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found or already resolved' }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: newStatus }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('proportal-orders error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
