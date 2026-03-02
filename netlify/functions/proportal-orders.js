const jwt = require('jsonwebtoken');
const ObjectId = require('mongodb').ObjectId;
const { connectToDatabase, headers, handleOptions } = require('./utils/db');

const JWT_SECRET = process.env.JWT_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

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
    deliveryType: o.deliveryType || 'delivery',
    notes: o.notes || '',
    deliveryCostEstimate: o.deliveryCostEstimate || 0,
    status: o.status,
    statusUpdatedAt: o.statusUpdatedAt || null,
    statusUpdatedBy: o.statusUpdatedBy || null,
    createdAt: o.createdAt,
  };
}

// Format E.164 from a 10-digit US number
function toE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return null;
}

async function sendSms(toPhone, message) {
  if (!BREVO_API_KEY || !toPhone) return;
  const e164 = toE164(toPhone);
  if (!e164) return;
  await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: 'TCMaterials',
      recipient: e164,
      content: message,
      type: 'transactional',
    }),
  }).catch(err => console.error('Brevo SMS error:', err));
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
        .sort({ status: 1, createdAt: -1 })
        .limit(100)
        .toArray();

      // Re-sort: pending first
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
      const { action, projectId, items, deliveryDate, notes, deliveryType } = body;

      if (action !== 'submit') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
      }
      if (!projectId || !items || items.length === 0 || !deliveryDate) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }

      const orderDeliveryType = deliveryType === 'pickup' ? 'pickup' : 'delivery';

      // Look up project
      const project = await db.collection('contractor_projects').findOne({ _id: new ObjectId(projectId) });
      if (!project) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Project not found' }) };
      }

      // Look up material prices from shared products collection (string IDs)
      const materialIds = items.map(i => i.materialId).filter(Boolean);

      const materialDocs = await db.collection('products')
        .find({ id: { $in: materialIds } })
        .toArray();

      const priceMap = {};
      materialDocs.forEach(m => { priceMap[m.id] = m.price || 0; });

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
      const deliveryCostEstimate = orderDeliveryType === 'pickup' ? 0 : estimateDeliveryCost(totalTons);

      // Look up foreman's phone
      const foremanDoc = await db.collection('portal_users').findOne({ _id: new ObjectId(auth.user.userId) });

      const result = await ordersCol.insertOne({
        contractorId: auth.user.contractorId,
        projectId,
        projectName: project.name,
        projectAddress: project.address || '',
        po: project.po,
        foremanId: auth.user.userId,
        foremanName: auth.user.name,
        foremanPhone: foremanDoc?.phone || '',
        supervisorId: supervisor?._id.toString() || null,
        supervisorName: supervisor?.name || '',
        items: itemsWithPrice,
        deliveryDate: new Date(deliveryDate),
        deliveryType: orderDeliveryType,
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

      // Fetch the updated order to send SMS and push to dispatch queue
      const order = await ordersCol.findOne({ _id: new ObjectId(orderId) });

      // Send SMS to foreman
      if (order?.foremanPhone) {
        const typeLabel = order.deliveryType === 'pickup' ? 'PICK UP' : 'DELIVERY';
        const dateStr = order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        if (newStatus === 'approved') {
          await sendSms(
            order.foremanPhone,
            `T & C Materials: Your order for ${order.projectName}${dateStr ? ` (${dateStr})` : ''} has been APPROVED as a ${typeLabel}. We will be in touch with scheduling.`
          );
        } else {
          await sendSms(
            order.foremanPhone,
            `T & C Materials: Your order for ${order.projectName}${dateStr ? ` (${dateStr})` : ''} was not approved. Please contact your supervisor for details.`
          );
        }
      }

      // If approved, push to dispatch queue for RockRunner
      if (newStatus === 'approved' && order) {
        const totalTons = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
        await db.collection('tc_dispatch_queue').insertOne({
          portalOrderId: orderId,
          contractorId: order.contractorId,
          projectName: order.projectName,
          projectAddress: order.projectAddress || '',
          po: order.po || '',
          foremanName: order.foremanName,
          foremanPhone: order.foremanPhone || '',
          supervisorName: order.supervisorName || auth.user.name,
          items: order.items || [],
          requestedDate: order.deliveryDate,
          deliveryType: order.deliveryType || 'delivery',
          totalTons,
          notes: order.notes || '',
          status: 'queued',
          approvedAt: new Date(),
          approvedBy: auth.user.name,
          createdAt: new Date(),
        });
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: newStatus }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('proportal-orders error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
