
import React, { useEffect, useMemo, useState } from 'react';
import { PlannerState, Goal, GoalTask, GoalContribution } from '../types';
import { CATEGORY_ICONS } from '../constants';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const formatCurrencyCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

interface GoalsSystemProps {
  state: PlannerState;
  actions: any;
}

const GoalsSystem: React.FC<GoalsSystemProps> = ({ state, actions }) => {
  const [activeTab, setActiveTab] = useState<'shared' | 'individual'>('shared');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const goals = activeTab === 'shared' ? state.sharedGoals : state.individualGoals;
  
  const selectedGoal = useMemo(() => 
    goals.find(g => g.id === selectedGoalId) || null,
    [goals, selectedGoalId]
  );

  const getOwnerName = (goal: Goal) => {
    if (!goal.userId) return null;
    if (goal.userId === state.currentUser.id) return state.currentUser.name;
    if (goal.userId === state.partner.id) return state.partner.name;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-sm flex inline-flex w-auto self-start">
        <button 
          onClick={() => setActiveTab('shared')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'shared' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500'}`}
        >
          Shared Goals
        </button>
        <button 
          onClick={() => setActiveTab('individual')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'individual' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500'}`}
        >
          Individual Goals
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => (
          <GoalCard 
            key={goal.id} 
            goal={goal} 
            ownerName={getOwnerName(goal)}
            isOwner={activeTab === 'shared' || goal.userId === state.currentUser.id}
            onClick={() => setSelectedGoalId(goal.id)}
          />
        ))}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="h-full min-h-[220px] border-2 border-dashed border-stone-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-stone-400 hover:border-emerald-500 hover:text-emerald-500 transition-all bg-stone-50/50 group"
        >
          <span className="text-4xl group-hover:scale-110 transition-transform">🎯</span>
          <span className="font-bold">Set a New {activeTab === 'shared' ? 'Shared' : 'Individual'} Goal</span>
        </button>
      </div>

      {isModalOpen && (
        <GoalModal 
          type={activeTab} 
          onClose={() => setIsModalOpen(false)} 
          onSave={activeTab === 'shared' ? actions.addSharedGoal : actions.addIndividualGoal}
          currentUser={state.currentUser}
        />
      )}

      {selectedGoal && (
        <GoalDetailModal 
          goal={selectedGoal} 
          isOwner={activeTab === 'shared' || selectedGoal.userId === state.currentUser.id}
          onClose={() => setSelectedGoalId(null)}
          onUpdate={activeTab === 'shared' ? actions.updateSharedGoal : actions.updateIndividualGoal}
          onDelete={activeTab === 'shared' ? actions.deleteSharedGoal : actions.deleteIndividualGoal}
          currentUser={state.currentUser}
        />
      )}
    </div>
  );
};

const GoalCard = ({ goal, ownerName, isOwner, onClick }: any) => {
  const mainIcon = goal.financialTarget ? '💰' : '🎯';
  const dueDateText = new Date(goal.targetDate).toLocaleDateString();
  const dueTimeText = goal.targetTime ? ` ${goal.targetTime}` : '';
  
  return (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-emerald-500 transition-all hover:shadow-lg"
    >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${goal.status === 'Completed' ? 'bg-emerald-500' : 'bg-stone-200'}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3 items-center">
          <span className="text-2xl p-2 bg-stone-50 rounded-xl">{mainIcon}</span>
          <div>
            <h3 className="font-bold text-stone-900 group-hover:text-emerald-700 transition-colors">{goal.title}</h3>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Due: {dueDateText}{dueTimeText}</p>
              {ownerName && (
                <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 font-bold uppercase">{ownerName}'s</span>
              )}
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
          goal.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {goal.status}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end text-xs mb-1">
          <span className="font-bold text-stone-400 uppercase tracking-tighter">
            {goal.financialTarget ? 'Financial' : 'Progress'}
          </span>
          <span className="font-bold text-stone-900">{goal.progressPercentage}%</span>
        </div>
        <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-600 transition-all duration-700 ease-out" 
            style={{ width: `${goal.progressPercentage}%` }} 
          />
        </div>
        <p className="text-[11px] text-stone-500 font-medium">
          {goal.financialTarget 
            ? `${formatCurrency(goal.currentAmount || 0)} of ${formatCurrency(goal.financialTarget || 0)}` 
            : `${(goal.tasks || []).filter((t:any) => t.completed).length} of ${(goal.tasks || []).length} tasks complete`}
        </p>
      </div>
    </div>
  );
};

