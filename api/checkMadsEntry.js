import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { _id } = req.body; // Get the _id (href) from the request body

            // Connect to MongoDB
            const client = new MongoClient(MONGODB_URI);
            await client.connect();
            const db = client.db('Cluster0');
            const collection = db.collection('mads_entries');

            // Check if a document with the given _id exists
            const existingEntry = await collection.findOne({ _id });

            await client.close();

            res.status(200).json({ exists: !!existingEntry }); // Return { exists: true/false }

        } catch (error) {
            console.error("MongoDB check error:", error);
            res.status(500).json({ exists: true }); // Error handling: Assume exists to prevent adding
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}