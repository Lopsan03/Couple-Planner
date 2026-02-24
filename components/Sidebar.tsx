
import React from 'react';
import { User } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: User;
  partner: User;
  language: 'en' | 'es';
  switchUser: () => void;
  showSwitchUser?: boolean;
  onProfileClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, currentUser, partner, language, switchUser, showSwitchUser = true, onProfileClick }) => {
  const isSpanish = language === 'es';
  const menuItems = [
    { id: 'calendar', label: isSpanish ? 'Calendario' : 'Calendar', icon: '📅' },
    { id: 'activities', label: isSpanish ? 'Banco de Actividades' : 'Activity Bank', icon: '🎲' },
    { id: 'budget', label: isSpanish ? 'Plan de Presupuesto' : 'Budget Plan', icon: '📊' },
    { id: 'goals', label: isSpanish ? 'Seguimiento de Metas' : 'Goals Tracker', icon: '🎯' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden lg:flex">
      <div className="p-6 border-b border-stone-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            S
          </div>
          <span className="font-bold text-lg tracking-tight">SyncLife</span>
        </div>

        <div className="space-y-4">
          <div className="flex -space-x-3 items-center py-1 overflow-visible">
            <button onClick={onProfileClick} className="rounded-full" title={isSpanish ? 'Abrir perfil' : 'Open profile'}>
              <img className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover" src={currentUser.avatar} alt={currentUser.name} />
            </button>
            <img className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover" src={partner.avatar} alt={partner.name} />
            {showSwitchUser && (
              <button 
                onClick={switchUser}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-stone-100 text-stone-500 ring-2 ring-white hover:bg-stone-200 transition-colors"
                title={isSpanish ? 'Cambiar usuario' : 'Switch user'}
              >
                🔄
              </button>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{isSpanish ? 'Sesión iniciada como' : 'Logged in as'}</p>
            <p className="font-medium text-stone-900">{currentUser.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === item.id 
                ? 'bg-stone-900 text-white shadow-md' 
                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6 text-xs text-stone-400 border-t border-stone-100">
        <p>&copy; 2024 SyncLife</p>
        <p>{isSpanish ? 'Diseñado para planificación estructurada' : 'Built for structured planning'}</p>
      </div>
    </aside>
  );
};

export default Sidebar;
