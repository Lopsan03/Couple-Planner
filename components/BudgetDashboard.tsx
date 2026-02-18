
import React, { useState } from 'react';
import { PlannerState } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface BudgetDashboardProps {
  state: PlannerState;
  actions: any;
}

const BudgetDashboard: React.FC<BudgetDashboardProps> = ({ state, actions }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const monthlyEvents = state.events.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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
                <Tooltip cursor={{fill: '#f5f5f4'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
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
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} strokeWidth={entry.name === 'Remaining' ? 2 : 0} stroke="#10b981" />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" align="center" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
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
