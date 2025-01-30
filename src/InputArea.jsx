import React from 'react';
function InputArea({ text, setText }) {
    return (
        <textarea
            className="input-area"
            placeholder="Enter text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
        />
    )
}
export default InputArea;