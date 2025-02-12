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

        // Keep the original header structure, just ensure Recv Date is included
        const titleHoldsHeader = ['Title,Holds,Item Count,Item Records,Record Number(Order),Recv Date'];
        const titleHoldsRows = [];

        data.forEach(line => {
            if (!line.trim()) return;
            
            // Split on commas but respect quotes
            const matches = line.match(/"[^"]+"|[^,]+/g);
            if (!matches || matches.length < 5) return;
            
            const id = matches[0].replace(/"/g, '');
            const title = matches[1].replace(/"/g, '');
            const holdsField = matches[2].replace(/"/g, '');
            const publisherDate = matches[3].replace(/"/g, '');
            
            // Find the Recv Date - it's after the publisher date
            const recvDates = matches[4].replace(/"/g, '').split(';');
            const firstRecvDate = recvDates[0].trim();
            
            // Get Order Numbers and Item Numbers
            const orderNumbers = matches[5].replace(/"/g, '');
            const itemNumbers = matches.slice(6).join(',').replace(/"/g, '');
            
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Skip if doesn't meet minimum holds threshold
            if (totalHolds < minHolds) return;

            // Handle date filtering if needed
            if (dateRange) {
                const [month, day, year] = firstRecvDate.split('-').map(n => n.padStart(2, '0'));
                const dateFormatted = `${year}${month}${day}`;
                const startDate = dateRange.start.replace(/-/g, '');
                const endDate = dateRange.end.replace(/-/g, '');

                if (dateFormatted < startDate || dateFormatted > endDate) {
                    return;
                }
            }

            // Create row object for sorting
            titleHoldsRows.push({
                sortDate: new Date(firstRecvDate.split('-').reverse().join('-')),
                row: `"${title}",${totalHolds},${itemNumbers.split(';').length},"${itemNumbers}","${orderNumbers}","${firstRecvDate}"`
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