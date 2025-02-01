import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import formidable from 'formidable';

const mySecret = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(mySecret);

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1000;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Response schema for translator mode
const translatorResponseSchema = {
  type: "object",
  properties: {
    response: {
      type: "object",
      properties: {
        original: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            edition: { type: "string" },
            publication_information: { type: "string" },
            author: { type: "string" },
            added_author: { type: "string" },
            translator: { type: "string" },
            illustrator: { type: "string" },
            other: { type: "string" }
          },
          required: [
            "title", "subtitle", "edition", "publication_information",
            "author", "added_author", "translator", "illustrator"
          ]
        },
        translated: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            edition: { type: "string" },
            publication_information: { type: "string" },
            author: { type: "string" },
            added_author: { type: "string" },
            translator: { type: "string" },
            illustrator: { type: "string" },
            other: { type: "string" }
          },
          required: [
            "title", "subtitle", "edition", "publication_information",
            "author", "added_author", "translator", "illustrator"
          ]
        },
        transliterated: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            edition: { type: "string" },
            publication_information: { type: "string" },
            author: { type: "string" },
            added_author: { type: "string" },
            translator: { type: "string" },
            illustrator: { type: "string" },
            other: { type: "string" }
          },
          required: [
            "title", "subtitle", "edition", "publication_information",
            "author", "added_author", "translator", "illustrator"
          ]
        }
      },
      required: ["original", "translated", "transliterated"]
    }
  },
  required: ["response"]
};

const getTranslatorModel = () => {
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: translatorResponseSchema
    }
  });
};

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

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const form = formidable({
            maxFileSize: MAX_FILE_SIZE,
            keepExtensions: true,
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const text = fields.text ? fields.text.trim() : '';
        const mode = fields.mode || 'translator';

        if (text.length > MAX_TEXT_LENGTH) {
            return res.status(400).json({
                error: `Text input too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.`
            });
        }

        const image = files.image;
        if (mode === 'translator' && image) {
            if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
                return res.status(400).json({
                    error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.'
                });
            }

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
            prompt = `Cataloging Foreign Language Resource
Instruction
As a helpful professional Catalog Librarian, analyze the provided ${image ? 'image' : 'text'} of a foreign language resource and provide a structured response with the following cataloging information...`;
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

        let result;
        if (mode === 'translator') {
            const model = getTranslatorModel();
            if (image) {
                // Read the image file as base64
                const imageData = Buffer.from(await require('fs').promises.readFile(image.filepath)).toString('base64');
                
                const imagePart = {
                    inlineData: {
                        data: imageData,
                        mimeType: image.mimetype
                    }
                };

                result = await model.generateContent([prompt, imagePart]);
            } else {
                result = await model.generateContent([prompt, text]);
            }
            // For translator mode, we directly return the JSON response
            const response = result.response;
            console.log(response);
            console.log(stringify(response));
            return res.status(200).json(response);
        } else {
            result = await textModel.generateContent([prompt, text]);
            const response = result.response;
            return res.status(200).json({ 
                result: response.text()
            });
        }

    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ error: error.message });
    }
}