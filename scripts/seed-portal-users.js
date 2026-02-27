/**
 * Seed script — ProPortal test users + collections
 * Run once: MONGODB_URI=<uri> node scripts/seed-portal-users.js
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('gotrocks');

    const contractors = db.collection('contractors');
    const portalUsers = db.collection('portal_users');
    const contractorProjects = db.collection('contractor_projects');
    const portalOrders = db.collection('portal_orders');

    // ── Indexes ──────────────────────────────────────────────────────────
    await contractors.createIndex({ status: 1 });
    await portalUsers.createIndex({ email: 1 }, { unique: true });
    await portalUsers.createIndex({ contractorId: 1 });
    await contractorProjects.createIndex({ contractorId: 1, status: 1 });
    await portalOrders.createIndex({ contractorId: 1, status: 1, createdAt: -1 });
    await portalOrders.createIndex({ createdAt: -1 });
    console.log('Indexes created');

    // ── Test contractor ──────────────────────────────────────────────────
    let contractorId;
    const existingContractor = await contractors.findOne({ name: 'Test Contractor LLC' });
    if (!existingContractor) {
      const result = await contractors.insertOne({
        name: 'Test Contractor LLC',
        status: 'active',
        createdAt: new Date()
      });
      contractorId = result.insertedId.toString();
      console.log('Created test contractor:', contractorId);
    } else {
      contractorId = existingContractor._id.toString();
      console.log('Test contractor already exists:', contractorId);
    }

    // ── Test users ───────────────────────────────────────────────────────
    const salt = bcrypt.genSaltSync(10);

    const testUsers = [
      {
        email: 'foreman@test.com',
        passwordHash: bcrypt.hashSync('TestPassword1!', salt),
        name: 'Test Foreman',
        role: 'foreman',
        contractorId,
        language: 'en',
        isAvailable: true,
        createdAt: new Date()
      },
      {
        email: 'supervisor@test.com',
        passwordHash: bcrypt.hashSync('TestPassword1!', salt),
        name: 'Test Supervisor',
        role: 'supervisor',
        contractorId,
        language: 'en',
        isAvailable: true,
        createdAt: new Date()
      }
    ];

    for (const u of testUsers) {
      const existing = await portalUsers.findOne({ email: u.email });
      if (!existing) {
        await portalUsers.insertOne(u);
        console.log('Created user:', u.email);
      } else {
        console.log('User already exists:', u.email);
      }
    }

    console.log('\n✓ Seed complete');
    console.log('  Test credentials (password: TestPassword1!):');
    console.log('    foreman@test.com    → role: foreman');
    console.log('    supervisor@test.com → role: supervisor');

  } finally {
    await client.close();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
