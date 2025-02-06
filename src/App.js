import React, { useState, useRef } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Download } from 'lucide-react';

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
    // Add these state variables for Authorities mode
    const [number, setNumber] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    //Drop down menu
    const [activityStream, setActivityStream] = useState('label-updates'); // Default to label-updates
    const MONGODB_URI = process.env.MONGODB_URI;

    const activityStreamOptions = [
        { value: 'label-updates', label: 'Label Updates' },
        { value: 'subject-updates', label: 'Subject Updates' },
        { value: 'subject-adds', label: 'Subject Additions' },
        { value: 'subject-removals', label: 'Subject Removals/Deprecated' },
      ];

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

    // Add this function for handling label search
    const handleFindLabels = async () => {
        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            if (activityStream === 'label-updates') {
                const url = `https://id.loc.gov/authorities/names/activitystreams/${activityStream}/${number}`;
                const response = await fetch(url);
                const data = await response.json();

                const personalNameLabels = data.orderedItems
                    .filter(item => {
                        // Check if the item has object.type array containing "madsrdf:PersonalName"
                        return item.object?.type?.includes('madsrdf:PersonalName');
                    })
                    .map(item => {
                        try {
                            const summary = item.summary;
                            const originalLabel = summary.split("from '")[1].split("' to")[0];
                            return originalLabel;
                        } catch (error) {
                            console.error(`Error processing item: ${error}`);
                            return null;
                        }
                    })
                    .filter(Boolean);

                setResults(personalNameLabels);
            } else if (activityStream === 'subject-updates') {
                let madsXmlHrefs = [];
                const maxItems = 25;
                let nextPageUrl = `https://id.loc.gov/authorities/subjects/activitystreams/feed/${number}`;
            
                while (madsXmlHrefs.length < maxItems && nextPageUrl) {
                    const response = await fetch(nextPageUrl);
                    const data = await response.json();
            
                    // Extract the "next" URL from the API response
                    nextPageUrl = data.next.replace(/^http:/, 'https:');
            
                    const pageMadsXmlHrefs = data.orderedItems
                        .filter(item => {
                            // Check if the item has type "Update" and object.type array containing "madsrdf:Topic", "madsrdf:SimpleType", "madsrdf:Authority"
                            return (
                                item.type === 'Update' &&
                                item.object?.type?.includes('madsrdf:Topic') &&
                                item.object?.type?.includes('madsrdf:SimpleType') &&
                                item.object?.type?.includes('madsrdf:Authority')
                            );
                        })
                        .map(item => {
                            try {
                                // Find the url object with mediaType "application/mads+xml"
                                const madsXmlUrl = item.object.url.find(url => url.mediaType === 'application/mads+xml');
                                return madsXmlUrl?.href;
                            } catch (error) {
                                console.error(`Error processing item: ${error}`);
                                return null;
                            }
                        })
                        .filter(Boolean);
            
                    madsXmlHrefs = madsXmlHrefs.concat(pageMadsXmlHrefs);
            
                    // Stop if we've reached the desired number of items
                    if (madsXmlHrefs.length >= maxItems) {
                        break;
                    }
                }
            
                console.log(madsXmlHrefs.slice(0, maxItems)); // Trim to 25 items
            
                // Convert all URLs to HTTPS to avoid Mixed Content errors
                const httpsMadsXmlHrefs = madsXmlHrefs.map(href => href.replace(/^http:/, 'https:'));
            
                // Use fast-xml-parser for XML parsing
                const { XMLParser } = require('fast-xml-parser');
            
                for (const href of httpsMadsXmlHrefs.slice(0, maxItems)) {
                    try {
                        const response = await fetch(href);
                        const xml = await response.text();
                
                        // Parse the XML content using fast-xml-parser
                        const parser = new XMLParser();
                        const parsedData = parser.parse(xml);
                
                        // Extract relevant fields from the parsed XML
                        const marcRecord = parsedData['marcxml:record'];
                        const datafields = marcRecord['marcxml:datafield'];
                
                        const mainEntry = datafields.find(df => df['@_tag'] === '150');
                        const seeAlso = datafields.filter(df => df['@_tag'] === '450');
                        const relatedEntries = datafields.filter(df => df['@_tag'] === '550' && df['marcxml:subfield'].find(sf => sf['@_code'] === 'a'));
                
                        const doc = {
                            href,
                            mainEntry: mainEntry['marcxml:subfield'].find(sf => sf['@_code'] === 'a')._,
                            seeAlso: seeAlso.map(sa => sa['marcxml:subfield'].find(sf => sf['@_code'] === 'a')._),
                            relatedEntries: relatedEntries.map(re => re['marcxml:subfield'].find(sf => sf['@_code'] === 'a')._)
                        };
                
                        // Send the document to the API route
                        await fetch('/api/saveMadsEntry', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(doc),
                        });
                
                        console.log(`Inserted document for href: ${href}`);
                    } catch (error) {
                        console.error(`Error processing MADS XML for href: ${href}`, error);
                    }
                }
            
                setResults(httpsMadsXmlHrefs.slice(0, maxItems)); // Update results with processed hrefs
            }
        } catch (error) {
            setError('Error fetching or processing data. Please try again.');
            console.error(`Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([results.join('\n')], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'personal_name_labels.txt';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
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
                                    setNumber('');
                                    setResults([]);
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
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
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

                {mode === 'authorities' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Select Activity Stream:
                    </label>
                    <select
                        value={activityStream}
                        onChange={(e) => setActivityStream(e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {activityStreamOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                        ))}
                    </select>
                    </div>

                    <div className="flex gap-4">
                    <input
                        type="number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Enter number"
                        min="1"
                        className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        onClick={handleFindLabels}
                        disabled={isLoading || !number}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Find Label Changes'}
                    </button>
                    {results.length > 0 && (
                        <button
                        onClick={handleDownload}
                        variant="outline"
                        className="flex gap-2"
                        >
                        <Download size={16} />
                        Download Results
                        </button>
                    )}
                    </div>

                    {error && (
                    <div className="text-red-500 mb-4">{error}</div>
                    )}

                    {results.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-lg font-semibold mb-2">
                        Found Personal Name Labels ({results.length}):
                        </h3>
                        <div className="max-h-96 overflow-y-auto border rounded-md p-4">
                        {results.map((label, index) => (
                            <div key={index} className="mb-2">
                            {label}
                            </div>
                        ))}
                        </div>
                    </div>
                    )}
                </div>
                )}

                    {mode !== 'csv' && mode !== 'authorities' && (
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