// /api/splitCsv.js
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI;
const CHUNK_SIZE = 200; // lines per chunk

//Export with hold and date range filters create title_holds and chunks downloads
export default async function handler(req, res) {
    try {
        const { content, filename, minHolds = 0, dateRange = null } = req.body;
        const lines = content.split(/\r?\n/);
        const header = lines[0];
        const data = lines.slice(1);
        
        const client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('csvSplitter');
        const chunks = db.collection('chunks');

        // Use the correct header structure based on your CSV format
        const titleHoldsHeader = ['Title,Holds,Item Count,Item Records,Recv Date'];
        const titleHoldsRows = [];

        data.forEach(line => {
            if (!line.trim()) return;
            
            // Use the original working regex pattern
            const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!fields || fields.length < 4) return;
            
            const title = fields[0].replace(/^"|"$/g, '').trim();
            const holds = parseInt(fields[1].replace(/^"|"$/g, '').trim()) || 0;
            const itemCount = parseInt(fields[2].replace(/^"|"$/g, '').trim()) || 0;
            const itemRecords = fields[3].replace(/^"|"$/g, '').trim();
            const recvDate = fields[4] ? fields[4].replace(/^"|"$/g, '').trim() : '';
            
            // Skip if doesn't meet minimum holds threshold
            if (holds < minHolds) return;

            // Handle date filtering if needed
            if (dateRange && recvDate) {
                const [month, day, year] = recvDate.split('-').map(n => n.padStart(2, '0'));
                const dateFormatted = `${year}${month}${day}`;
                const startDate = dateRange.start.replace(/-/g, '');
                const endDate = dateRange.end.replace(/-/g, '');

                if (dateFormatted < startDate || dateFormatted > endDate) {
                    return;
                }
            }

            // Create row object for sorting
            titleHoldsRows.push({
                sortDate: recvDate ? new Date(recvDate.split('-').reverse().join('-')) : new Date(0),
                row: `"${title}",${holds},${itemCount},"${itemRecords}","${recvDate}"`
            });
        });

        // Sort by Recv Date
        titleHoldsRows.sort((a, b) => a.sortDate - b.sortDate);

        // Combine header and sorted rows
        const titleHoldsContent = [
            titleHoldsHeader + '\n',
            ...titleHoldsRows.map(row => row.row + '\n')
        ];

        // Store the filtered titles_holds file
        await chunks.insertOne({
            _id: 'titles_holds',
            content: titleHoldsContent.join(''),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60)
        });

        // Store regular chunks as before (unfiltered)
        const chunkIds = ['titles_holds'];
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