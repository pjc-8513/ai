import React, { useState } from 'react';

function App() {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(null);

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('text', inputText);
            if (image) {
                formData.append('image', image);
            }
            //const response = await fetch('https://457491c0-648a-48da-a1ce-5b6e438b2b2e-00-s58llcr2petp.riker.replit.dev:3001/api/analyze', {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setOutputText(data.response);
        } catch (error) {
            console.error("There was an error", error);
            setOutputText('Error analyzing input. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImage(file);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h1 className="text-2xl font-bold text-center text-blue-600 mb-2">
                        AI Librarian
                    </h1>
                    <p className="text-gray-600 text-center mb-6">
                        Translator/transliterator
                    </p>

                    <div className="space-y-6">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Enter text here..."
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Upload File
                            </label>
                            <div className="border-2 border-gray-300 border-dashed rounded-lg p-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="w-full"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">
                                    Any supported file type
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Analyze'}
                        </button>

                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-2">Response</h3>
                            <div className="p-4 bg-gray-50 rounded-lg min-h-[100px]">
                                {outputText || 'Response will appear here'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;