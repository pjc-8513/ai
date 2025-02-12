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

        const titleHoldsHeader = ['Title,Holds,Item Count,Item Records,Record Number(Order)'];
        let hasRecdDate = false;
        let hasItemRecords = false;
        let hasOrderRecords = false;

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

        if (recdDateIndex !== -1) {
            titleHoldsHeader[0] += ',Recv Date';
            hasRecdDate = true;
        }

        if (itemRecordsIndex !== -1) {
            hasItemRecords = true;
        }

        if (orderRecordsIndex !== -1) {
            hasOrderRecords = true;
        }

        const titleHoldsRows = [];

        data.forEach(line => {
            if (!line.trim()) return;
            
            const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!fields || fields.length < 3) return;
            
            const title = fields[1].replace(/^"|"$/g, '').trim();
            const holdsField = fields[2].replace(/^"|"$/g, '').trim();
            
            const totalHolds = (holdsField.match(/";"/g) || []).length + 1;
            
            // Skip if doesn't meet minimum holds threshold
            if (totalHolds < minHolds) return;

            // Process Recv Date - keep only the first one if multiple exist
            let firstRecdDate = '';
            if (hasRecdDate && fields[recdDateIndex]) {
                const recdDates = fields[recdDateIndex].replace(/^"|"$/g, '').trim().split(';');
                firstRecdDate = recdDates[0].trim();

                // Handle date filtering
                if (dateRange) {
                    const [month, day, year] = firstRecdDate.split('-');
                    const recdDateFormatted = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
                    const startDate = dateRange.start.replace(/-/g, '');
                    const endDate = dateRange.end.replace(/-/g, '');

                    // Skip if date is not within range
                    if (recdDateFormatted < startDate || recdDateFormatted > endDate) {
                        return;
                    }
                }
            }
            
            // Process item records and order records
            let itemCount = 0;
            let itemRecords = '';
            let orderRecords = '';
            
            if (hasItemRecords && fields[itemRecordsIndex]) {
                const itemRecordsField = fields[itemRecordsIndex].replace(/^"|"$/g, '').trim();
                const itemRecordsList = itemRecordsField.split(';').map(item => item.trim());
                itemCount = itemRecordsList.length;
                itemRecords = itemRecordsField;
            }

            if (hasOrderRecords && fields[orderRecordsIndex]) {
                orderRecords = fields[orderRecordsIndex].replace(/^"|"$/g, '').trim();
            }
            
            // Build the output line
            let titleHoldsLine = `"${title}",${totalHolds},${itemCount},"${itemRecords}","${orderRecords}"`;
            
            if (hasRecdDate) {
                titleHoldsLine += `,"${firstRecdDate}"`;
            }
            
            titleHoldsRows.push({
                line: titleHoldsLine,
                recdDate: firstRecdDate ? new Date(firstRecdDate.split('-').reverse().join('-')) : new Date(0)
            });
        });

        // Sort the rows by Recv Date
        titleHoldsRows.sort((a, b) => a.recdDate - b.recdDate);

        // Combine header and sorted rows
        const titleHoldsContent = [
            titleHoldsHeader + '\n',
            ...titleHoldsRows.map(row => row.line + '\n')
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