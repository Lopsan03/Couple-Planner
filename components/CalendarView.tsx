
import React, { useMemo, useState } from 'react';
import { PlannerState, CalendarEvent, Activity } from '../types';
import { COLORS } from '../constants';

interface CalendarViewProps {
  state: PlannerState;
  actions: any;
  memberProfiles?: Array<{
    user_id: string;
    member_slot: number;
    username: string;
    birthday: string | null;
  }>;
}

type CalendarDisplayEvent = CalendarEvent & {
  isGoalDerived?: boolean;
  isBirthdayDerived?: boolean;
  recurrenceSourceId?: string;
};

const CalendarView: React.FC<CalendarViewProps> = ({ state, actions, memberProfiles = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const getOwnerName = (targetUserId?: string) => {
    if (!targetUserId) return '';
    if (targetUserId === state.currentUser.id) return state.currentUser.name;
    if (targetUserId === state.partner.id) return state.partner.name;
    return '';
  };

  const getOneHourLater = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const nextHour = (hours + 1) % 24;
    return `${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toEventDateKey = (rawDate: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return rawDate;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return rawDate;
    }

    return toLocalDateKey(parsed);
  };

  const goalEvents = useMemo<CalendarDisplayEvent[]>(() => {
    const allGoals = [...state.sharedGoals, ...state.individualGoals];
    const derived: CalendarDisplayEvent[] = [];

    allGoals.forEach(goal => {
      if (goal.targetDate) {
        const startTime = goal.targetTime || '09:00';
        derived.push({
          id: `goal-due-${goal.id}`,
          date: goal.targetDate,
          startTime,
          endTime: getOneHourLater(startTime),
          customName: `${goal.financialTarget ? '💰' : '🎯'} Goal Due: ${goal.title}`,
          category: 'Free',
          estimatedCost: 0,
          duration: '1 hour',
          notes: goal.description || 'Goal deadline',
          createdBy: 'Goals System',
          lastModifiedBy: 'Goals System',
          scope: goal.userId ? 'Individual' : 'Shared',
          targetUserId: goal.userId,
          isGoalDerived: true,
        });
      }

      (goal.tasks || []).forEach(task => {
        if (!task.dueDate) return;
        const startTime = task.startTime || task.dueTime || '11:00';
        const endTime = task.endTime || getOneHourLater(startTime);
        derived.push({
          id: `goal-task-due-${goal.id}-${task.id}`,
          date: task.dueDate,
          startTime,
          endTime,
          customName: `✅ Subtask Due: ${task.text}`,
          category: 'Free',
          estimatedCost: 0,
          duration: '1 hour',
          notes: `From goal: ${goal.title}`,
          createdBy: 'Goals System',
          lastModifiedBy: 'Goals System',
          scope: goal.userId ? 'Individual' : 'Shared',
          targetUserId: goal.userId,
          isGoalDerived: true,
        });
      });
    });

    return derived;
  }, [state.sharedGoals, state.individualGoals]);

  const birthdayEvents = useMemo<CalendarDisplayEvent[]>(() => {
    const year = currentDate.getFullYear();

    return memberProfiles
      .filter(member => !!member.birthday && /^\d{4}-\d{2}-\d{2}$/.test(member.birthday))
      .map(member => {
        const birthday = member.birthday as string;
        const birthdayParts = birthday.split('-');
        const month = birthdayParts[1];
        const day = birthdayParts[2];

        return {
          id: `birthday-${member.user_id}-${year}`,
          date: `${year}-${month}-${day}`,
          startTime: '00:00',
          endTime: '23:59',
          customName: `🎂 ${member.username}'s Birthday`,
          category: 'Free',
          estimatedCost: 0,
          duration: 'All day',
          notes: `${member.username}'s birthday`,
          createdBy: 'Profile System',
          lastModifiedBy: 'Profile System',
          scope: 'Shared',
          isBirthdayDerived: true,
        };
      });
  }, [currentDate, memberProfiles]);

  const allCalendarEvents = useMemo<CalendarDisplayEvent[]>(
    () => [...state.events, ...goalEvents, ...birthdayEvents],
    [state.events, goalEvents, birthdayEvents]
  );

  const getExpandedEventsForDay = (date: Date) => {
    const dayKey = toLocalDateKey(date);
    const dayDate = new Date(`${dayKey}T00:00:00`);

    return allCalendarEvents.flatMap((event) => {
      if (event.isGoalDerived || event.isBirthdayDerived) {
        return toEventDateKey(event.date) === dayKey ? [event] : [];
      }

      if (event.recurrence === 'Weekly') {
        const startKey = toEventDateKey(event.date);
        const startDate = new Date(`${startKey}T00:00:00`);
        if (dayDate < startDate) return [];
        if (dayDate.getDay() !== startDate.getDay()) return [];

        return [{
          ...event,
          id: `${event.id}-${dayKey}`,
          date: dayKey,
          recurrenceSourceId: event.id,
        }];
      }

      if (event.recurrence === 'Monthly') {
        const startKey = toEventDateKey(event.date);
        const startDate = new Date(`${startKey}T00:00:00`);
        if (dayDate < startDate) return [];
        if (dayDate.getDate() !== startDate.getDate()) return [];

        return [{
          ...event,
          id: `${event.id}-${dayKey}`,
          date: dayKey,
          recurrenceSourceId: event.id,
        }];
      }

      if (event.recurrence === 'Yearly') {
        const startKey = toEventDateKey(event.date);
        const startDate = new Date(`${startKey}T00:00:00`);
        if (dayDate < startDate) return [];
        if (dayDate.getDate() !== startDate.getDate()) return [];
        if (dayDate.getMonth() !== startDate.getMonth()) return [];

        return [{
          ...event,
          id: `${event.id}-${dayKey}`,
          date: dayKey,
          recurrenceSourceId: event.id,
        }];
      }

      return toEventDateKey(event.date) === dayKey ? [event] : [];
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= lastDate; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getEventsForDay = (date: Date) => {
    return getExpandedEventsForDay(date);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setView('day');
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarDisplayEvent) => {
    e.stopPropagation();
    if (event.isGoalDerived || event.isBirthdayDerived) return;
    const baseEvent = event.recurrenceSourceId
      ? state.events.find(base => base.id === event.recurrenceSourceId) || null
      : event;
    setEditingEvent(baseEvent);
    setSelectedDay(new Date(event.date));
    setIsModalOpen(true);
  };

  const EventModal = () => {
    const [formData, setFormData] = useState<Partial<CalendarEvent>>(
      editingEvent || {
        date: selectedDay?.toISOString() || '',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: 'None',
        category: 'Free',
        estimatedCost: 0,
        duration: '1 hour',
        notes: '',
        customName: '',
        scope: 'Shared'
      }
    );

    const handleSave = () => {
      const finalEvent = {
        ...formData,
        recurrence: formData.recurrence || 'None',
        id: editingEvent?.id || Math.random().toString(36).substr(2, 9),
        createdBy: editingEvent?.createdBy || state.currentUser.name,
        lastModifiedBy: state.currentUser.name
      } as CalendarEvent;
      
      if (editingEvent) actions.updateEvent(finalEvent);
      else actions.addEvent(finalEvent);
      
      setIsModalOpen(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-stone-900">{editingEvent ? 'Edit Activity' : 'Plan New Activity'}</h3>
            <button onClick={() => setIsModalOpen(false)} className="text-stone-300 hover:text-stone-900 transition-colors">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Select from Bank</label>
              <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                onChange={(e) => {
                  const activity = state.activities.find(a => a.id === e.target.value);
                  if (activity) {
                    setFormData(prev => ({
                      ...prev,
                      activityId: activity.id,
                      customName: activity.name,
                      category: activity.category,
                      estimatedCost: activity.estimatedCost,
                      duration: activity.duration,
                      notes: activity.notes,
                      scope: activity.scope,
                      targetUserId: activity.targetUserId
                    }));
                  }
                }}
                value={formData.activityId || ''}
              >
                <option value="">-- Manual Entry --</option>
                {state.activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Ownership</label>
                <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value as any})}
                >
                  <option value="Shared">Both (Shared)</option>
                  <option value="Individual">Individual</option>
                </select>
              </div>
              {formData.scope === 'Individual' && (
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">For Whom?</label>
                  <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                    value={formData.targetUserId} onChange={e => setFormData({...formData, targetUserId: e.target.value})}
                  >
                    <option value="">Choose User</option>
                    <option value={state.currentUser.id}>{state.currentUser.name}</option>
                    <option value={state.partner.id}>{state.partner.name}</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Activity Name</label>
              <input type="text" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white outline-none"
                value={formData.customName} onChange={(e) => setFormData({...formData, customName: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Start Time</label>
                <input type="time" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">End Time</label>
                <input type="time" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Recurrence</label>
              <select
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                value={formData.recurrence || 'None'}
                onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as 'None' | 'Weekly' | 'Monthly' | 'Yearly' })}
              >
                <option value="None">Does not repeat</option>
                <option value="Weekly">Repeats weekly (same weekday)</option>
                <option value="Monthly">Repeats monthly (same day)</option>
                <option value="Yearly">Repeats yearly (same date)</option>
              </select>
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-colors">Schedule</button>
              {editingEvent && <button onClick={() => { actions.deleteEvent(editingEvent.id); setIsModalOpen(false); }} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-bold hover:bg-rose-100 transition-colors">Delete</button>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MonthView = () => {
    const days = getDaysInMonth(currentDate);
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest border-r last:border-0 border-stone-100">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, idx) => {
            const dayEvents = date ? getEventsForDay(date) : [];
            return (
              <div key={idx} onClick={() => date && handleDayClick(date)} className={`min-h-[140px] p-2 border-r border-b border-stone-100 cursor-pointer group relative ${!date ? 'bg-stone-50/30' : 'hover:bg-stone-50/50'}`}>
                {date && (
                  <>
                    <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full mb-2 ${date.toDateString() === new Date().toDateString() ? 'bg-emerald-600 text-white' : 'text-stone-400'}`}>{date.getDate()}</span>
                    <div className="space-y-1">
                      {dayEvents.map(event => {
                        const ownerName = event.scope === 'Individual' ? getOwnerName(event.targetUserId) : '';
                        return (
                          <div key={event.id} onClick={(e) => handleEventClick(e, event)} className={`text-[9px] px-2 py-1 rounded-lg border truncate font-bold leading-tight ${COLORS[event.category === 'Free' ? 'Free' : (event.estimatedCost > 50 ? 'High' : 'Low')]}`}>
                            {event.startTime} {event.customName} {ownerName && `(${ownerName})`}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const DayTimeline = () => {
    if (!selectedDay) return null;
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDay(selectedDay);

    return (
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-stone-900">{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            <p className="text-sm text-stone-500 font-medium">{dayEvents.length} items scheduled</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingEvent(null); setIsModalOpen(true); }} className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg">Schedule New</button>
            <button onClick={() => setView('month')} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors">Month Grid</button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[600px] p-4 relative no-scrollbar">
          {hours.map(hour => (
            <div key={hour} className="flex h-24 border-t border-stone-50 relative group">
              <div className="w-16 text-right pr-4 py-2 text-[10px] font-bold text-stone-300 uppercase tracking-widest">{hour}:00</div>
              <div className="flex-1 border-l border-stone-100 relative" />
            </div>
          ))}
          <div className="absolute inset-0 top-4 left-20 right-4 pointer-events-none">
            {dayEvents.map(event => {
              const [sH, sM] = event.startTime.split(':').map(Number);
              const [eH, eM] = event.endTime.split(':').map(Number);
              const top = (sH * 96) + (sM / 60 * 96);
              const height = ((eH * 96) + (eM / 60 * 96)) - top;
              const costType = event.category === 'Free' ? 'Free' : (event.estimatedCost > 50 ? 'High' : 'Low');
              const dynamicOwnerName = getOwnerName(event.targetUserId);
              const ownerName = event.scope === 'Individual' ? (dynamicOwnerName ? `${dynamicOwnerName}'s` : 'Individual') : 'Shared';

              return (
                <div key={event.id} onClick={(e) => handleEventClick(e as any, event)} 
                  className={`absolute left-1 right-2 rounded-2xl border p-4 pointer-events-auto cursor-pointer shadow-sm flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-lg ${COLORS[costType as keyof typeof COLORS]}`}
                  style={{ top: `${top}px`, height: `${Math.max(60, height)}px` }}>
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{event.startTime} - {event.endTime}</p>
                      <span className="text-[8px] bg-white/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{ownerName}</span>
                    </div>
                    <p className="text-base font-bold leading-tight">{event.customName}</p>
                  </div>
                  <p className="text-[10px] italic opacity-60 truncate font-medium">{event.notes || "No notes."}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {view === 'month' && (
        <div className="flex items-center gap-6 mb-4">
          <h2 className="text-2xl font-bold text-stone-900">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 text-xs font-bold uppercase tracking-widest text-stone-400">Current</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">→</button>
          </div>
        </div>
      )}
      {view === 'month' ? <MonthView /> : <DayTimeline />}
      {isModalOpen && <EventModal />}
    </div>
  );
};

export default CalendarView;
