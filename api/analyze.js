import formidable from 'formidable';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';

const mySecret = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(mySecret);

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

const generationConfig = {
    temperature: 0,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

// Function to convert file to base64
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}



// Important: Tell Vercel we don't want to parse the body as JSON
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Parse form data including files
  const form = new formidable.IncomingForm();
  
  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get the text input
    const text = fields.text;
    const image = files.image;

    if (!image && !text) {
        return res.status(400).send({ error: "No image or text was provided" });
    }

    try {
        // Prepare the prompt
        const prompt = `Cataloging Foreign Language Resource\nInstruction\nAs a helpful professional Catalog Librarian, analyze the provided ${image ? 'image' : 'text'} of a foreign language resource and provide a structured response with the following cataloging information:\nLanguage of resource: Language of the text\nRequired Fields\nTitle: Original language, English translation, and transliteration (if non-Latin script)\nSubtitle: Original language, English translation, and transliteration (if non-Latin script)\nEdition statement: Original langugae, English translation, and transliteration (if non-Latin script)\nAuthor: Original language, English translation, and transliteration (if non-Latin script)\nIllustrator: Original language, English translation, and transliteration (if non-Latin script)\nPublication Information: Original language, English translation\nSummary: Original language, English translation\nGuidelines\nIf a field is not present in the ${image ? 'image' : 'text'}, indicate \"Not Available\"\nUse the Library of Congress transliteration chart for non-Latin scripts (RDA guidelines)\nProvide transliterations in a format suitable for a linked field in a MARC Bibliographic record\nResponse Format\nUse a structured format, such as:\nTitle: [Original Language] / [English Translation] / [Transliteration]\nSubtitle: [Original Language] / [English Translation] / [Transliteration]\nAuthor: [Original Language] / [English Translation] / [Transliteration]\nIllustrator: [Original Language] / [English Translation] / [Transliteration]\nPublication Information: [Original Language] / [English Translation]\nSummary: [Original Language] / [English Translation]\nProvide your response in this format to facilitate accurate cataloging.`;

        let result;
        if (image) {
            // Save the uploaded image temporarily
            const tempImagePath = `./temp-${image.originalname}`;
            fs.writeFileSync(tempImagePath, image.buffer);

            // Prepare the image parts
            const imageParts = [
                fileToGenerativePart(tempImagePath, image.mimetype),
            ];

            // Call the Gemini API with image
            result = await imageModel.generateContent([prompt, ...imageParts]);

            // Delete the temporary image
            fs.unlinkSync(tempImagePath);
        } else {
            // Call the Gemini API with text
            result = await textModel.generateContent([prompt, text]);
        }

        const response = await result.response;
        const responseText = response.text();

      return res.status(200).json({ response: responseText });
    } catch (error) {
      console.error("Error calling Gemini API: ", error);
      return res.status(500).send({ error: "An error occurred while analyzing the input" });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
}
