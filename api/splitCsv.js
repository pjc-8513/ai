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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { file } = req.query;
    if (!file) {
        return res.status(400).json({ error: 'File parameter is required' });
    }

    const filename = path.basename(file);
    const filePath = path.join('/tmp/uploads', filename);

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const fileContent = fs.readFileSync(filePath);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        return res.send(fileContent);
    } catch (error) {
        console.error('Error serving file:', error);
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