import React, { useEffect, useRef } from 'react';

export default function MathText({ text, ...props }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      // Thay thế ký tự \n thô (do AI sinh ra nhầm) thành cú pháp xuống dòng \\ của LaTeX, ngoại trừ các lệnh LaTeX như \nearrow, \neq, \nu...
      const cleaned = (text || '').replace(/\\n(?![a-zA-Z])/g, '\\\\');
      ref.current.textContent = cleaned;
      if (window.renderMathInElement) {
        window.renderMathInElement(ref.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ]
        });
      }
    }
  }, [text]);

  return <span ref={ref} style={{ whiteSpace: 'pre-wrap' }} {...props} />;
}
