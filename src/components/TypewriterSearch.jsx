import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';

const TypewriterSearch = ({ onSearchClick }) => {
    const words = useMemo(() => ["Party Wear", "Pooja Wear", "Office Wear", "College Wear"], []);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(150);

    useEffect(() => {
        const handleTyping = () => {
            const fullText = words[currentWordIndex];

            if (isDeleting) {
                setCurrentText(fullText.substring(0, currentText.length - 1));
                setTypingSpeed(50);
            } else {
                setCurrentText(fullText.substring(0, currentText.length + 1));
                setTypingSpeed(150);
            }

            if (!isDeleting && currentText === fullText) {
                setTimeout(() => setIsDeleting(true), 1000);
            } else if (isDeleting && currentText === "") {
                setIsDeleting(false);
                setCurrentWordIndex((prev) => (prev + 1) % words.length);
            }
        };

        const timer = setTimeout(handleTyping, typingSpeed);
        return () => clearTimeout(timer);
    }, [currentText, isDeleting, currentWordIndex, words, typingSpeed]);

    return (
        <div
            className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm"
            onClick={onSearchClick}
        >
            <div className="relative w-full h-12 border border-white flex items-center px-4 cursor-pointer">
                <Search className="w-6 h-6 text-white mr-3" />
                <span className="text-white text-lg font-light">
                    Search "{currentText}<span className="animate-pulse">|</span>"
                </span>
            </div>
        </div>
    );
};

export default TypewriterSearch;
