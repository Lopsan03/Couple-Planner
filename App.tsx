
import React, { useState, useEffect, useCallback } from 'react';
import { User, PlannerState, Activity, CalendarEvent, Goal, ActivityLog } from './types';
import { USERS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import BudgetDashboard from './components/BudgetDashboard';
import ActivityDB from './components/ActivityDB';
import GoalsSystem from './components/GoalsSystem';
import InsightsPanel from './components/InsightsPanel';

const INITIAL_STATE: PlannerState = {
  currentUser: USERS.DAVID,
  partner: USERS.CARLA,
  activities: [],
  events: [],
  sharedGoals: [],
  individualGoals: [],
  budget: { monthlyLimit: 2000 },
  logs: [],
};

const App: React.FC = () => {
  const [state, setState] = useState<PlannerState>(() => {
    const saved = localStorage.getItem('couple_planner_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentUser?.id === 'user-1') parsed.currentUser.name = 'David';
      if (parsed.currentUser?.id === 'user-2') parsed.currentUser.name = 'Carla';
      if (parsed.partner?.id === 'user-1') parsed.partner.name = 'David';
      if (parsed.partner?.id === 'user-2') parsed.partner.name = 'Carla';
      return parsed;
    }
    return INITIAL_STATE;
  });
  
  const [currentTab, setCurrentTab] = useState('calendar');

  useEffect(() => {
    localStorage.setItem('couple_planner_data', JSON.stringify(state));
  }, [state]);

  const addLog = useCallback((message: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      message,
      userName: state.currentUser.name,
    };
    setState(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50)
    }));
  }, [state.currentUser.name]);

  const switchUser = () => {
    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser.id === USERS.DAVID.id ? USERS.CARLA : USERS.DAVID,
      partner: prev.currentUser.id === USERS.DAVID.id ? USERS.DAVID : USERS.CARLA,
    }));
  };

  const updateState = <K extends keyof PlannerState>(key: K, value: PlannerState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const actions = {
    addActivity: (activity: Activity) => {
      updateState('activities', [...state.activities, activity]);
      addLog(`Created activity: ${activity.name}`);
    },
    updateActivity: (activity: Activity) => {
      updateState('activities', state.activities.map(a => a.id === activity.id ? activity : a));
      addLog(`Updated activity: ${activity.name}`);
    },
    deleteActivity: (id: string) => {
      updateState('activities', state.activities.filter(a => a.id !== id));
      addLog(`Deleted an activity`);
    },
    addEvent: (event: CalendarEvent) => {
      updateState('events', [...state.events, event]);
      addLog(`Added calendar event: ${event.customName || 'Activity'}`);
    },
    updateEvent: (event: CalendarEvent) => {
      updateState('events', state.events.map(e => e.id === event.id ? event : e));
      addLog(`Updated event: ${event.customName || 'Activity'}`);
    },
    deleteEvent: (id: string) => {
      updateState('events', state.events.filter(e => e.id !== id));
      addLog(`Removed an event from calendar`);
    },
    addSharedGoal: (goal: Goal) => {
      updateState('sharedGoals', [...state.sharedGoals, goal]);
      addLog(`Created shared goal: ${goal.title}`);
    },
    updateSharedGoal: (goal: Goal) => {
      updateState('sharedGoals', state.sharedGoals.map(g => g.id === goal.id ? goal : g));
      addLog(`Updated shared goal: ${goal.title}`);
    },
    addIndividualGoal: (goal: Goal) => {
      updateState('individualGoals', [...state.individualGoals, goal]);
      addLog(`Created personal goal: ${goal.title}`);
    },
    updateIndividualGoal: (goal: Goal) => {
      updateState('individualGoals', state.individualGoals.map(g => g.id === goal.id ? goal : g));
      addLog(`Updated personal goal: ${goal.title}`);
    },
    updateBudgetLimit: (limit: number) => {
      updateState('budget', { monthlyLimit: limit });
      addLog(`Updated monthly budget limit to $${limit}`);
    }
  };

  const menuItems = [
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'activities', label: 'Bank', icon: '🎲' },
    { id: 'budget', label: 'Budget', icon: '📊' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <header className="lg:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">C</div>
          <span className="font-black text-stone-900 tracking-tight">PlannerPro</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={switchUser} className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-xs shadow-sm bg-stone-50">🔄</button>
          <img className="h-8 w-8 rounded-full ring-2 ring-emerald-500" src={state.currentUser.avatar} alt={state.currentUser.name} />
        </div>
      </header>

      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        currentUser={state.currentUser}
        partner={state.partner}
        switchUser={switchUser}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="hidden md:block">
              <h1 className="text-3xl font-black text-stone-900 capitalize tracking-tight">{currentTab}</h1>
              <p className="text-stone-500 font-medium">Welcome back, {state.currentUser.name}</p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-stone-200">
               <InsightsPanel state={state} />
            </div>
          </header>

          <section className="animate-in fade-in duration-500">
            {currentTab === 'calendar' && (
              <CalendarView state={state} actions={actions} />
            )}
            {currentTab === 'activities' && (
              <ActivityDB state={state} actions={actions} />
            )}
            {currentTab === 'budget' && (
              <BudgetDashboard state={state} actions={actions} />
            )}
            {currentTab === 'goals' && (
              <GoalsSystem state={state} actions={actions} />
            )}
          </section>

          <footer className="pt-8 border-t border-stone-200 hidden md:block">
            <h3 className="text-[10px] font-black text-stone-400 mb-4 uppercase tracking-[0.2em]">Recent Activity</h3>
            <div className="space-y-3">
              {state.logs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm text-stone-600">
                  <span className="font-black text-stone-900">{log.userName}</span>
                  <span className="font-medium">{log.message}</span>
                  <span className="text-stone-400 text-xs ml-auto font-bold">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {state.logs.length === 0 && <p className="text-stone-400 text-sm font-medium">No activity yet.</p>}
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 flex justify-between items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] rounded-t-3xl">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === item.id ? 'text-emerald-600' : 'text-stone-400'
            }`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
