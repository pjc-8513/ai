import fs from 'fs';
import path from 'path';

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