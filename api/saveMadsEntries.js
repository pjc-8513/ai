// pages/api/saveMadsEntries.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { docs } = req.body;

        if (!Array.isArray(docs)) {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db('Cluster0');
        const collection = db.collection('mads_entries');

        // Use bulkWrite for efficient batch processing
        const operations = docs.map(doc => ({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: doc },
                upsert: true
            }
        }));

        const result = await collection.bulkWrite(operations);

        await client.close();

        res.status(200).json({ 
            message: 'Documents processed successfully', 
            result: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount
            }
        });
    } catch (error) {
        console.error('Error processing documents:', error);
        res.status(500).json({ message: 'Error processing documents' });
    }
}