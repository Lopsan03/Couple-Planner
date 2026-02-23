
import React, { useMemo, useState } from 'react';
import { PlannerState, CalendarEvent, Activity } from '../types';
import { COLORS } from '../constants';

interface CalendarViewProps {
  state: PlannerState;
  actions: any;
  language: 'en' | 'es';
  highlightScheduling?: boolean;
  onOpenGoals?: () => void;
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

const CalendarView: React.FC<CalendarViewProps> = ({ state, actions, language, highlightScheduling = false, onOpenGoals, memberProfiles = [] }) => {
  const isSpanish = language === 'es';
  const capitalizeWords = (value: string) =>
    value.replace(/\b\p{L}/gu, (char) => char.toUpperCase());

  const formatLocalizedDate = (date: Date, options: Intl.DateTimeFormatOptions) => {
    const locale = isSpanish ? 'es-ES' : undefined;
    return capitalizeWords(new Intl.DateTimeFormat(locale, options).format(date));
  };

  const weekdayLabels = isSpanish
    ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showCurrentUserEvents, setShowCurrentUserEvents] = useState(true);
  const [showPartnerEvents, setShowPartnerEvents] = useState(false);

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
          notes: goal.description || (isSpanish ? 'Fecha límite de meta' : 'Goal deadline'),
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
          customName: `✅ ${isSpanish ? 'Subtarea vence' : 'Subtask Due'}: ${task.text}`,
          category: 'Free',
          estimatedCost: 0,
          duration: '1 hour',
          notes: `${isSpanish ? 'De la meta' : 'From goal'}: ${goal.title}`,
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
          customName: isSpanish ? `🎂 Cumpleaños de ${member.username}` : `🎂 ${member.username}'s Birthday`,
          category: 'Free',
          estimatedCost: 0,
          duration: 'All day',
          notes: isSpanish ? `Cumpleaños de ${member.username}` : `${member.username}'s birthday`,
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
    return getExpandedEventsForDay(date).filter(event => {
      if (event.scope === 'Shared') {
        return showCurrentUserEvents || showPartnerEvents;
      }

      if (event.targetUserId === state.currentUser.id) {
        return showCurrentUserEvents;
      }

      if (event.targetUserId === state.partner.id) {
        return showPartnerEvents;
      }

      return showCurrentUserEvents || showPartnerEvents;
    });
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setView('day');
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarDisplayEvent) => {
    e.stopPropagation();
    if (event.isGoalDerived) {
      onOpenGoals?.();
      return;
    }
    if (event.isBirthdayDerived) return;
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
        date: selectedDay ? toLocalDateKey(selectedDay) : toLocalDateKey(new Date()),
        startTime: '09:00',
        endTime: '10:00',
        recurrence: 'None',
        category: 'Free',
        estimatedCost: 0,
        actualCost: undefined,
        duration: '1 hour',
        notes: '',
        customName: '',
        scope: 'Shared'
      }
    );
    const [estimatedCostInput, setEstimatedCostInput] = useState(() => {
      const initialValue = Number(formData.estimatedCost || 0);
      return initialValue > 0 ? String(initialValue) : '';
    });
    const [actualCostInput, setActualCostInput] = useState(() => {
      if (formData.actualCost === undefined || formData.actualCost === null) return '';
      const initialValue = Number(formData.actualCost);
      return Number.isFinite(initialValue) ? String(initialValue) : '';
    });
    const [overlapWarning, setOverlapWarning] = useState<{
      pendingEvent: CalendarEvent;
      conflictCount: number;
      firstConflictLabel: string;
    } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const selectedBankActivity = formData.activityId
      ? state.activities.find(a => a.id === formData.activityId)
      : null;
    const isCostTypeLockedByBank = Boolean(selectedBankActivity);
    const shouldShowCostType = !(isCostTypeLockedByBank && formData.category === 'Free');

    const computeDurationFromTimes = (startTime?: string, endTime?: string) => {
      if (!startTime || !endTime) return isSpanish ? '1 hora' : '1 hour';
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      if ([startHour, startMinute, endHour, endMinute].some(v => Number.isNaN(v))) {
        return isSpanish ? '1 hora' : '1 hour';
      }

      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      const diffMinutes = Math.max(0, endTotalMinutes - startTotalMinutes);

      if (diffMinutes === 0) return isSpanish ? '0 minutos' : '0 minutes';

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
      if (hours > 0) return isSpanish ? `${hours} hora${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`;
      return isSpanish ? `${minutes} minuto${minutes > 1 ? 's' : ''}` : `${minutes} minute${minutes > 1 ? 's' : ''}`;
    };

    const handleSave = () => {
      if (!(formData.customName || '').trim()) {
        setValidationError(isSpanish ? 'Por favor ingresa un nombre para la actividad.' : 'Please enter an activity name.');
        return;
      }

      if (formData.scope === 'Individual' && !formData.targetUserId) {
        setValidationError(isSpanish ? 'Selecciona para quién es este evento.' : 'Please select who this event is for.');
        return;
      }

      const [startHour, startMinute] = (formData.startTime || '').split(':').map(Number);
      const [endHour, endMinute] = (formData.endTime || '').split(':').map(Number);
      const hasInvalidTime = [startHour, startMinute, endHour, endMinute].some(value => Number.isNaN(value));
      if (hasInvalidTime) {
        setValidationError(isSpanish ? 'Completa una hora de inicio y fin válidas.' : 'Please provide valid start and end times.');
        return;
      }

      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      if (endTotal <= startTotal) {
        setValidationError(isSpanish ? 'La hora de fin debe ser posterior a la hora de inicio.' : 'End time must be after start time.');
        return;
      }

      setValidationError(null);
      const finalEstimatedCost = formData.category === 'Free'
        ? 0
        : (estimatedCostInput.trim() === '' ? 0 : Number(estimatedCostInput));
      const parsedActualCost = actualCostInput.trim() === '' ? undefined : Number(actualCostInput);
      const finalActualCost = formData.category === 'Free'
        ? 0
        : (Number.isFinite(parsedActualCost as number) ? parsedActualCost : undefined);

      const finalEvent = {
        ...formData,
        estimatedCost: Number.isFinite(finalEstimatedCost) ? finalEstimatedCost : 0,
        actualCost: finalActualCost,
        duration: computeDurationFromTimes(formData.startTime, formData.endTime),
        recurrence: formData.recurrence || 'None',
        id: editingEvent?.id || Math.random().toString(36).substr(2, 9),
        createdBy: editingEvent?.createdBy || state.currentUser.name,
        lastModifiedBy: state.currentUser.name
      } as CalendarEvent;

      const saveEvent = (eventToSave: CalendarEvent) => {
        if (editingEvent) actions.updateEvent(eventToSave);
        else actions.addEvent(eventToSave);

        setIsModalOpen(false);
      };

      const targetDateKey = toEventDateKey(finalEvent.date);
      const dayEvents = getExpandedEventsForDay(new Date(`${targetDateKey}T00:00:00`))
        .filter(event => !event.isGoalDerived && !event.isBirthdayDerived);

      const isOverlapping = (startA: string, endA: string, startB: string, endB: string) => {
        const [aStartHour, aStartMinute] = startA.split(':').map(Number);
        const [aEndHour, aEndMinute] = endA.split(':').map(Number);
        const [bStartHour, bStartMinute] = startB.split(':').map(Number);
        const [bEndHour, bEndMinute] = endB.split(':').map(Number);

        const aStart = aStartHour * 60 + aStartMinute;
        const aEnd = aEndHour * 60 + aEndMinute;
        const bStart = bStartHour * 60 + bStartMinute;
        const bEnd = bEndHour * 60 + bEndMinute;

        return aStart < bEnd && bStart < aEnd;
      };

      const conflicts = dayEvents.filter(event => {
        const isSameEditedSeries = editingEvent
          ? event.id === editingEvent.id || event.recurrenceSourceId === editingEvent.id
          : false;
        if (isSameEditedSeries) return false;

        const timesOverlap = isOverlapping(
          finalEvent.startTime,
          finalEvent.endTime,
          event.startTime,
          event.endTime
        );

        if (!timesOverlap) return false;

        if (finalEvent.scope === 'Individual') {
          return event.scope === 'Individual' && event.targetUserId === finalEvent.targetUserId;
        }

        return event.scope === 'Shared' || event.scope === 'Individual';
      });

      if (conflicts.length > 0) {
        const firstConflict = conflicts[0];
        const conflictLabel = `${firstConflict.startTime}-${firstConflict.endTime} ${firstConflict.customName || 'Event'}`;
        setOverlapWarning({
          pendingEvent: finalEvent,
          conflictCount: conflicts.length,
          firstConflictLabel: conflictLabel,
        });
        return;
      }
      
      saveEvent(finalEvent);
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-stone-900">{editingEvent ? (isSpanish ? 'Editar Actividad' : 'Edit Activity') : (isSpanish ? 'Planear Nueva Actividad' : 'Plan New Activity')}</h3>
            <button onClick={() => setIsModalOpen(false)} className="text-stone-300 hover:text-stone-900 transition-colors">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Seleccionar del Banco' : 'Select from Bank'}</label>
              <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                onChange={(e) => {
                  const activity = state.activities.find(a => a.id === e.target.value);
                  if (activity) {
                    const nextEstimatedCost = activity.category === 'Free' ? 0 : activity.estimatedCost;
                    setFormData(prev => ({
                      ...prev,
                      activityId: activity.id,
                      customName: activity.name,
                      category: activity.category,
                      estimatedCost: nextEstimatedCost,
                      actualCost: undefined,
                      notes: activity.notes,
                      scope: activity.scope,
                      targetUserId: activity.targetUserId
                    }));
                    setEstimatedCostInput(nextEstimatedCost > 0 ? String(nextEstimatedCost) : '');
                    setActualCostInput('');
                  } else {
                    setFormData(prev => ({ ...prev, activityId: undefined }));
                  }
                }}
                value={formData.activityId || ''}
              >
                <option value="">{isSpanish ? '-- Entrada Manual --' : '-- Manual Entry --'}</option>
                {state.activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {formData.activityId && (
                <p className="text-[10px] text-stone-500 mt-1">{isSpanish ? 'Preset cargado desde el Banco de Actividades. Puedes editar todos los campos de este evento.' : 'Preset loaded from Activity Bank. You can edit every field for this calendar event.'}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Fecha' : 'Date'}</label>
              <input
                type="date"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                value={toEventDateKey(formData.date || toLocalDateKey(new Date()))}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Asignación' : 'Ownership'}</label>
                <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value as any})}
                >
                  <option value="Shared">{isSpanish ? 'Ambos (Compartida)' : 'Both (Shared)'}</option>
                  <option value="Individual">{isSpanish ? 'Individual' : 'Individual'}</option>
                </select>
              </div>
              {formData.scope === 'Individual' && (
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? '¿Para quién?' : 'For Whom?'}</label>
                  <select className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                    value={formData.targetUserId} onChange={e => setFormData({...formData, targetUserId: e.target.value})}
                  >
                    <option value="">{isSpanish ? 'Seleccionar Usuario' : 'Choose User'}</option>
                    <option value={state.currentUser.id}>{state.currentUser.name}</option>
                    <option value={state.partner.id}>{state.partner.name}</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Nombre de Actividad' : 'Activity Name'}</label>
              <input type="text" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white outline-none"
                value={formData.customName} onChange={(e) => setFormData({...formData, customName: e.target.value})} />
            </div>

            {shouldShowCostType && (
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Tipo de Costo' : 'Cost Type'}</label>
                <select
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as 'Free' | 'Paid';
                    setFormData({
                      ...formData,
                      category: nextCategory,
                      estimatedCost: nextCategory === 'Free' ? 0 : (Number(estimatedCostInput) || 0),
                      actualCost: nextCategory === 'Free'
                        ? 0
                        : (actualCostInput.trim() === '' ? undefined : Number(actualCostInput)),
                    });

                    if (nextCategory === 'Free') {
                      setEstimatedCostInput('');
                      setActualCostInput('');
                    }
                  }}
                  disabled={isCostTypeLockedByBank}
                >
                  <option value="Free">{isSpanish ? 'Gratis' : 'Free'}</option>
                  <option value="Paid">{isSpanish ? 'Pagado' : 'Paid'}</option>
                </select>
                {isCostTypeLockedByBank && (
                  <p className="text-[10px] text-stone-500 mt-1">{isSpanish ? 'El tipo de costo sigue al preset del banco.' : 'Cost type follows the selected bank activity.'}</p>
                )}
              </div>
            )}

            {formData.category === 'Paid' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Costo Planeado ($)' : 'Planned Cost ($)'}</label>
                  <input
                    type="number"
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                    value={estimatedCostInput}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setEstimatedCostInput(nextValue);
                      setFormData({
                        ...formData,
                        estimatedCost: nextValue === '' ? 0 : Number(nextValue),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Costo Real ($)' : 'Actual Cost ($)'}</label>
                  <input
                    type="number"
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                    value={actualCostInput}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setActualCostInput(nextValue);
                      setFormData({
                        ...formData,
                        actualCost: nextValue === '' ? undefined : Number(nextValue),
                      });
                    }}
                    placeholder={isSpanish ? 'Déjalo vacío hasta completar' : 'Leave empty until completed'}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Hora Inicio' : 'Start Time'}</label>
                <input type="time" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Hora Fin' : 'End Time'}</label>
                <input type="time" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                  value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Recurrencia' : 'Recurrence'}</label>
              <select
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white"
                value={formData.recurrence || 'None'}
                onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as 'None' | 'Weekly' | 'Monthly' | 'Yearly' })}
              >
                <option value="None">{isSpanish ? 'No se repite' : 'Does not repeat'}</option>
                <option value="Weekly">{isSpanish ? 'Semanal (mismo día)' : 'Repeats weekly (same weekday)'}</option>
                <option value="Monthly">{isSpanish ? 'Mensual (mismo día)' : 'Repeats monthly (same day)'}</option>
                <option value="Yearly">{isSpanish ? 'Anual (misma fecha)' : 'Repeats yearly (same date)'}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isSpanish ? 'Notas' : 'Notes'}</label>
              <textarea
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white outline-none min-h-[80px]"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={isSpanish ? 'Notas específicas del evento' : 'Any event-specific notes'}
              />
            </div>

            {validationError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.18em]">{isSpanish ? 'Validación' : 'Validation'}</p>
                <p className="text-sm font-semibold text-rose-700 mt-1">{validationError}</p>
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-colors">{isSpanish ? 'Guardar' : 'Schedule'}</button>
              {editingEvent && <button onClick={() => { actions.deleteEvent(editingEvent.id); setIsModalOpen(false); }} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-bold hover:bg-rose-100 transition-colors">{isSpanish ? 'Eliminar' : 'Delete'}</button>}
            </div>
          </div>
        </div>

        {overlapWarning && (
          <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl shadow-2xl p-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-black uppercase tracking-[0.18em]">
                <span>⚠️</span>
                <span>{isSpanish ? 'Conflicto Detectado' : 'Conflict Detected'}</span>
              </div>
              <h4 className="text-2xl font-black text-stone-900 mt-4">{isSpanish ? 'Superposición de Horarios' : 'Schedule Overlap'}</h4>
              <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                {isSpanish ? 'Este evento se superpone con ' : 'This event overlaps with '}<span className="font-black text-stone-900">{overlapWarning.conflictCount}</span>{isSpanish ? ' evento(s) existente(s).' : ' existing event(s).'}
              </p>
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-[11px] font-black text-stone-400 uppercase tracking-[0.16em]">{isSpanish ? 'Primer Conflicto' : 'First Conflict'}</p>
                <p className="text-sm font-semibold text-stone-700 mt-1">{overlapWarning.firstConflictLabel}</p>
              </div>
              <p className="text-sm text-stone-500 mt-4">{isSpanish ? '¿Guardar de todos modos y mantener ambos eventos?' : 'Save anyway and keep both events?'}</p>
              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => setOverlapWarning(null)}
                  className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-colors"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    if (!overlapWarning) return;
                    const eventToSave = overlapWarning.pendingEvent;
                    setOverlapWarning(null);
                    if (editingEvent) actions.updateEvent(eventToSave);
                    else actions.addEvent(eventToSave);
                    setIsModalOpen(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                >
                  {isSpanish ? 'Continuar' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const MonthView = () => {
    const days = getDaysInMonth(currentDate);
    return (
      <div className={`bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden ${highlightScheduling ? 'ring-2 ring-emerald-200' : ''}`}>
        <div className="grid grid-cols-7 border-b border-stone-100">
          {weekdayLabels.map(day => (
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
    const orderedDayEvents = [...dayEvents].sort((a, b) => {
      const aSharedWeight = a.scope === 'Shared' ? 1 : 0;
      const bSharedWeight = b.scope === 'Shared' ? 1 : 0;
      return aSharedWeight - bSharedWeight;
    });
    const showBothUsers = showCurrentUserEvents && showPartnerEvents;

    return (
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-stone-900">{formatLocalizedDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            <p className="text-sm text-stone-500 font-medium">{dayEvents.length} {isSpanish ? 'eventos programados' : 'items scheduled'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingEvent(null); setIsModalOpen(true); }} className={`px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg ${highlightScheduling ? 'ring-4 ring-emerald-300 animate-pulse' : ''}`}>{isSpanish ? 'Nuevo Evento' : 'Schedule New'}</button>
            <button onClick={() => setView('month')} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors">{isSpanish ? 'Vista Mensual' : 'Month Grid'}</button>
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
            {orderedDayEvents.map(event => {
              const [sH, sM] = event.startTime.split(':').map(Number);
              const [eH, eM] = event.endTime.split(':').map(Number);
              const top = (sH * 96) + (sM / 60 * 96);
              const height = ((eH * 96) + (eM / 60 * 96)) - top;
              const costType = event.category === 'Free' ? 'Free' : (event.estimatedCost > 50 ? 'High' : 'Low');
              const dynamicOwnerName = getOwnerName(event.targetUserId);
              const ownerName = event.scope === 'Individual' ? (dynamicOwnerName ? `${dynamicOwnerName}'s` : 'Individual') : 'Shared';

              const isPartnerIndividual = event.scope === 'Individual' && event.targetUserId === state.partner.id;
              const isCurrentIndividual = event.scope === 'Individual' && event.targetUserId === state.currentUser.id;
              const shouldSplitColumns = showBothUsers && (isPartnerIndividual || isCurrentIndividual);
              const isSharedEvent = event.scope === 'Shared';

              const layoutStyle = shouldSplitColumns
                ? (isPartnerIndividual
                    ? { left: '50%', right: '0.5rem' }
                    : { left: '0.25rem', right: '50%' })
                : { left: '0.25rem', right: '0.5rem' };

              const zIndex = isSharedEvent ? 30 : 20;

              return (
                <div key={event.id} onClick={(e) => handleEventClick(e as any, event)} 
                  className={`absolute left-1 right-2 rounded-2xl border p-4 pointer-events-auto cursor-pointer shadow-sm flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-lg ${COLORS[costType as keyof typeof COLORS]}`}
                  style={{ top: `${top}px`, height: `${Math.max(60, height)}px`, zIndex, ...layoutStyle }}>
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{event.startTime} - {event.endTime}</p>
                      <span className="text-[8px] bg-white/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{ownerName}</span>
                    </div>
                    <p className="text-base font-bold leading-tight">{event.customName}</p>
                  </div>
                  <p className="text-[10px] italic opacity-60 truncate font-medium">{event.notes || (isSpanish ? 'Sin notas.' : 'No notes.')}</p>
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
          <h2 className="text-2xl font-bold text-stone-900">{formatLocalizedDate(currentDate, { month: 'long', year: 'numeric' })}</h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 text-xs font-bold uppercase tracking-widest text-stone-400">{isSpanish ? 'Actual' : 'Current'}</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">→</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-1">{isSpanish ? 'Filtrar por Usuario' : 'Filter By User'}</span>

        <label className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCurrentUserEvents}
            onChange={(e) => setShowCurrentUserEvents(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>{state.currentUser.name}</span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPartnerEvents}
            onChange={(e) => setShowPartnerEvents(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>{state.partner.name}</span>
        </label>
      </div>

      {highlightScheduling && view === 'month' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
          {isSpanish
            ? 'Paso guiado: haz clic en cualquier día para abrir la vista diaria y usar el botón “Nuevo Evento”.'
            : 'Guided step: click any day to open day view, then use the “Schedule New” button.'}
        </div>
      )}

      {view === 'month' ? <MonthView /> : <DayTimeline />}
      {isModalOpen && <EventModal />}
    </div>
  );
};

export default CalendarView;
