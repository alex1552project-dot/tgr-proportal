/**
 * Seed script — ProPortal collections, test users, materials, projects
 * Run once: MONGODB_URI=<uri> node scripts/seed-portal-users.js
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

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

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB (gotrocks)');
    const db = client.db('gotrocks');

    const contractors        = db.collection('contractors');
    const portalUsers        = db.collection('portal_users');
    const contractorProjects = db.collection('contractor_projects');
    const portalOrders       = db.collection('portal_orders');
    const portalMaterials    = db.collection('portal_materials');

    // ── Indexes ────────────────────────────────────────────────────────────
    await contractors.createIndex({ status: 1 });
    await portalUsers.createIndex({ email: 1 }, { unique: true });
    await portalUsers.createIndex({ contractorId: 1, role: 1 });
    await contractorProjects.createIndex({ contractorId: 1, status: 1 });
    await portalOrders.createIndex({ contractorId: 1, status: 1, createdAt: -1 });
    await portalOrders.createIndex({ foremanId: 1, createdAt: -1 });
    await portalOrders.createIndex({ createdAt: -1 });
    await portalMaterials.createIndex({ slug: 1 }, { unique: true });
    await portalMaterials.createIndex({ active: 1, name: 1 });
    console.log('Indexes OK');

    // ── Test contractor ────────────────────────────────────────────────────
    let contractorId;
    const existing = await contractors.findOne({ name: 'Test Contractor LLC' });
    if (!existing) {
      const r = await contractors.insertOne({ name: 'Test Contractor LLC', status: 'active', createdAt: new Date() });
      contractorId = r.insertedId.toString();
      console.log('Created contractor:', contractorId);
    } else {
      contractorId = existing._id.toString();
      console.log('Contractor exists:', contractorId);
    }

    // ── Test users ─────────────────────────────────────────────────────────
    const salt = bcrypt.genSaltSync(10);
    const PASS = 'TestPassword1!';

    const testUsers = [
      { email: 'foreman@test.com',    name: 'Carlos Martinez', role: 'foreman',    contractorId, isAvailable: true  },
      { email: 'supervisor@test.com', name: 'Mike Thompson',   role: 'supervisor', contractorId, isAvailable: true  },
    ];

    for (const u of testUsers) {
      const ex = await portalUsers.findOne({ email: u.email });
      if (!ex) {
        await portalUsers.insertOne({ ...u, passwordHash: bcrypt.hashSync(PASS, salt), language: 'en', createdAt: new Date() });
        console.log('Created user:', u.email);
      } else {
        console.log('User exists:', u.email);
      }
    }

    // ── Materials ──────────────────────────────────────────────────────────
    for (const m of MATERIALS) {
      const ex = await portalMaterials.findOne({ slug: m.slug });
      if (!ex) {
        await portalMaterials.insertOne({ ...m, active: true, createdAt: new Date() });
        console.log('Created material:', m.name);
      } else {
        console.log('Material exists:', m.name);
      }
    }

    // ── Test projects (linked to test contractor) ──────────────────────────
    const testProjects = [
      { name: 'Woodlands Commercial Pkwy',   po: 'PO-2025-0441' },
      { name: 'Spring Creek Subdivision Ph3', po: 'PO-2025-0512' },
      { name: 'Conroe ISD - Parking Lot',    po: 'PO-2025-0389' },
    ];

    for (const p of testProjects) {
      const ex = await contractorProjects.findOne({ contractorId, po: p.po });
      if (!ex) {
        await contractorProjects.insertOne({ ...p, contractorId, status: 'active', createdAt: new Date() });
        console.log('Created project:', p.name);
      } else {
        console.log('Project exists:', p.name);
      }
    }

    console.log('\n✓ Seed complete');
    console.log('  Test credentials (password: TestPassword1!)');
    console.log('    foreman@test.com    → role: foreman  (Carlos Martinez)');
    console.log('    supervisor@test.com → role: supervisor (Mike Thompson)');
    console.log(`  ${MATERIALS.length} materials seeded`);
    console.log(`  ${testProjects.length} projects seeded`);

  } finally {
    await client.close();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
