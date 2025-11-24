import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Globe, Key, Languages, Brain } from 'lucide-react';
import { getSettings, saveSettings } from '../../utils/db';
import { useSync } from '../../context/SyncContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function SettingsTab() {
    const { t } = useTranslation();
    const { autoSync, isSyncing } = useSync();
    const [geminiKey, setGeminiKey] = useState('');
    const [useAiEnglish, setUseAiEnglish] = useState(false);
    const [showArabicTranslation, setShowArabicTranslation] = useState(false);
    const [newCardsPerDay, setNewCardsPerDay] = useState(20);
    const [desiredRetention, setDesiredRetention] = useState(0.9);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await getSettings() || {};
            setGeminiKey(settings.geminiKey || '');
            setUseAiEnglish(settings.useAiEnglish || false);
            setShowArabicTranslation(settings.showArabicTranslation || false);
            setNewCardsPerDay(settings.newCardsPerDay || 20);
            setDesiredRetention(settings.desiredRetention || 0.9);
        } catch (error) {
            console.error("Error loading settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const settings = {
                geminiKey,
                useAiEnglish,
                showArabicTranslation,
                newCardsPerDay,
                desiredRetention,
                updatedAt: new Date().toISOString()
            };
            await saveSettings(settings);
            autoSync(); // Trigger sync immediately
            alert(t('settings.saved_alert'));
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(t('settings.failed_save'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Language Settings */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Languages className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{t('settings.language_settings')}</h3>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-gray-300">{t('settings.app_language')}</span>
                    <LanguageSwitcher />
                </div>
            </div>

            {/* API Configuration */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Key className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{t('settings.api_config')}</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('settings.gemini_key')}
                        </label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            {t('settings.gemini_key_desc', { returnObjects: true }) /* Note: complex interpolation might need Trans component, but simple string works for now if no HTML needed. For HTML, use Trans. */}
                            Required for AI definitions. Get one for free at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">Google AI Studio</a>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Dictionary Preferences */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Globe className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{t('settings.dictionary_prefs')}</h3>
                </div>

                <div className="space-y-6">
                    {/* AI English Definitions */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-white mb-1">{t('settings.ai_english')}</h4>
                            <p className="text-sm text-gray-400">
                                {t('settings.ai_english_desc')}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useAiEnglish}
                                onChange={(e) => setUseAiEnglish(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* English to Arabic */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                        <div>
                            <h4 className="font-medium text-white mb-1">{t('settings.eng_ar_trans')}</h4>
                            <p className="text-sm text-gray-400">
                                {t('settings.eng_ar_trans_desc')}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showArabicTranslation}
                                onChange={(e) => setShowArabicTranslation(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Flashcard Settings */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Brain className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{t('settings.flashcard_settings')}</h3>
                </div>

                <div className="space-y-6">
                    {/* New Cards Per Day */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('settings.new_cards_per_day')}
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={newCardsPerDay}
                            onChange={(e) => setNewCardsPerDay(parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            {t('settings.new_cards_per_day_desc')}
                        </p>
                    </div>

                    {/* Desired Retention */}
                    <div className="pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">
                                {t('settings.desired_retention')}
                            </label>
                            <span className="text-lg font-bold text-purple-400">{(desiredRetention * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.75"
                            max="0.98"
                            step="0.01"
                            value={desiredRetention}
                            onChange={(e) => setDesiredRetention(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>75%</span>
                            <span>98%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {t('settings.desired_retention_desc')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                    {saving ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {saving ? t('settings.saving') : t('settings.save_settings')}
                </button>
            </div>
        </div>
    );
}
