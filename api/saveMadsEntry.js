import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { href, mainEntry, seeAlso, relatedEntries } = req.body;

            // Connect to MongoDB
            const client = new MongoClient(MONGODB_URI);
            await client.connect();
            const db = client.db('Cluster0');

            // Insert the document into MongoDB
            const doc = {
                _id: href,
                mainEntry,
                seeAlso,
                relatedEntries,
            };
            await db.collection('mads_entries').insertOne(doc);

            await client.close();

            res.status(200).json({ message: 'Document inserted successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error inserting document' });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}