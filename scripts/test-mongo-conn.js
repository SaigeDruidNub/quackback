const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// load .env.local manually to avoid adding dependencies
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

    // ping
    await client.db().command({ ping: 1 });

    // extract host for non-sensitive reporting
    let host = 'unknown';
    try {
      host = uri.replace(/^mongodb\+srv:\/\//, 'https://').split('?')[0];
      host = new URL(host).host;
    } catch (e) {}

    
    const db = client.db('ducktype');
    const collections = await db.listCollections().toArray();
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err.message || err);
    process.exit(2);
  } finally {
    if (client) await client.close();
  }
})();
