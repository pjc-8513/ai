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
const uploadDir = path.join('/tmp', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const serve = serveStatic(uploadDir, { index: false });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = uploadDir;
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const filePath = file.filepath;
    const filename = file.name;
    

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const chunks = splitCsvContent(fileContent);

    // Process chunks...
    console.log(chunks);

    return res.json({ message: 'File uploaded and processed successfully' });
  });
}

function splitCsvContent(content, chunkSize = 200) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) throw new Error('Empty file');

  const header = lines[0];
  const data = lines.slice(1);
  const chunks = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push([header, ...data.slice(i, i + chunkSize)].join('\n'));
  }
  return chunks;
}