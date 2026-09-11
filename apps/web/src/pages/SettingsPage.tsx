import React from 'react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { Sun, Moon, Languages, Palette, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    primaryColor, 
    setPrimaryColor, 
    language, 
    setLanguage 
  } = useAppStore();

  const t = translations[language].settings;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personalização */}
        <div className="saas-card p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Palette size={20} />
            </div>
            <h3 className="!mb-0">{t.personalization}</h3>
          </div>

          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card-hover border border-border">
              <div className="flex min-w-0 items-center gap-3">
                {darkMode ? <Moon size={18} className="text-muted flex-shrink-0" /> : <Sun size={18} className="text-muted flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground dark:text-white">{t.theme_mode}</p>
                  <p className="text-xs text-muted">{t.theme_desc}</p>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`w-12 h-6 flex-shrink-0 rounded-full transition-all relative ${darkMode ? 'bg-primary' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${darkMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Color Accent Selection */}
            <div className="flex flex-col gap-4 p-4 rounded-xl bg-card-hover border border-border">
              <div className="flex min-w-0 items-center gap-3">
                <Palette size={18} className="text-muted flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground dark:text-white">{t.accent_color}</p>
                  <p className="text-xs text-muted">{t.accent_desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {/* Orange Option */}
                <button 
                  onClick={() => setPrimaryColor('orange')}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${primaryColor === 'orange' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}
                >
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-[#f59e0b] shadow-lg flex items-center justify-center">
                    {primaryColor === 'orange' && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-xs font-bold text-foreground whitespace-nowrap">Forzy (Orange)</span>
                </button>

                {/* Purple Option */}
                <button 
                  onClick={() => setPrimaryColor('purple')}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${primaryColor === 'purple' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}
                >
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-[#8B5CF6] shadow-lg flex items-center justify-center">
                    {primaryColor === 'purple' && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-xs font-bold text-foreground whitespace-nowrap">Classic (Purple)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Idioma */}
        <div className="saas-card p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Languages size={20} />
            </div>
            <h3 className="!mb-0">{t.language}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-4 p-4 rounded-xl bg-card-hover border border-border sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Languages size={18} className="text-muted flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground dark:text-white">{t.lang_system}</p>
                  <p className="text-xs text-muted">{t.lang_desc}</p>
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={() => setLanguage('pt')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${language === 'pt' ? 'bg-primary border-primary text-white' : 'border-border text-muted hover:border-primary/50'}`}
                >
                  PT-BR
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${language === 'en' ? 'bg-primary border-primary text-white' : 'border-border text-muted hover:border-primary/50'}`}
                >
                  EN-US
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
