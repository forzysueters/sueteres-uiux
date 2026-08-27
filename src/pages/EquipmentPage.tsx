import React, { useEffect, useState } from 'react';
import { EquipmentRegistrationForm } from '../components/EquipmentRegistrationForm';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { Package, CheckCircle2, ArrowRight, Inbox } from 'lucide-react';
import { AlertSkeleton } from '../components/SkeletonLoaders';
import { translations } from '../translations';

type RecentEquipment = { id: string; name: string; spec: string; date: string; assetTag: string | null };

export const EquipmentPage: React.FC = () => {
  const { selectedAssetId, language } = useAppStore();
  const t = translations[language].equipment;
  const howItWorks = [
    { step: 1, text: t.step1 },
    { step: 2, text: t.step2 },
    { step: 3, text: t.step3 },
    { step: 4, text: t.step4 },
  ];
  const [recent, setRecent] = useState<RecentEquipment[] | null>(null);

  const loadRecent = () => {
    setRecent(null);
    apiService
      .getRecentEquipment()
      .then(setRecent)
      .catch(() => setRecent([]));
  };

  useEffect(() => {
    loadRecent();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-3">
          <Package className="w-7 h-7 text-primary" />
          {t.title}
        </h1>
        <p>
          {t.subtitle}
        </p>
      </div>

      <div className="saas-card p-6 bg-card-hover">
        <span className="section-title">{t.how_it_works}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {howItWorks.map(({ step, text }, i) => (
            <div key={step} className="flex items-start gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-white flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <p className="text-xs font-medium text-muted leading-relaxed">{text}</p>
              </div>
              {i < 3 && (
                <ArrowRight size={14} className="hidden lg:block flex-shrink-0 mt-2.5 text-border-strong" />
              )}
            </div>
          ))}
        </div>
      </div>

      <EquipmentRegistrationForm assetId={selectedAssetId || undefined} />

      <div className="saas-card p-6">
        <span className="section-title">{t.recent}</span>
        {recent === null ? (
          <AlertSkeleton count={2} />
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="w-10 h-10 rounded-lg bg-card-hover border border-border flex items-center justify-center text-muted">
              <Inbox size={18} />
            </div>
            <p className="text-xs font-medium text-muted">{t.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map(({ id, name, spec, date, assetTag }) => (
              <div
                key={id}
                className="flex items-center justify-between p-4 rounded-lg bg-card-hover border border-border hover:bg-border/40 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-card-hover border border-border text-primary">
                    <Package size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground dark:text-white truncate">
                      {name}{assetTag ? ` (${assetTag})` : ''}
                    </p>
                    <p className="text-[10px] mt-0.5 font-mono text-muted truncate">{spec}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-[10px] font-medium text-muted-soft uppercase tracking-tight">{date}</span>
                  <span className="badge badge-success px-3 py-1">
                    <CheckCircle2 size={12} />
                    {t.registered}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
