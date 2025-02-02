// /api/splitCsv.js
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI;
const CHUNK_SIZE = 200; // lines per chunk

// Update the handler function signature to destructure minHolds
export default async function handler(req, res) {
    try {
        const { content, filename, minHolds = 0 } = req.body;
        const lines = content.split(/\r?\n/);
        const header = lines[0];
        const data = lines.slice(1);
        
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        const titleHoldsHeader = ['Title,Holds'];
        let hasRecdDate = false;

        const headerColumns = header.split(',');
        const recdDateIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '').toUpperCase() === 'RECD_DATE'
        );
        if (recdDateIndex !== -1) {
            titleHoldsHeader[0] = 'Title,Holds,RECD_DATE';
            hasRecdDate = true;
        }

        const titleHoldsContent = [titleHoldsHeader + '\n'];

        // Update the data processing to include the minimum holds filter
        data.forEach(line => {
            if (!line.trim()) return;
            
            const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!fields || fields.length < 3) return;
            
            const title = fields[1].replace(/^"|"$/g, '').trim();
            const holdsField = fields[2].replace(/^"|"$/g, '').trim();
            
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Only include entries that meet the minimum holds threshold
            if (totalHolds >= minHolds) {
                let titleHoldsLine = `"${title}",${totalHolds}`;
                
                if (hasRecdDate && fields[recdDateIndex]) {
                    const recdDate = fields[recdDateIndex].replace(/^"|"$/g, '').trim();
                    titleHoldsLine += `,"${recdDate}"`;
                } else if (hasRecdDate) {
                    titleHoldsLine += ',';
                }
                
                titleHoldsContent.push(titleHoldsLine + '\n');
            }
        });

        // Store the filtered titles_holds file
        await chunks.insertOne({
            _id: 'titles_holds',
            content: titleHoldsContent.join(''),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60)
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