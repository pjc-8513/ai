import amqp from 'amqplib';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';

const mySecret = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(mySecret);

const cloudamqpUrl = process.env.CLOUDAMQP_URL;
const queueName = process.env.QUEUE_NAME;

// Initialize Gemini models
const imageModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});

const textModel = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});

// Function to convert file to base64
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

// Connect to RabbitMQ
async function connectRabbitMQ() {
  const connection = await amqp.connect(cloudamqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  return channel;
}

// Process a task based on mode
async function processTask(task) {
  const { prompt, text, image, mode } = task;

  try {
    if (mode === 'translator' && image) {
      // Save the uploaded image temporarily
      const tempImagePath = `/tmp/temp-${image.originalname}`;
      fs.writeFileSync(tempImagePath, fs.readFileSync(image.filepath));

      // Prepare the image parts
      const imageParts = [fileToGenerativePart(tempImagePath, image.mimetype)];

      // Call the Gemini API with image streaming
      const result = await imageModel.generateContentStream([prompt, ...imageParts]);

      // Delete the temporary image
      fs.unlinkSync(tempImagePath);
      return result;
    } else {
      // Call the Gemini API with text streaming
      return await textModel.generateContentStream([prompt, text]);
    }
  } catch (error) {
    console.error('Error processing task:', error);
    throw error;
  }
}

// Start the worker
async function startWorker() {
  const channel = await connectRabbitMQ();

  console.log('Worker started. Waiting for tasks...');

  channel.consume(queueName, async (msg) => {
    if (msg) {
      const task = JSON.parse(msg.content.toString());
      console.log('Processing task:', task);

      try {
        const result = await processTask(task);
        console.log('Task processed successfully:', result);
        channel.ack(msg);
      } catch (error) {
        console.error('Error processing task:', error);
        channel.nack(msg);
      }
    }
  });
}

startWorker().catch(console.error);