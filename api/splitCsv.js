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

        const titleHoldsHeader = ['Title,Holds,Item Count,Item Records,Record Number(Order),Recv Date'];
        const titleHoldsRows = [];

        const headerColumns = header.split(',');
        const recdDateIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Recv Date'
        );
        const itemRecordsIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Record Number(Item)'
        );
        const orderRecordsIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Record Number(Order)'
        );

        data.forEach(line => {
            if (!line.trim()) return;
            
            // Use a more robust CSV parsing approach
            const fields = line.split('"').map((field, index) => 
                index % 2 === 0 ? field.split(',') : [field]
            ).flat().filter(field => field !== ',' && field !== '');
            
            if (fields.length < 3) return;
            
            const title = fields[1].trim();
            const holdsField = fields[2].trim();
            
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Skip if doesn't meet minimum holds threshold
            if (totalHolds < minHolds) return;

            // Process Recv Date - keep only the first one
            let recdDate = '';
            if (recdDateIndex !== -1 && fields[recdDateIndex]) {
                const dates = fields[recdDateIndex].split(';')[0].trim();
                recdDate = dates.replace(/^"|"$/g, '');

                // Handle date filtering
                if (dateRange) {
                    const [month, day, year] = recdDate.split('-').map(num => num.padStart(2, '0'));
                    const recdDateFormatted = `${year}${month}${day}`;
                    const startDate = dateRange.start.replace(/-/g, '');
                    const endDate = dateRange.end.replace(/-/g, '');

                    if (recdDateFormatted < startDate || recdDateFormatted > endDate) {
                        return;
                    }
                }
            }
            
            // Process item records
            let itemCount = 0;
            let itemRecords = '';
            if (itemRecordsIndex !== -1 && fields[itemRecordsIndex]) {
                itemRecords = fields[itemRecordsIndex].replace(/^"|"$/g, '').trim();
                itemCount = itemRecords.split(';').length;
            }

            // Process order records
            let orderRecords = '';
            if (orderRecordsIndex !== -1 && fields[orderRecordsIndex]) {
                orderRecords = fields[orderRecordsIndex].replace(/^"|"$/g, '').trim();
            }
            
            // Create the row object for sorting
            titleHoldsRows.push({
                title: `"${title}"`,
                holds: totalHolds,
                itemCount,
                itemRecords: `"${itemRecords}"`,
                orderRecords: `"${orderRecords}"`,
                recdDate,
                sortDate: recdDate ? new Date(recdDate.split('-').reverse().join('-')) : new Date(0)
            });
        });

        // Sort rows by Recv Date
        titleHoldsRows.sort((a, b) => a.sortDate - b.sortDate);

        // Build the final content with proper CSV formatting
        const titleHoldsContent = [
            titleHoldsHeader + '\n',
            ...titleHoldsRows.map(row => 
                `${row.title},${row.holds},${row.itemCount},${row.itemRecords},${row.orderRecords},${row.recdDate}\n`
            )
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