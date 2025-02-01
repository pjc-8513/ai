// /api/splitCsv.js
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI;
const CHUNK_SIZE = 200; // lines per chunk

export default async function handler(req, res) {
    try {
        const { content, filename } = req.body;
        const lines = content.split(/\r?\n/);
        const header = lines[0];
        const data = lines.slice(1);
        
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        // Create the titles_holds summary
        const titleHoldsContent = ['Title,Holds\n'];  // Start with header
        
        // Process each line to extract title and count holds
        data.forEach(line => {
            if (!line.trim()) return; // Skip empty lines
            
            // Split the line into fields, properly handling quoted values
            const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!fields || fields.length < 3) return;
            
            // Clean up the fields (remove quotes and trim)
            const title = fields[1].replace(/^"|"$/g, '').trim();
            const holdsField = fields[2].replace(/^"|"$/g, '').trim();
            
            // Count holds by counting semicolons + 1
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Add to titles_holds content
            titleHoldsContent.push(`"${title}",${totalHolds}\n`);
        });

        // Store the titles_holds file
        await chunks.insertOne({
            _id: 'titles_holds',  // Fixed ID for this special file
            content: titleHoldsContent.join(''),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60)
        });

        // Store regular chunks as before
        const chunkIds = ['titles_holds']; // Start with our special file
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunkContent = [header, ...data.slice(i, i + CHUNK_SIZE)].join('\n');
            const result = await chunks.insertOne({
                _id: crypto.randomUUID(),
                content: chunkContent,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 60)
            });
            chunkIds.push(result.insertedId);
        }

        await client.close();

        return res.status(200).json({ 
            message: 'File split successfully!', 
            chunkIds 
        });
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}