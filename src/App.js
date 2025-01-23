import React, { useState, useRef } from 'react';

function App() {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(null);
    
    // Create a ref for the file input
    const fileInputRef = useRef(null);

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('text', inputText);
            if (image) {
                formData.append('image', image);
            }
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setOutputText(data.response);
        } catch (error) {
            console.error("There was an error", error);
            setOutputText(error.message || 'Error analyzing input. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                alert('Please upload only JPG, PNG, GIF, or WebP images');
                return;
            }

            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                alert('File is too large. Maximum size is 5MB');
                return;
            }

            setImage(file);
        }
    };

    const clearImage = () => {
        // Clear the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Clear the image state
        setImage(null);
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
                            maxLength={1000}
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Upload File
                            </label>
                            <div className="border-2 border-gray-300 border-dashed rounded-lg p-4">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleImageChange}
                                    className="w-full"
                                />
                                {image && (
                                    <button 
                                        onClick={clearImage}
                                        className="mt-2 text-red-500 hover:text-red-700"
                                    >
                                        Clear Image
                                    </button>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">
                                    JPG, PNG, GIF, WebP (max 5MB)
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