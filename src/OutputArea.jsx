import React from "react";

const OutputArea = ({outputText}) => {
    return (
        <div className="output-area">
            {outputText ? <pre>{outputText}</pre> : <p>Response will appear here</p>}
        </div>
    );
}

export default OutputArea;