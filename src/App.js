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

    if (file.size > 25_000_000) {
        setError("File is too large! Please upload a file smaller than 25MB.");
        return;
    }

    if (!file.name.endsWith(".txt")) {
        setError("Please upload a CSV file!");
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/api/splitCsv", {
            method: "POST",
            body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "An error occurred");
        }
        
        setFiles(data.files);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
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

                {mode === 'csv' && (
                    <div>
                        <input type="file" accept=".txt" onChange={handleFileUpload} />
                        {error && <p style={{ color: "red" }}>{error}</p>}
                        {loading && <p>Processing file...</p>}
                        {files.length > 0 && (
                            <div>
                                <h3 className="text-lg font-medium mt-4">Download split files:</h3>
                                <ul>
                                    {files.map((file, index) => (
                                        <li key={index}>
                                            <a href={file} download>{file.split('/').pop()}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
);