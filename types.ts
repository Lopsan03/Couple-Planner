
export type Category = 'Financial' | 'Health' | 'Travel' | 'Relationship' | 'Career' | 'Adventure' | 'Creative' | 'Relaxing' | 'Growth';
export type EnergyLevel = 'Low' | 'Medium' | 'High';
export type ActivityCost = 'Free' | 'Paid';
export type GoalStatus = 'Not Started' | 'In Progress' | 'Completed';
export type ActivityScope = 'Shared' | 'Individual';

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Activity {
  id: string;
  name: string;
  category: ActivityCost;
  estimatedCost: number;
  duration: string;
  energyLevel: EnergyLevel;
  indoorOutdoor: 'Indoor' | 'Outdoor';
  type: Category;
  notes: string;
  scope: ActivityScope;
  targetUserId?: string;
}

export interface CalendarEvent {
  id: string;
  date: string; // ISO string (YYYY-MM-DD)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  recurrence?: 'None' | 'Weekly' | 'Monthly' | 'Yearly';
  activityId?: string;
  customName?: string;
  category: ActivityCost;
  estimatedCost: number;
  actualCost?: number;
  duration: string;
  notes: string;
  createdBy: string;
  lastModifiedBy: string;
  scope: ActivityScope;
  targetUserId?: string;
}

export interface GoalTask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
  startTime?: string;
  endTime?: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  userId: string;
  userName: string;
}

export interface Goal {
  id: string;
  userId?: string; // If present, it's an individual goal
  title: string;
  description: string;
  category: Category;
  targetDate: string;
  targetTime?: string;
  financialTarget?: number;
  currentAmount?: number; // Calculated from contributions
  progressPercentage: number; // Calculated from tasks or money
  status: GoalStatus;
  tasks?: GoalTask[];
  contributions?: GoalContribution[];
}

export interface BudgetConfig {
  monthlyLimit: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  userName: string;
}

export interface PlannerState {
  currentUser: User;
  partner: User;
  activities: Activity[];
  events: CalendarEvent[];
  sharedGoals: Goal[];
  individualGoals: Goal[];
  budget: BudgetConfig;
  logs: ActivityLog[];
}
