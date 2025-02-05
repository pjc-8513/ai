import React, { useState, useRef } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

function App() {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [image, setImage] = useState(null);
    const [mode, setMode] = useState('translator');
    const [files, setFiles] = useState([]);
    // First, add the state variable near the other useState declarations
    const [minHolds, setMinHolds] = useState(0);
    // Add these state variables with the other useState declarations
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
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
          
              if (mode === 'translator') {
                const candidates = data.candidates;
                const content = candidates[0].content;
                const parts = content.parts;
                const text = parts[0].text;
                const jsonData = JSON.parse(text);
                const original = jsonData.response.original;
                const translated = jsonData.response.translated;
                const transliterated = jsonData.response.transliterated;
          
                const formattedOutput = (
                  <div>
                    <h4>Original:</h4>
                    <ul>
                      {Object.keys(original).map((key) => (
                        <li key={key}>
                          <strong>{key}</strong>: {original[key]}
                        </li>
                      ))}
                    </ul>
          
                    <h4>Translated:</h4>
                    <ul>
                      {Object.keys(translated).map((key) => (
                        <li key={key}>
                          <strong>{key}</strong>: {translated[key]}
                        </li>
                      ))}
                    </ul>
          
                    <h4>Transliterated:</h4>
                    <ul>
                      {Object.keys(transliterated).map((key) => (
                        <li key={key}>
                          <strong>{key}</strong>: {transliterated[key]}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
          
                setOutputText(formattedOutput);
              } else {
                setOutputText(data.result || '');
              }
            } catch (error) {
              console.error("Analysis error:", error);
              setError(error.message || 'Error analyzing input');
            } finally {
              setLoading(false);
            }
          };

    // Then, update the handleFileUpload function to include minHolds in the request
    const handleFileUpload = async (event) => {
        setError(null);
        setFiles([]);

        // Clear any existing chunks first
        try {
            const clearResponse = await fetch('/api/clearChunks', {
                method: 'POST',
            });
            if (!clearResponse.ok) {
                throw new Error('Failed to clear existing chunks');
            }
        } catch (err) {
            console.error('Error clearing chunks:', err);
            // Continue anyway - not a fatal error
        }

        const file = event.target.files[0];

        if (!file) {
            setError("Please upload a txt file!");
            return;
        }

        if (file.size > 25_000_000) {
            setError("File is too large! Please upload a file smaller than 25MB.");
            return;
        }

        if (!file.name.endsWith(".txt")) {
            setError("Please upload a txt file!");
            return;
        }

        setLoading(true);

        try {
            const fileContent = await file.text();
            
            const response = await fetch("/api/splitCsv", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: fileContent,
                    filename: file.name,
                    minHolds: parseInt(minHolds, 10),
                    dateRange: startDate && endDate ? {
                        start: startDate.toISOString().split('T')[0].replace(/-/g, ''),
                        end: endDate.toISOString().split('T')[0].replace(/-/g, '')
                    } : null
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "An error occurred");
            }

            setFiles(data.chunkIds);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        try {
            // Clear the files from MongoDB
            const response = await fetch('/api/clearChunks', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to clear chunks');
            }

            // Clear the UI
            setFiles([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            setError('Error clearing files: ' + error.message);
        }
    };

    const getDownloadName = (chunkId, index) => {
        if (chunkId === 'titles_holds') {
            return 'title_holds.csv';
        }
        return `chunk_${index}.csv`;
    };

    const getLinkText = (chunkId, index) => {
        if (chunkId === 'titles_holds') {
            return 'Title Holds';
        }
        return `Download Part ${index}`;
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
                            CSV Magic
                        </button>
                        <button
                            onClick={() => {
                                setMode('authorities');
                                setError('');
                                setOutputText('');
                                setImage(null);
                                setFiles([]);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                mode === 'authorities'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Authorities
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
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Minimum Holds Threshold
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minHolds}
                                onChange={(e) => setMinHolds(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date Range Filter (Recv Date)
                            </label>
                            <div className="flex gap-2 items-center">
                                <DatePicker
                                    selected={startDate}
                                    onChange={date => setStartDate(date)}
                                    selectsStart
                                    startDate={startDate}
                                    endDate={endDate}
                                    placeholderText="Start Date"
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <span className="text-gray-500">to</span>
                                <DatePicker
                                    selected={endDate}
                                    onChange={date => setEndDate(date)}
                                    selectsEnd
                                    startDate={startDate}
                                    endDate={endDate}
                                    minDate={startDate}
                                    placeholderText="End Date"
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {(startDate || endDate) && (
                                    <button
                                        onClick={() => {
                                            setStartDate(null);
                                            setEndDate(null);
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <input type="file" accept=".txt,.csv" onChange={handleFileUpload} />
                            {loading && <p>Processing file...</p>}
                            {files.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-medium mt-4">Download split files:</h3>
                                    <ul>
                                    {files.map((chunkId, index) => (
                                            <li key={chunkId}>
                                                <a 
                                                    href={`/api/download/${chunkId}`} 
                                                    download={getDownloadName(chunkId, index)}
                                                    className="text-blue-600 hover:underline"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        try {
                                                            const response = await fetch(`/api/download/${chunkId}`);
                                                            if (!response.ok) {
                                                                const error = await response.json();
                                                                throw new Error(error.error || 'Download failed');
                                                            }
                                                            
                                                            const blob = await response.blob();
                                                            const url = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = getDownloadName(chunkId, index);
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            window.URL.revokeObjectURL(url);
                                                            document.body.removeChild(a);
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            setError(error.message);
                                                        }
                                                    }}
                                                >
                                                    {getLinkText(chunkId, index + 1)}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={handleClearAll}
                                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        Clear All
                                    </button>
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
                                    {typeof outputText === 'string' ? (
                                        <pre>{outputText}</pre>
                                    ) : (
                                        outputText
                                    )}
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