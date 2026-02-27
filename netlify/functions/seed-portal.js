/**
 * One-time seed function.
 * Trigger: GET /.netlify/functions/seed-portal?go=true
 * Idempotent — safe to run multiple times, won't duplicate data.
 * Delete this function after seeding.
 */

const bcrypt = require('bcryptjs');
const { connectToDatabase, headers, handleOptions } = require('./utils/db');

const MATERIALS = [
  { slug: 'm1', name: 'Crushed Limestone #57', nameEs: 'Piedra Caliza Triturada #57', available: 480, pricePerTon: 22.00, unit: 'tons' },
  { slug: 'm2', name: 'Flex Base',              nameEs: 'Base Flexible',                available: 320, pricePerTon: 18.50, unit: 'tons' },
  { slug: 'm3', name: 'Decomposed Granite',     nameEs: 'Granito Descompuesto',         available: 150, pricePerTon: 24.00, unit: 'tons' },
  { slug: 'm4', name: 'River Rock 3"–5"',       nameEs: 'Roca de Río 3"–5"',           available: 85,  pricePerTon: 32.00, unit: 'tons' },
  { slug: 'm5', name: 'Crushed Concrete',       nameEs: 'Concreto Triturado',           available: 600, pricePerTon: 14.00, unit: 'tons' },
  { slug: 'm6', name: 'Sandy Loam',             nameEs: 'Marga Arenosa',                available: 200, pricePerTon: 16.00, unit: 'tons' },
  { slug: 'm7', name: 'Limestone #2',           nameEs: 'Piedra Caliza #2',             available: 340, pricePerTon: 19.50, unit: 'tons' },
  { slug: 'm8', name: 'Pea Gravel',             nameEs: 'Grava Fina',                   available: 175, pricePerTon: 26.00, unit: 'tons' },
  { slug: 'm9', name: 'Black Star Gravel',      nameEs: 'Grava Estrella Negra',         available: 0,   pricePerTon: 28.00, unit: 'tons' },
];

const PROJECTS = [
  { name: 'Woodlands Commercial Pkwy',    po: 'PO-2025-0441' },
  { name: 'Spring Creek Subdivision Ph3', po: 'PO-2025-0512' },
  { name: 'Conroe ISD - Parking Lot',     po: 'PO-2025-0389' },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  if (event.queryStringParameters?.go !== 'true') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Add ?go=true to trigger the seed.' }),
    };
  }

  const log = [];

  try {
    const { db } = await connectToDatabase();

    // ── Indexes ──────────────────────────────────────────────────────────
    await db.collection('contractors').createIndex({ status: 1 });
    await db.collection('portal_users').createIndex({ email: 1 }, { unique: true });
    await db.collection('portal_users').createIndex({ contractorId: 1, role: 1 });
    await db.collection('contractor_projects').createIndex({ contractorId: 1, status: 1 });
    await db.collection('portal_orders').createIndex({ contractorId: 1, status: 1, createdAt: -1 });
    await db.collection('portal_orders').createIndex({ foremanId: 1, createdAt: -1 });
    await db.collection('portal_materials').createIndex({ slug: 1 }, { unique: true });
    log.push('indexes OK');

    // ── Contractor ───────────────────────────────────────────────────────
    let contractorId;
    const existingC = await db.collection('contractors').findOne({ name: 'Test Contractor LLC' });
    if (!existingC) {
      const r = await db.collection('contractors').insertOne({ name: 'Test Contractor LLC', status: 'active', createdAt: new Date() });
      contractorId = r.insertedId.toString();
      log.push('created contractor: Test Contractor LLC');
    } else {
      contractorId = existingC._id.toString();
      log.push('contractor exists');
    }

    // ── Users ────────────────────────────────────────────────────────────
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('TestPassword1!', salt);

    const users = [
      { email: 'foreman@test.com',    name: 'Carlos Martinez', role: 'foreman',    isAvailable: true },
      { email: 'supervisor@test.com', name: 'Mike Thompson',   role: 'supervisor', isAvailable: true },
    ];

    for (const u of users) {
      const ex = await db.collection('portal_users').findOne({ email: u.email });
      if (!ex) {
        await db.collection('portal_users').insertOne({ ...u, passwordHash: hash, contractorId, language: 'en', createdAt: new Date() });
        log.push(`created user: ${u.email}`);
      } else {
        log.push(`user exists: ${u.email}`);
      }
    }

    // ── Materials ────────────────────────────────────────────────────────
    for (const m of MATERIALS) {
      const ex = await db.collection('portal_materials').findOne({ slug: m.slug });
      if (!ex) {
        await db.collection('portal_materials').insertOne({ ...m, active: true, createdAt: new Date() });
        log.push(`created material: ${m.name}`);
      } else {
        log.push(`material exists: ${m.name}`);
      }
    }

    // ── Projects ─────────────────────────────────────────────────────────
    for (const p of PROJECTS) {
      const ex = await db.collection('contractor_projects').findOne({ contractorId, po: p.po });
      if (!ex) {
        await db.collection('contractor_projects').insertOne({ ...p, contractorId, status: 'active', createdAt: new Date() });
        log.push(`created project: ${p.name}`);
      } else {
        log.push(`project exists: ${p.name}`);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Seed complete. Delete this function before go-live.',
        credentials: { email: 'foreman@test.com OR supervisor@test.com', password: 'TestPassword1!' },
        log,
      }, null, 2),
    };

  } catch (err) {
    console.error('seed-portal error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, log }),
    };
  }
};
