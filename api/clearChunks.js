// pages/api/clearChunks.js
import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        return res.status(500).json({ error: 'Database configuration error' });
    }

    try {
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        // Delete all chunks
        await chunks.deleteMany({});

        await client.close();
        return res.status(200).json({ message: 'All chunks cleared successfully' });
    } catch (error) {
        console.error('Error clearing chunks:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}