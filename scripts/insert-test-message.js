const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
let uri;
try {
  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/MONGODB_URI\s*=\s*"?(.*?)"?\s*$/m);
  if (match) uri = match[1];
} catch (err) {
  // ignore
}

if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

(async () => {
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('ducktype');
    const payload = { user: 'Integration Test', ai: ['This is a test insertion via API (simulated)'], createdAt: new Date() };
    const result = await db.collection('messages').insertOne(payload);
    
    const fetched = await db.collection('messages').findOne({ _id: result.insertedId });
   

    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err.message || err);
    process.exit(2);
  } finally {
    if (client) await client.close();
  }
})();