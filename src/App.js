import React, { useState, useRef } from 'react';

function App() {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [image, setImage] = useState(null);
    const [mode, setMode] = useState('translator');
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setOutputText('');
        setError('');

        try {
            const formData = new FormData();
            formData.append('text', inputText);
            formData.append('mode', mode);
            if (mode === 'translator' && image) {
                formData.append('image', image);
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }

            setOutputText(data.result || '');

        } catch (error) {
            console.error("Analysis error:", error);
            setError(error.message || 'Error analyzing input');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        setError(null);
        setFiles([]);
        const file = event.target.files[0];
    
        if (!file) {
            setError("Please upload a TXT file!");
            return;
        }
    
        // Add debug logging
        console.log("Uploading file:", file.name, file.size);
    
        if (file.size > 25_000_000) {
            setError("File is too large! Please upload a file smaller than 25MB.");
            return;
        }
    
        if (!file.name.endsWith(".txt")) {
            setError("Please upload a TXT file!");
            return;
        }
    
        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
    
        try {
            // Add debug logging
            console.log("Sending request to /api/splitCsv");
            const response = await fetch("/api/splitCsv", {
                method: "POST",
                body: formData,
            });
    
            // Add debug logging
            console.log("Response status:", response.status);
            const data = await response.json();
            console.log("Response data:", data);
    
            if (!response.ok) {
                throw new Error(data.error || "An error occurred");
            }
    
            setFiles(data.files);
        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                setError('Please upload only JPG, PNG, GIF, or WebP images');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                setError('File is too large. Maximum size is 5MB');
                return;
            }

            setImage(file);
            setError('');
        }
    };

    const clearImage = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setImage(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h1 className="text-2xl font-bold text-center text-blue-600 mb-2">
                        AI Librarian
                    </h1>

                    <div className="flex justify-center gap-4 mb-6">
                        <button
                            onClick={() => {
                                setMode('translator');
                                setError('');
                                setOutputText('');
                                setImage(null);
                                setFiles([]);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                mode === 'translator'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Translator
                        </button>
                        <button
                            onClick={() => {
                                setMode('coder');
                                setError('');
                                setOutputText('');
                                clearImage();
                                setFiles([]);
                                alert('This is more experimental and often fails.');
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                mode === 'coder'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Coder
                        </button>
                        <button
                            onClick={() => {
                                setMode('csv');
                                setError('');
                                setOutputText('');
                                setImage(null);
                                setFiles([]);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                mode === 'csv'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            CSV Splitter
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'csv' && (
                        <div>
                            <input type="file" accept=".txt" onChange={handleFileUpload} />
                            {loading && <p>Processing file...</p>}
                            {files.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-medium mt-4">Download split files:</h3>
                                    <ul>
                                    {files.map((file, index) => (
                                        <li key={index}>
                                            <a 
                                                href={`/api/download?file=${encodeURIComponent(file)}`} 
                                                download
                                                className="text-blue-600 hover:underline"
                                            >
                                                {file.split('/').pop()}
                                            </a>
                                        </li>
                                    ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {mode !== 'csv' && (
                        <div className="space-y-6">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={mode === 'translator'
                                    ? "Enter text here..."
                                    : "Describe your MARC metadata modification needs..."
                                }
                                maxLength={1000}
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />

                            {mode === 'translator' && (
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
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={loading || (!inputText && !image)}
                                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Analyze'}
                            </button>

                            {outputText && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-medium mb-2">Response</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg min-h-[100px] whitespace-pre-wrap">
                                        {outputText}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;