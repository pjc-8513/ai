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

        // Define the title_holds header structure
        const titleHoldsHeader = ['Title,Holds,Recv Date,Record Number(Order)'];
        const titleHoldsRows = [];

        data.forEach(line => {
            if (!line.trim()) return;
            
            // Split the line while preserving quoted content
            const fields = line.match(/("([^"]|"")*")|([^,]+)/g);
            if (!fields || fields.length < 7) return;
            
            // Extract title (second field)
            const title = fields[1].replace(/^"|"$/g, '').trim();
            
            // Count holds by counting P#= occurrences in the holds field
            const holdsField = fields[2];
            const totalHolds = (holdsField.match(/P#=/g) || []).length;
            
            // Skip if doesn't meet minimum holds threshold
            if (totalHolds < minHolds) return;
            
            // Extract Recv Date - it will be in a quoted MM-DD-YYYY format
            let recvDate = '';
            const dateMatch = line.match(/"([0-9]{2}-[0-9]{2}-[0-9]{4})"/);
            if (dateMatch) {
                recvDate = dateMatch[1];
            }
            
            // Extract Order Numbers (they start with 'o')
            const orderNumbers = line.match(/o[0-9]+/g) || [];
            const orderNumbersStr = orderNumbers.join(';');
            
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
                row: `"${title}",${totalHolds},"${recvDate}","${orderNumbersStr}"`
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