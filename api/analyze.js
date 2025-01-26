import { createParser } from 'eventsource-parser';
import formidable from 'formidable';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';

const mySecret = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(mySecret);

// Rate limiting using an in-memory store (simple approach for Vercel)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 50;

function rateLimit(ip) {
    const now = Date.now();
    const existingEntry = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

    // Clear old entries
    if (now > existingEntry.resetTime) {
        existingEntry.count = 0;
        existingEntry.resetTime = now + RATE_LIMIT_WINDOW;
    }

    // Check if limit is exceeded
    if (existingEntry.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    // Increment count
    existingEntry.count += 1;
    requestCounts.set(ip, existingEntry);
    return true;
}

const imageModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
    ],
});

const textModel = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
        },
    ],
});

// Allowed image mime types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Maximum text input length
const MAX_TEXT_LENGTH = 1000;

// Function to convert file to base64
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Get client IP (works with Vercel)
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Rate limiting
  if (!rateLimit(ip)) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm({
    // Limit file size
    maxFileSize: MAX_FILE_SIZE
  });
  
  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Validate text input length
    const text = fields.text ? fields.text.trim() : '';
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ 
        error: `Text input too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.` 
      });
    }

    const image = files.image;

    // Validate image if uploaded
    if (image) {
      // Check file type
      if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
        return res.status(400).json({ 
          error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.' 
        });
      }

      // Check file size
      if (image.size > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
        });
      }
    }

    if (!image && !text) {
        return res.status(400).json({ error: "No image or text was provided" });
    }

    // Set up streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-open'
    });

    try {
        const prompt = `Cataloging Foreign Language Resource\nInstruction\nAs a helpful professional Catalog Librarian, analyze the provided ${image ? 'image' : 'text'} of a foreign language resource and provide a structured response with the following cataloging information:\nLanguage of resource: Language of the text\nRequired Fields\nTitle: Original language, English translation, and transliteration (if non-Latin script)\nSubtitle: Original language, English translation, and transliteration (if non-Latin script)\nEdition statement: Original langugae, English translation, and transliteration (if non-Latin script)\nAuthor: Original language, English translation, and transliteration (if non-Latin script)\nIllustrator: Original language, English translation, and transliteration (if non-Latin script)\nPublication Information: Original language, English translation\nSummary: Original language, English translation\nGuidelines\nIf a field is not present in the ${image ? 'image' : 'text'}, indicate \"Not Available\"\nUse the Library of Congress transliteration chart for non-Latin scripts (RDA guidelines)\nProvide transliterations in a format suitable for a linked field in a MARC Bibliographic record\nResponse Format\nUse a structured format, such as:\nTitle: [Original Language] / [English Translation] / [Transliteration]\nSubtitle: [Original Language] / [English Translation] / [Transliteration]\nAuthor: [Original Language] / [English Translation] / [Transliteration]\nIllustrator: [Original Language] / [English Translation] / [Transliteration]\nPublication Information: [Original Language] / [English Translation]\nSummary: [Original Language] / [English Translation]\nProvide your response in this format to facilitate accurate cataloging.`;

        let result;
        if (image) {
            // Save the uploaded image temporarily
            const tempImagePath = `/tmp/temp-${image.originalname}`;
            fs.writeFileSync(tempImagePath, fs.readFileSync(image.filepath));

            // Prepare the image parts
            const imageParts = [
                fileToGenerativePart(tempImagePath, image.mimetype),
            ];

            // Call the Gemini API with image streaming
            result = await imageModel.generateContentStream([prompt, ...imageParts]);

            // Delete the temporary image
            fs.unlinkSync(tempImagePath);
        } else {
            // Call the Gemini API with text streaming
            result = await textModel.generateContentStream([prompt, text]);
        }

        // Stream the response back to the client
        for await (const chunk of result.stream) {
          res.write(`data: ${JSON.stringify({ chunk: chunk })}\n\n`);
        }

        res.end();
    } catch (error) {
      console.error("Error calling Gemini API: ", error);
     // res.write(`data: ${JSON.stringify({ error: "An error occurred while analyzing the input" })}\n\n`);
     res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
     res.end();
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
}