const GoalDetailModal = ({ goal, isOwner, onClose, onUpdate, onDelete, currentUser }: any) => {
  const [inputValue, setInputValue] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [subtaskStartTime, setSubtaskStartTime] = useState('11:00');
  const [subtaskEndTime, setSubtaskEndTime] = useState('12:00');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: goal.title,
    description: goal.description || '',
    category: goal.category,
    targetDate: goal.targetDate,
    targetTime: goal.targetTime || '09:00',
    financialTarget: goal.financialTarget !== undefined ? String(goal.financialTarget) : '',
  });

  useEffect(() => {
    setIsEditingGoal(false);
    setEditFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      targetDate: goal.targetDate,
      targetTime: goal.targetTime || '09:00',
      financialTarget: goal.financialTarget !== undefined ? String(goal.financialTarget) : '',
    });
  }, [goal.id, goal.title, goal.description, goal.category, goal.targetDate, goal.targetTime, goal.financialTarget]);

  const calculateProgress = (updatedGoal: Goal) => {
    let progress = 0;
    if (updatedGoal.financialTarget) {
      const total = (updatedGoal.contributions || []).reduce((acc, c) => acc + c.amount, 0);
      updatedGoal.currentAmount = total;
      const target = updatedGoal.financialTarget;
      if (target > 0) {
        progress = Math.min(100, Number(((total / target) * 100).toFixed(2)));
      } else {
        progress = 0;
      }
    } else if (updatedGoal.tasks && updatedGoal.tasks.length > 0) {
      const completed = updatedGoal.tasks.filter(t => t.completed).length;
      progress = Math.round((completed / updatedGoal.tasks.length) * 100);
    } else {
      progress = 0;
    }
    updatedGoal.progressPercentage = progress;
    if (progress === 100) updatedGoal.status = 'Completed';
    else if (progress > 0) updatedGoal.status = 'In Progress';
    else updatedGoal.status = 'Not Started';
    return updatedGoal;
  };

  const handleAction = () => {
    if (!inputValue || !isOwner) return;
    
    let updatedGoal = { ...goal };
    if (goal.financialTarget) {
      if (isNaN(Number(inputValue))) return;
      const newContribution: GoalContribution = {
        id: Math.random().toString(36).substr(2, 9),
        amount: Number(inputValue),
        date: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name
      };
      updatedGoal.contributions = [...(goal.contributions || []), newContribution];
    } else {
      const newTask: GoalTask = { 
        id: Math.random().toString(36).substr(2, 9), 
        text: inputValue, 
        completed: false,
        dueDate: subtaskDueDate || undefined,
        startTime: subtaskDueDate ? subtaskStartTime : undefined,
        endTime: subtaskDueDate ? subtaskEndTime : undefined
      };
      updatedGoal.tasks = [...(goal.tasks || []), newTask];
    }
    
    onUpdate(calculateProgress(updatedGoal));
    setInputValue('');
    setSubtaskDueDate('');
    setSubtaskStartTime('11:00');
    setSubtaskEndTime('12:00');
  };

  const toggleTask = (taskId: string) => {
    if (!isOwner) return;
    const updatedTasks = (goal.tasks || []).map((t: GoalTask) => t.id === taskId ? { ...t, completed: !t.completed } : t);
    onUpdate(calculateProgress({ ...goal, tasks: updatedTasks }));
  };

  const deleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner) return;
    const updatedTasks = (goal.tasks || []).filter((t: GoalTask) => t.id !== taskId);
    onUpdate(calculateProgress({ ...goal, tasks: updatedTasks }));
  };

  const saveGoalDetails = () => {
    if (!isOwner) return;
    if (!editFormData.title.trim()) return;

    let nextFinancialTarget = goal.financialTarget;
    if (goal.financialTarget !== undefined) {
      const parsedTarget = Number(editFormData.financialTarget);
      if (Number.isFinite(parsedTarget) && parsedTarget > 0) {
        nextFinancialTarget = parsedTarget;
      }
    }

    const updatedGoal: Goal = {
      ...goal,
      title: editFormData.title.trim(),
      description: editFormData.description.trim(),
      category: editFormData.category as Goal['category'],
      targetDate: editFormData.targetDate,
      targetTime: editFormData.targetTime,
      financialTarget: nextFinancialTarget,
    };

    onUpdate(calculateProgress(updatedGoal));
    setIsEditingGoal(false);
  };

  const deleteGoal = () => {
    if (!isOwner) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteGoal = () => {
    onDelete(goal.id);
    onClose();
  };

  const mainIcon = goal.financialTarget ? '💰' : '🎯';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 md:p-6 overflow-hidden">
      <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl w-full max-w-6xl max-h-full flex flex-col relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 md:top-8 md:right-8 text-stone-300 hover:text-stone-900 transition-colors text-3xl md:text-4xl z-50 font-light"
        >
          ✕
        </button>
        
        {/* Scrollable Container for Modal Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col overscroll-contain">
          <div className="p-8 md:p-14">
            {/* Header Section */}
            <div className="mb-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-stone-50 rounded-[2.5rem] flex items-center justify-center text-5xl md:text-7xl shadow-sm border border-stone-100 shrink-0">
                {mainIcon}
              </div>
              <div className="flex-1 min-w-0 text-center md:text-left">
                <h2 className="text-3xl md:text-5xl font-black text-stone-900 mb-4 tracking-tight leading-tight">{goal.title}</h2>
                <p className="text-stone-500 text-lg md:text-2xl leading-relaxed max-w-4xl">{goal.description || 'No description provided.'}</p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
              
              {/* LEFT SIDE: Ledger/Tasks Column */}
              <div className="lg:col-span-7 flex flex-col bg-stone-50/50 rounded-[2.5rem] md:rounded-[3rem] border border-stone-200/50 shadow-inner overflow-hidden">
                <header className="px-8 py-6 border-b border-stone-100 flex justify-between items-center bg-white/60 backdrop-blur-md sticky top-0 z-10">
                  <h4 className="font-black text-stone-900 uppercase text-[11px] tracking-[0.25em]">
                    {goal.financialTarget ? 'Contribution Ledger' : 'Milestone Checklist'}
                  </h4>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-4 py-1.5 rounded-full uppercase">
                    {goal.financialTarget ? `${(goal.contributions || []).length} Records` : `${(goal.tasks || []).length} Items`}
                  </span>
                </header>

                <div className="flex-1 p-6 md:p-10 space-y-4 min-h-[400px]">
                  {goal.financialTarget ? (
                    (goal.contributions || []).length > 0 ? (
                      [...(goal.contributions || [])].reverse().map((c: GoalContribution) => (
                        <div key={c.id} className="flex justify-between items-center p-6 bg-white rounded-[2rem] border border-stone-100 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md animate-in slide-in-from-bottom-2">
                          <div>
                            <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-700 tracking-tight break-all">+ {formatCurrency(c.amount)}</p>
                            <p className="text-[11px] text-stone-400 uppercase font-black tracking-widest mt-1.5">By {c.userName} • {new Date(c.date).toLocaleDateString()}</p>
                          </div>
                          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl">✓</div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full py-20 flex flex-col items-center justify-center text-stone-300 opacity-60 space-y-5">
                        <span className="text-8xl">💵</span>
                        <p className="text-xl font-bold italic tracking-tight">Record your first contribution</p>
                      </div>
                    )
                  ) : (
                    (goal.tasks || []).length > 0 ? (
                      (goal.tasks || []).map((task: GoalTask) => (
                        <div 
                          key={task.id} 
                          onClick={() => toggleTask(task.id)}
                          className={`flex items-center gap-6 p-6 rounded-[2rem] border-2 transition-all cursor-pointer group animate-in slide-in-from-left-2 ${
                            task.completed ? 'bg-emerald-50/50 border-emerald-500/20 text-emerald-800' : 'bg-white border-stone-100 hover:border-stone-300'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${
                            task.completed 
                              ? 'bg-emerald-600 border-emerald-600 text-white scale-110 shadow-lg' 
                              : 'border-stone-200 bg-white group-hover:border-emerald-400'
                          }`}>
                            {task.completed && <span className="text-base font-black">✓</span>}
                          </div>
                          <span className={`flex-1 text-base md:text-lg font-bold tracking-tight ${task.completed ? 'line-through opacity-40' : 'text-stone-700'}`}>
                            {task.text}
                            {task.dueDate && (
                              <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                                Due {new Date(task.dueDate).toLocaleDateString()}{task.startTime ? ` ${task.startTime}` : ''}{task.endTime ? ` - ${task.endTime}` : ''}
                              </span>
                            )}
                          </span>
                          {isOwner && (
                            <button 
                                onClick={(e) => deleteTask(task.id, e)}
                                className="p-3 text-stone-300 hover:text-rose-500 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50"
                            >
                                🗑️
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="h-full py-20 flex flex-col items-center justify-center text-stone-300 opacity-60 space-y-5">
                        <span className="text-8xl">🎯</span>
                        <p className="text-xl font-bold italic tracking-tight">Set your first milestone</p>
                      </div>
                    )
                  )}
                </div>

                {/* Input Area: Sticky-like but at the bottom of the column */}
                {isOwner && (
                  <div className="p-8 md:p-10 border-t border-stone-100 bg-white/90 backdrop-blur-md sticky bottom-0 z-10">
                    {goal.financialTarget ? (
                      <div className="flex flex-col sm:flex-row gap-4">
                        <input 
                          type="number"
                          placeholder="Amount in Dollars ($)..."
                          className="flex-1 bg-stone-50 border-2 border-stone-200 rounded-[1.5rem] px-8 py-5 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-base font-bold shadow-sm"
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                        />
                        <button 
                          onClick={handleAction}
                          className="bg-stone-900 text-white px-10 py-5 rounded-[1.5rem] font-black hover:bg-stone-800 transition-all transform active:scale-95 shadow-xl flex items-center justify-center uppercase tracking-[0.2em] text-[11px] shrink-0"
                        >
                          Add Cash
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                          <div className="md:col-span-8 space-y-2">
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Subtask</label>
                            <input 
                              type="text"
                              placeholder="What is the next step?..."
                              className="w-full h-[60px] bg-stone-50 border-2 border-stone-200 rounded-[1.25rem] px-6 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-base font-bold shadow-sm"
                              value={inputValue}
                              onChange={e => setInputValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                            />
                          </div>

                          <div className="md:col-span-4 space-y-2">
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Date</label>
                            <input
                              type="date"
                              className="w-full h-[60px] bg-stone-50 border-2 border-stone-200 rounded-[1.25rem] px-4 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-bold shadow-sm"
                              value={subtaskDueDate}
                              onChange={e => setSubtaskDueDate(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Start Time</label>
                            <input
                              type="time"
                              className="w-full h-[60px] bg-stone-50 border-2 border-stone-200 rounded-[1.25rem] px-4 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-bold shadow-sm"
                              value={subtaskStartTime}
                              onChange={e => setSubtaskStartTime(e.target.value)}
                              disabled={!subtaskDueDate}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">End Time</label>
                            <input
                              type="time"
                              className="w-full h-[60px] bg-stone-50 border-2 border-stone-200 rounded-[1.25rem] px-4 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-bold shadow-sm"
                              value={subtaskEndTime}
                              onChange={e => setSubtaskEndTime(e.target.value)}
                              disabled={!subtaskDueDate}
                            />
                          </div>
                        </div>

                        <div className="pt-1">
                          <button 
                            onClick={handleAction}
                            className="w-full sm:w-auto min-w-[220px] h-[60px] bg-stone-900 text-white rounded-[1.25rem] px-8 font-black hover:bg-stone-800 transition-all transform active:scale-95 shadow-xl flex items-center justify-center uppercase tracking-[0.2em] text-[10px]"
                          >
                            Add Item
                          </button>
                        </div>

                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em]">Select a date to enable start and end time</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Stats / Info Column */}
              <div className="lg:col-span-5 space-y-10">
                {isOwner && (
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-stone-200 shadow-sm space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setIsEditingGoal(prev => !prev)}
                        className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold hover:bg-stone-50"
                      >
                        {isEditingGoal ? 'Cancel Edit' : 'Edit Goal'}
                      </button>
                      <button
                        onClick={deleteGoal}
                        className="px-5 py-2.5 rounded-xl border border-rose-200 text-rose-700 font-bold hover:bg-rose-50"
                      >
                        Delete Goal
                      </button>
                    </div>

                    {isEditingGoal && (
                      <div className="space-y-3 pt-2">
                        <input
                          className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-bold outline-none"
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          placeholder="Goal title"
                        />
                        <textarea
                          className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-medium outline-none"
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                          placeholder="Description"
                          rows={3}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <select
                            className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-bold outline-none"
                            value={editFormData.category}
                            onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as Goal['category'] })}
                          >
                            {['Financial', 'Health', 'Travel', 'Relationship', 'Career'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input
                            type="date"
                            className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-bold outline-none"
                            value={editFormData.targetDate}
                            onChange={(e) => setEditFormData({ ...editFormData, targetDate: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="time"
                            className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-bold outline-none"
                            value={editFormData.targetTime}
                            onChange={(e) => setEditFormData({ ...editFormData, targetTime: e.target.value })}
                          />
                          {goal.financialTarget !== undefined && (
                            <input
                              type="number"
                              min="1"
                              className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl px-4 py-3 font-bold outline-none"
                              value={editFormData.financialTarget}
                              onChange={(e) => setEditFormData({ ...editFormData, financialTarget: e.target.value })}
                              placeholder="Savings target"
                            />
                          )}
                        </div>
                        <button
                          onClick={saveGoalDetails}
                          className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800"
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border-2 border-stone-100 shadow-sm space-y-10">
                  <div>
                    <div className="flex justify-between items-end mb-6">
                      <span className="text-[12px] font-black text-stone-400 uppercase tracking-[0.3em]">Total Progress</span>
                      <span className="text-6xl md:text-7xl font-black text-stone-900 tabular-nums leading-none tracking-tighter">{goal.progressPercentage}%</span>
                    </div>
                    <div className="h-8 bg-stone-100 rounded-full overflow-hidden border border-stone-50 shadow-inner p-1.5">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-400 transition-all duration-1000 ease-out bg-[length:200%_100%] animate-pulse rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
                        style={{ width: `${goal.progressPercentage}%` }} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 pt-8 border-t border-stone-50">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Goal Status</p>
                      <div className="flex items-center gap-3">
                        <div className={`w-3.5 h-3.5 rounded-full ${goal.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                        <p className="text-sm font-black text-stone-900 uppercase tracking-tight">{goal.status}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Due Date</p>
                      <p className="text-sm font-black text-stone-900 uppercase tracking-tight">{new Date(goal.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{goal.targetTime ? ` ${goal.targetTime}` : ''}</p>
                    </div>
                  </div>
                </div>

                <div className="p-12 md:p-16 bg-gradient-to-br from-stone-900 to-stone-950 rounded-[3rem] md:rounded-[4rem] text-white shadow-2xl relative overflow-hidden group min-h-[300px] flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-125 transition-transform duration-[2000ms] pointer-events-none select-none">
                    <span className="text-[15rem] leading-none">{mainIcon}</span>
                  </div>
                  <div className="relative z-10 space-y-6">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-[0.5em] mb-4">Milestone Overview</h4>
                    <div className="space-y-3">
                      <p className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter tabular-nums leading-tight break-all max-w-full">
                        {goal.financialTarget ? formatCurrencyCompact(goal.currentAmount || 0) : `${(goal.tasks || []).filter((t:any) => t.completed).length}`}
                      </p>
                      <p className="text-stone-400 font-bold text-base md:text-xl tracking-tight leading-snug break-words">
                        {goal.financialTarget 
                          ? `contributed toward your total target of ${formatCurrency(goal.financialTarget || 0)}` 
                          : `milestones checked off out of ${(goal.tasks || []).length} planned actions`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isDeleteConfirmOpen && (
          <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl shadow-2xl p-7">
              <h4 className="text-xl font-black text-stone-900">Delete this goal?</h4>
              <p className="text-sm text-stone-600 mt-2">This action cannot be undone. All related progress and entries for this goal will be removed.</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteGoal}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                >
                  Delete Goal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GoalModal = ({ type, onClose, onSave, currentUser }: any) => {
  const [formData, setFormData] = useState<Partial<Goal>>({
    title: '',
    description: '',
    category: 'Financial',
    targetDate: new Date().toISOString().split('T')[0],
    targetTime: '09:00',
    financialTarget: undefined,
    currentAmount: 0,
    progressPercentage: 0,
    status: 'Not Started',
    tasks: [],
    contributions: []
  });
  const [financialTargetInput, setFinancialTargetInput] = useState('');

  const isMoney = formData.financialTarget !== undefined;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl p-10 md:p-16 my-auto animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-4xl font-black mb-12 text-stone-900 tracking-tight leading-none">Create {type === 'shared' ? 'Shared' : 'Personal'} Goal</h3>
        <div className="space-y-10">
          <div className="space-y-3">
            <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">Goal Name</label>
            <input 
              className="w-full border-2 border-stone-100 rounded-[1.75rem] px-8 py-6 bg-stone-50 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-xl transition-all"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Save for Wedding"
            />
          </div>
          
          <div className="space-y-4">
            <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">How will you measure it?</label>
            <div className="grid grid-cols-2 gap-5">
              <button 
                onClick={() => {
                  setFormData({ ...formData, financialTarget: 0 });
                  setFinancialTargetInput('');
                }}
                className={`py-6 rounded-[1.75rem] border-2 font-black text-sm transition-all flex items-center justify-center gap-4 ${isMoney ? 'bg-stone-900 border-stone-900 text-white shadow-2xl scale-[1.03]' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <span className="text-2xl">💰</span> MONEY
              </button>
              <button 
                onClick={() => setFormData({...formData, financialTarget: undefined})}
                className={`py-6 rounded-[1.75rem] border-2 font-black text-sm transition-all flex items-center justify-center gap-4 ${!isMoney ? 'bg-stone-900 border-stone-900 text-white shadow-2xl scale-[1.03]' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <span className="text-2xl">🎯</span> TASKS
              </button>
            </div>
          </div>

          {isMoney && (
            <div className="animate-in slide-in-from-top-4 duration-300 space-y-3">
              <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">Target Total ($)</label>
              <input 
                type="number"
                className="w-full border-2 border-stone-100 rounded-[1.75rem] px-8 py-6 bg-stone-50 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-black text-2xl transition-all"
                value={financialTargetInput}
                onChange={e => {
                  const nextValue = e.target.value;
                  setFinancialTargetInput(nextValue);
                  setFormData({
                    ...formData,
                    financialTarget: nextValue === '' ? 0 : Number(nextValue),
                  });
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">Category</label>
              <select className="w-full border-2 border-stone-100 rounded-[1.75rem] px-7 py-5 bg-stone-50 font-black outline-none appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                {['Financial', 'Health', 'Travel', 'Relationship', 'Career'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">Deadline</label>
              <input type="date" className="w-full border-2 border-stone-100 rounded-[1.75rem] px-7 py-5 bg-stone-50 font-black outline-none" value={formData.targetDate} onChange={e => setFormData({...formData, targetDate: e.target.value})} />
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.3em]">Time</label>
              <input type="time" className="w-full border-2 border-stone-100 rounded-[1.75rem] px-7 py-5 bg-stone-50 font-black outline-none" value={formData.targetTime || '09:00'} onChange={e => setFormData({...formData, targetTime: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mt-14">
          <button 
            onClick={() => { 
              if(!formData.title) return alert('Please enter a goal name');
              if (isMoney && (financialTargetInput.trim() === '' || Number(financialTargetInput) <= 0)) {
                return alert('Please enter a valid savings target amount');
              }
              onSave({ 
                ...formData, 
                financialTarget: isMoney ? Number(financialTargetInput) : undefined,
                id: Math.random().toString(36).substr(2, 9), 
                userId: type === 'individual' ? currentUser.id : undefined,
                status: 'Not Started',
                progressPercentage: 0,
                currentAmount: 0,
                contributions: [],
                tasks: []
              }); 
              onClose(); 
            }}
            className="flex-1 bg-emerald-600 text-white py-6 rounded-[1.75rem] font-black shadow-2xl hover:bg-emerald-700 hover:-translate-y-1 active:translate-y-0 transition-all text-xl tracking-tight"
          >
            CREATE GOAL
          </button>
          <button onClick={onClose} className="px-10 py-6 text-stone-400 font-black uppercase text-[11px] tracking-[0.3em] hover:text-stone-900 transition-colors">CANCEL</button>
        </div>
      </div>
    </div>
  );
};

export default GoalsSystem;
