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

        const titleHoldsHeader = ['Title,Holds'];
        let hasRecdDate = false;

        const headerColumns = header.split(',');
        const recdDateIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Recv Date'
        );
        if (recdDateIndex !== -1) {
            titleHoldsHeader[0] = 'Title,Holds,Recv Date';
            hasRecdDate = true;
        }

        const titleHoldsContent = [titleHoldsHeader + '\n'];

        data.forEach(line => {
            if (!line.trim()) return;
            
            const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!fields || fields.length < 3) return;
            
            const title = fields[1].replace(/^"|"$/g, '').trim();
            const holdsField = fields[2].replace(/^"|"$/g, '').trim();
            
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Skip if doesn't meet minimum holds threshold
            if (totalHolds < minHolds) return;

            // Handle date filtering
            if (dateRange && hasRecdDate && fields[recdDateIndex]) {
                
const recdDate = fields[recdDateIndex].replace(/^"|"$/g, '').trim();
const [month, day, year] = recdDate.split('-');
const recdDateFormatted = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;

                // Skip if date is not within range
                if (recdDate && 
                    (recdDate < dateRange.start || recdDate > dateRange.end)) {
                    return;
                }
            }
            
            // If we get here, the record passes all filters
            let titleHoldsLine = `"${title}",${totalHolds}`;
            
            if (hasRecdDate) {
                if (fields[recdDateIndex]) {
                    const recdDate = fields[recdDateIndex].replace(/^"|"$/g, '').trim();
                    titleHoldsLine += `,"${recdDate}"`;
                } else {
                    titleHoldsLine += ',';
                }
            }
            
            titleHoldsContent.push(titleHoldsLine + '\n');
        });

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