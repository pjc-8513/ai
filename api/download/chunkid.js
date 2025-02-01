import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
    console.log("Download request received for chunk:", req.query.chunkId);
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { chunkId } = req.query;
        console.log("Connecting to MongoDB...");
        
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        console.log("Looking for chunk with ID:", chunkId);
        // Instead of creating a new ObjectId, we can use the string ID directly with MongoDB
        const chunk = await chunks.findOne({ _id: chunkId });
        
        if (!chunk) {
            console.log("Chunk not found!");
            await client.close();
            return res.status(404).json({ error: 'Chunk not found' });
        }

        console.log("Chunk found, content length:", chunk.content.length);

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="chunk_${chunkId}.csv"`);
        
        // Send the content
        res.status(200).send(chunk.content);
        console.log("Content sent to client");

        // Cleanup: Delete the chunk after download
        await chunks.deleteOne({ _id: chunkId });
        await client.close();
        console.log("Chunk deleted and connection closed");

    } catch (error) {
        console.error('Error serving chunk:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}