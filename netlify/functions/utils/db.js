const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db('gotrocks');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Standard response headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Handle OPTIONS requests for CORS
function handleOptions() {
  return {
    statusCode: 200,
    headers,
    body: ''
  };
}

module.exports = { connectToDatabase, headers, handleOptions };
