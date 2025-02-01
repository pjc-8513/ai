// /api/download/[chunkId].js
import { MongoClient, ObjectId } from 'mongodb';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { chunkId } = req.query;
        
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        await chunks.deleteOne({ _id: chunkId });
        
        if (!chunk) {
            await client.close();
            return res.status(404).json({ error: 'Chunk not found' });
        }

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="chunk.csv"`);
        
        // Send the content
        res.send(chunk.content);

        // Cleanup: Delete the chunk after download
        await chunks.deleteOne({ _id: new ObjectId(chunkId) });
        await client.close();

    } catch (error) {
        console.error('Error serving chunk:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}