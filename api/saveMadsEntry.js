// pages/api/saveMadsEntries.js
import { connectToDatabase } from '../../utils/mongodb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { db } = await connectToDatabase();
        const { docs } = req.body;

        if (!Array.isArray(docs)) {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        // Use bulkWrite for efficient batch processing
        const operations = docs.map(doc => ({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: doc },
                upsert: true
            }
        }));

        const result = await db.collection('mads_entries').bulkWrite(operations);

        res.status(200).json({ message: 'Documents processed successfully', result });
    } catch (error) {
        console.error('Error processing documents:', error);
        res.status(500).json({ message: 'Error processing documents' });
    }
}