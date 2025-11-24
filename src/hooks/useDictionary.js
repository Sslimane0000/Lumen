import { useState } from 'react';
import { fetchDefinition } from '../features/dictionary/dictionaryService';
import { saveWord } from '../utils/db';
import { useTranslation } from 'react-i18next';
import { useSync } from '../context/SyncContext';

export function useDictionary() {
    const { t } = useTranslation();
    const { autoSync } = useSync();

    const [selectedWord, setSelectedWord] = useState(null);
    const [definition, setDefinition] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    const handleWordSelect = async (word, position) => {
        setPopupPosition(position);
        setSelectedWord(word);
        setDefinition(null);

        const def = await fetchDefinition(word);
        setDefinition(def);
    };

    const handleSelectSuggestion = async (selectedWord) => {
        const def = await fetchDefinition(selectedWord);
        setDefinition(def);
    };

    const handleSaveWord = async (def) => {
        if (def) {
            await saveWord(def);
            alert(t('reader.saved_to_vocab', { word: def.word }));
            setSelectedWord(null); // Close popup
            autoSync();
        }
    };

    const closePopup = () => {
        setSelectedWord(null);
        setDefinition(null);
    };

    return {
        selectedWord,
        definition,
        suggestions,
        popupPosition,
        handleWordSelect,
        handleSelectSuggestion,
        handleSaveWord,
        closePopup
    };
}
