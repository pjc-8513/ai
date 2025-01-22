import React, { useState } from 'react';
import InputArea from './InputArea';
import OutputArea from './OutputArea';
import LoadingSpinner from './LoadingSpinner';
import './styles.css';

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

            const response = await fetch('https://457491c0-648a-48da-a1ce-5b6e438b2b2e-00-s58llcr2petp.riker.replit.dev:3001/api/analyze', {
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
        <div className="app">
            <header><h1>AI Librarian Translator/transliterator</h1></header>
            {loading && <LoadingSpinner />}
            <div className="input-container">
                <InputArea text={inputText} setText={setInputText} />
                <input type="file" accept="image/*" onChange={handleImageChange} />
                <button onClick={handleAnalyze} disabled={loading}>Analyze</button>
            </div>
            <OutputArea outputText={outputText} />
        </div>
    );
}

export default App;
