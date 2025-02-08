// pages/api/checkMadsEntries.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids)) {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db('Cluster0');
        const collection = db.collection('mads_entries');

        // Use a single query to find all existing documents
        const existingDocs = await collection.find({
            _id: { $in: ids }
        }, { projection: { _id: 1 } }).toArray();

        await client.close();

        // Return array of existing IDs
        const existingIds = existingDocs.map(doc => doc._id);

        res.status(200).json({ existingIds });
    } catch (error) {
        console.error("MongoDB batch check error:", error);
        res.status(500).json({ existingIds: ids }); // On error, assume all exist
    }
}