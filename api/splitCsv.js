import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import serveStatic from 'serve-static';

export const config = {
    api: {
        bodyParser: false,
    },
};

const writeFile = promisify(fs.writeFile);
const uploadDir = path.join('/tmp', 'uploads'); // Using /tmp for uploads

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const serve = serveStatic(uploadDir, { index: false });

export default async function handler(req, res) {
    if (req.method === 'GET' && req.url.startsWith('/tmp/uploads/')) {
        try {
            const filename = path.basename(req.url);
            const filePath = path.join(uploadDir, filename);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Set appropriate headers
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Stream the file contents
            const fileStream = fs.createReadStream(filePath);
            return fileStream.pipe(res);
        } catch(err) {
            console.error('Error serving file:', err);
            return res.status(500).json({ error: 'Internal server error - getting file' });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const form = formidable({ multiples: false });
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const file = files.file;
        // Modified file extension check to allow .csv OR .txt files
        if (!file || (!file.originalFilename.endsWith('.csv') && !file.originalFilename.endsWith('.txt'))) {
            return res.status(400).json({ error: 'Invalid file format. Please upload a CSV or TXT file.' });
        }

        const fileContent = fs.readFileSync(file.filepath, 'utf-8');
        const chunks = splitCsvContent(fileContent);
        const fileLinks = [];

        for (let i = 0; i < chunks.length; i++) {
            const filename = `part_${i + 1}_${uuidv4()}.csv`; // Still using .csv as the output format
            const filePath = path.join(uploadDir, filename);
            await writeFile(filePath, chunks[i]);
            fileLinks.push(`/tmp/uploads/${filename}`);
        }

        return res.status(200).json({ message: 'File split successfully!', files: fileLinks });
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

function splitCsvContent(content, chunkSize = 200) {
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) throw new Error('Empty file'); // Changed error message to 'Empty file'

    const header = lines[0];
    const data = lines.slice(1);
    const chunks = [];

    for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push([header, ...data.slice(i, i + chunkSize)].join('\n'));
    }
    return chunks;
}