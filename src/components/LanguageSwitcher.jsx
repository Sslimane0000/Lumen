import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ar' : 'en';
        i18n.changeLanguage(newLang);
        document.dir = newLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = newLang;
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-sm text-gray-300 hover:text-white"
            title={i18n.language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
            <Languages className="w-4 h-4" />
            <span className="font-medium uppercase">{i18n.language === 'en' ? 'AR' : 'EN'}</span>
        </button>
    );
}
