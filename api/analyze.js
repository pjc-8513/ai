import formidable from 'formidable';

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

    // Here's where you put your original API logic
    // For example, if you were making API calls to external services:
    
    let response;
    try {
      // Example API call (replace with your actual API endpoint)
      const apiResponse = await fetch('YOUR_EXTERNAL_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          // Add image processing if needed
        }),
      });
      
      response = await apiResponse.json();
    } catch (error) {
      console.error('API call failed:', error);
      response = {
        response: "Error processing request"
      };
    }

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
}
