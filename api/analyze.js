import amqp from 'amqplib';
import { createParser } from 'eventsource-parser';
import formidable from 'formidable';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';

const mySecret = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(mySecret);

const cloudamqpUrl = process.env.CLOUDAMQP_URL;
const queueName = process.env.QUEUE_NAME;

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

async function connectRabbitMQ() {
  const connection = await amqp.connect(cloudamqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  return channel;
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
    const mode = fields.mode || 'translator';

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ 
        error: `Text input too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.` 
      });
    }

    const image = files.image;

    // Validate image if uploaded
    if (mode === 'translator' && image) {
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

        // Get the appropriate prompt based on mode
        let prompt;
        if (mode === 'translator') {
            prompt = `Cataloging Foreign Language Resource\nInstruction\nAs a helpful professional Catalog Librarian, analyze the provided ${image ? 'image' : 'text'} of a foreign language resource and provide a structured response with the following cataloging information...`;
        } else {
            prompt = `You are an expert Python programmer specializing in library catalog systems and MARC record manipulation using pymarc. Your task is to create Python scripts that help catalog librarians manage MARC data efficiently.

            Key Requirements:
            1. Use modern pymarc syntax for field creation and manipulation
            2. Always use add_ordered_field() instead of add_field()
            3. Follow the current best practice for creating fields with subfields:
            - Use pymarc.Field for field creation
            - Use pymarc.Subfield for subfield creation
            - Never manipulate subfield text directly in add_field

            Example of correct field creation:
            python
            field = pymarc.Field(
              tag="800",
              indicators=["1", " "],
              subfields=[
                  pymarc.Subfield("a", "Author Name"),
                  pymarc.Subfield("t", "Series Title"),
                  pymarc.Subfield("v", "Volume Info")
              ]
            )
            record.add_ordered_field(field)


            Based on the following request, provide a complete, working Python script using pymarc:

            ${text}

            Your response should include:
            1. All necessary imports
            2. Clear comments explaining the logic
            3. Error handling for file operations
            4. Proper pymarc field creation syntax
            5. Use of add_ordered_field()
            6. Sample usage example

            Provide the complete script with no truncation.`;        
        }

        
        if (mode === 'translator' && image) {
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

    // Prepare the task
    const task = {
      prompt,
      text,
      image: image ? {
        filepath: image.filepath,
        mimetype: image.mimetype,
        originalname: image.originalname,
      } : null,
      mode, // Add mode to the task
    };

    // Connect to RabbitMQ
    const channel = await connectRabbitMQ();

    // Send the task to the queue
    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(task)));

    // Respond to the client
    res.writeHead(202, { 'Content-Type': 'text/plain' });
    res.end('Task sent to queue');
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
}