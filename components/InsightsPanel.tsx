
import React, { useMemo } from 'react';
import { PlannerState } from '../types';

interface InsightsPanelProps {
  state: PlannerState;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ state }) => {
  const insights = useMemo(() => {
    const list: string[] = [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyEvents = state.events.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalActual = monthlyEvents.reduce((acc, e) => acc + (e.actualCost || e.estimatedCost || 0), 0);
    const spendingRatio = totalActual / state.budget.monthlyLimit;

    // 1. Budget Warnings
    if (spendingRatio > 0.9) {
      list.push("🔴 High Spend: You've used over 90% of your budget!");
    } else if (spendingRatio > 0.7) {
      list.push("⚠️ Budget Warning: 70% reached. Consider more free activities.");
    }

    // 2. Activity Balance
    const paidRatio = monthlyEvents.filter(e => e.category === 'Paid').length / (monthlyEvents.length || 1);
    if (paidRatio > 0.6) {
      list.push("💡 Suggestion: Try adding some 'Free' activities to balance costs.");
    }

    // 3. Goal Deadlines
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const approachingGoals = [...state.sharedGoals, ...state.individualGoals].filter(g => {
      const d = new Date(g.targetDate);
      return d > new Date() && d < soon && g.status !== 'Completed';
    });

    if (approachingGoals.length > 0) {
      list.push(`📅 Deadline: ${approachingGoals.length} goals are due this week!`);
    }

    // 4. Financial Goal Progress
    const stagnantGoals = state.sharedGoals.filter(g => g.financialTarget && (g.currentAmount || 0) < g.financialTarget * 0.1);
    if (stagnantGoals.length > 0) {
      list.push("🌱 Tip: Start contributing to your new shared savings goals.");
    }

    if (list.length === 0) list.push("✨ Planning looking good! Keep it up.");

    return list;
  }, [state]);

  const [currentInsightIndex, setCurrentInsightIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentInsightIndex(prev => (prev + 1) % insights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [insights]);

  return (
    <div className="flex items-center gap-3 px-3 py-1 overflow-hidden min-w-[300px]">
      <div className="flex items-center justify-center w-8 h-8 bg-stone-100 rounded-lg text-lg flex-shrink-0 animate-pulse">
        🤖
      </div>
      <div className="flex-1 relative h-6">
        {insights.map((insight, idx) => (
          <p 
            key={idx}
            className={`absolute inset-0 text-sm font-medium text-stone-600 transition-all duration-700 whitespace-nowrap overflow-hidden text-ellipsis ${
              idx === currentInsightIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {insight}
          </p>
        ))}
      </div>
    </div>
  );
};

export default InsightsPanel;
