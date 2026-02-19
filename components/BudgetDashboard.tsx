
import React, { useState } from 'react';
import { PlannerState } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface BudgetDashboardProps {
  state: PlannerState;
  actions: any;
  isDarkMode: boolean;
}

const BudgetDashboard: React.FC<BudgetDashboardProps> = ({ state, actions, isDarkMode }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const remainingStrokeColor = isDarkMode ? '#7dd3fc' : '#0ea5e9';

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const parseEventDate = (rawDate: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return new Date(`${rawDate}T00:00:00`);
    }

    return new Date(rawDate);
  };

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const monthlyEvents = state.events.flatMap(e => {
    const baseDate = parseEventDate(e.date);
    if (Number.isNaN(baseDate.getTime())) return [];

    if (e.recurrence === 'None' || !e.recurrence) {
      return baseDate.getMonth() === currentMonth && baseDate.getFullYear() === currentYear ? [e] : [];
    }

    if (e.recurrence === 'Weekly') {
      const events: typeof state.events = [];
      const weekday = baseDate.getDay();
      const cursor = new Date(Math.max(baseDate.getTime(), startOfMonth.getTime()));

      while (cursor.getDay() !== weekday) {
        cursor.setDate(cursor.getDate() + 1);
      }

      while (cursor <= endOfMonth) {
        events.push({
          ...e,
          id: `${e.id}-${toDateKey(cursor)}`,
          date: toDateKey(cursor),
        });
        cursor.setDate(cursor.getDate() + 7);
      }

      return events;
    }

    if (e.recurrence === 'Monthly') {
      const monthsDiff = (currentYear - baseDate.getFullYear()) * 12 + (currentMonth - baseDate.getMonth());
      if (monthsDiff < 0) return [];

      const candidate = new Date(currentYear, currentMonth, baseDate.getDate());
      if (candidate.getMonth() !== currentMonth) return [];

      return [{
        ...e,
        id: `${e.id}-${toDateKey(candidate)}`,
        date: toDateKey(candidate),
      }];
    }

    if (e.recurrence === 'Yearly') {
      if (currentYear < baseDate.getFullYear()) return [];
      if (currentMonth !== baseDate.getMonth()) return [];

      const candidate = new Date(currentYear, currentMonth, baseDate.getDate());
      if (candidate.getMonth() !== currentMonth) return [];

      return [{
        ...e,
        id: `${e.id}-${toDateKey(candidate)}`,
        date: toDateKey(candidate),
      }];
    }

    return [];
  });

  const totalActual = monthlyEvents.reduce((acc, e) => acc + (e.actualCost || e.estimatedCost || 0), 0);
  const totalEstimated = monthlyEvents.reduce((acc, e) => acc + (e.estimatedCost || 0), 0);
  const remaining = Math.max(0, state.budget.monthlyLimit - totalActual);
  const isOver = totalActual > state.budget.monthlyLimit;

  // Pie Chart Data: Remaining vs Breakdown by Category
  const categorySpending: Record<string, number> = {};
  monthlyEvents.forEach(e => {
    // Determine category name from state.activities or custom logic
    const activity = state.activities.find(a => a.id === e.activityId);
    const cat = activity?.type || 'Other';
    categorySpending[cat] = (categorySpending[cat] || 0) + (e.actualCost || e.estimatedCost || 0);
  });

  const pieData = [
    { name: 'Remaining', value: remaining },
    ...Object.entries(categorySpending).map(([name, value]) => ({ name, value }))
  ];

  const PIE_COLORS = ['#ecfdf5', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e', '#ec4899', '#06b6d4'];

  // Correct Week Mapping: W1-W5
  const getWeekOfMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return Math.ceil((day + firstDay) / 7);
  };

  const weeklyData = [
    { name: 'Week 1', spent: 0 },
    { name: 'Week 2', spent: 0 },
    { name: 'Week 3', spent: 0 },
    { name: 'Week 4', spent: 0 },
    { name: 'Week 5', spent: 0 },
  ];

  monthlyEvents.forEach(e => {
    const weekIdx = getWeekOfMonth(e.date) - 1;
    if (weeklyData[weekIdx]) {
      weeklyData[weekIdx].spent += (e.actualCost || e.estimatedCost || 0);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200">
        <h2 className="text-xl font-bold text-stone-900">
          Budget for {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-2 hover:bg-stone-50 rounded-xl">←</button>
          <button onClick={() => setViewDate(new Date())} className="px-4 text-sm font-bold">Current</button>
          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-2 hover:bg-stone-50 rounded-xl">→</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Monthly Limit" value={`$${state.budget.monthlyLimit}`} color="stone" 
          action={<button onClick={() => {
            const val = prompt('Enter new limit:', state.budget.monthlyLimit.toString());
            if(val) actions.updateBudgetLimit(Number(val));
          }} className="text-xs text-stone-500 hover:text-stone-900">Edit</button>}
        />
        <StatCard title="Total Spent" value={`$${totalActual.toFixed(2)}`} color="emerald" subtitle={`Est: $${totalEstimated.toFixed(2)}`} />
        <StatCard title="Remaining" value={`$${remaining.toFixed(2)}`} color={isOver ? 'rose' : 'emerald'} subtitle={isOver ? `Over by $${(totalActual - state.budget.monthlyLimit).toFixed(2)}` : 'Under budget'} />
        <StatCard title="Activities" value={monthlyEvents.length.toString()} color="amber" subtitle={`${monthlyEvents.filter(e => e.category === 'Free').length} Free`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold text-stone-900 mb-6 uppercase text-xs tracking-widest text-stone-400">Spending by Week</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 12}} />
                <Tooltip
                  cursor={{ fill: isDarkMode ? 'rgba(148, 163, 184, 0.16)' : '#f5f5f4' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: isDarkMode ? '1px solid #334155' : 'none',
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    color: isDarkMode ? '#e2e8f0' : '#1c1917',
                    boxShadow: isDarkMode
                      ? '0 10px 24px -10px rgb(2 6 23 / 0.85)'
                      : '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ color: isDarkMode ? '#cbd5e1' : '#57534e' }}
                  itemStyle={{ color: isDarkMode ? '#f8fafc' : '#1c1917' }}
                />
                <Bar dataKey="spent" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-stone-900 mb-6 uppercase text-xs tracking-widest text-stone-400">Budget Breakdown</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === 'Remaining'
                          ? (isDarkMode ? '#111827' : '#ffffff')
                          : PIE_COLORS[index % PIE_COLORS.length]
                      }
                      strokeWidth={entry.name === 'Remaining' ? 2 : 0}
                      stroke={entry.name === 'Remaining' ? remainingStrokeColor : '#10b981'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: isDarkMode ? '1px solid #334155' : 'none',
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    color: isDarkMode ? '#e2e8f0' : '#1c1917',
                    boxShadow: isDarkMode
                      ? '0 10px 24px -10px rgb(2 6 23 / 0.85)'
                      : '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ color: isDarkMode ? '#cbd5e1' : '#57534e' }}
                  itemStyle={{ color: isDarkMode ? '#f8fafc' : '#1c1917' }}
                  formatter={(value: number, name: string) => [`$${Number(value).toFixed(2)}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium">
            {pieData.map((entry, index) => {
              const dotColor = entry.name === 'Remaining' ? remainingStrokeColor : PIE_COLORS[index % PIE_COLORS.length];
              return (
                <div key={`legend-${entry.name}-${index}`} className="inline-flex items-center gap-2 text-stone-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                  <span>{entry.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, subtitle, action }: any) => {
  const colors = {
    stone: 'bg-white text-stone-900 border-stone-200',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    rose: 'bg-rose-50 text-rose-900 border-rose-100',
    amber: 'bg-amber-50 text-amber-900 border-amber-100',
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm transition-transform hover:scale-[1.02] ${colors[color as keyof typeof colors]}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{title}</h4>
        {action}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs mt-2 opacity-70 font-semibold">{subtitle}</p>}
    </div>
  );
};

export default BudgetDashboard;
