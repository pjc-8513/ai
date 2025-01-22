export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Your API logic here
    // You can access:
    // - Text input from req.body.text
    // - File from req.files 

    // For now, just echo back the input
    const response = {
      response: `Processed: ${req.body.text}`
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}