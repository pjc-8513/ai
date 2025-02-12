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

        // Define the new header for Title_holds.csv
        const titleHoldsHeader = ['Title,Holds,Item Count,Item Records,Record Number(Order),Recv Date'];
        let hasRecdDate = false;
        let hasItemRecords = false;

        // Find indices of relevant columns
        const headerColumns = header.split(',');
        const recdDateIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Recv Date'
        );
        const itemRecordsIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Record Number(Item)'
        );
        const recordNumberOrderIndex = headerColumns.findIndex(col => 
            col.trim().replace(/"/g, '') === 'Record Number(Order)'
        );

        if (recdDateIndex !== -1) {
            hasRecdDate = true;
        }

        if (itemRecordsIndex !== -1) {
            hasItemRecords = true;
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

            // Extract the first Recv Date
            let firstRecdDate = '';
            if (hasRecdDate && fields[recdDateIndex]) {
                const recdDateField = fields[recdDateIndex].replace(/^"|"$/g, '').trim();
                const recdDates = recdDateField.split(';').map(date => date.trim());
                firstRecdDate = recdDates[0] || ''; // Use the first date or empty string
            }

            // Handle date filtering
            if (dateRange && hasRecdDate && firstRecdDate) {
                const [month, day, year] = firstRecdDate.split('-');
                const recdDateFormatted = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
                const startDate = dateRange.start.replace(/-/g, '');
                const endDate = dateRange.end.replace(/-/g, '');

                // Skip if date is not within range
                if (recdDateFormatted < startDate || recdDateFormatted > endDate) {
                    return;
                }
            }

            // Process item records
            let itemCount = 0;
            let itemRecords = '';
            if (hasItemRecords && fields[itemRecordsIndex]) {
                const itemRecordsField = fields[itemRecordsIndex].replace(/^"|"$/g, '').trim();
                const itemRecordsList = itemRecordsField.split(';').map(item => item.trim());
                itemCount = itemRecordsList.length;
                itemRecords = `"${itemRecordsList.join(';')}"`; // Properly quote the field
            }

            // Extract Record Number(Order)
            let recordNumberOrder = '';
            if (recordNumberOrderIndex !== -1 && fields[recordNumberOrderIndex]) {
                const recordNumberOrderField = fields[recordNumberOrderIndex].replace(/^"|"$/g, '').trim();
                const recordNumberOrderList = recordNumberOrderField.split(';').map(item => item.trim());
                recordNumberOrder = `"${recordNumberOrderList.join(';')}"`; // Properly quote the field
            }

            // Build the output line
            let titleHoldsLine = [
                `"${title}"`, // Title
                totalHolds,   // Holds
                itemCount,    // Item Count
                itemRecords,  // Item Records
                recordNumberOrder, // Record Number(Order)
                hasRecdDate ? `"${firstRecdDate}"` : '' // Recv Date (quoted if present)
            ].join(',');

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