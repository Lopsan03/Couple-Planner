
import React, { useState } from 'react';
import { PlannerState, Activity, ActivityScope } from '../types';
import { CATEGORY_ICONS, USERS } from '../constants';

interface ActivityDBProps {
  state: PlannerState;
  actions: any;
}

const ActivityDB: React.FC<ActivityDBProps> = ({ state, actions }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = state.activities.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search activities..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3 top-3.5 text-stone-400">🔍</span>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-6 py-3 bg-stone-900 text-white font-semibold rounded-2xl shadow-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
        >
          <span>➕</span> Add New Activity
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(activity => (
          <div key={activity.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-stone-50 rounded-2xl">{CATEGORY_ICONS[activity.type] || '✨'}</span>
                <div>
                  <h3 className="font-bold text-stone-900">{activity.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-stone-500">{activity.type}</p>
                    <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded uppercase font-bold text-stone-400">
                      {activity.scope === 'Shared' ? 'Shared' : (activity.targetUserId === USERS.DAVID.id ? 'David' : 'Carla')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => actions.deleteActivity(activity.id)} className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center gap-2 text-stone-600">
                <span>⏱️</span> {activity.duration}
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <span>⚡</span> {activity.energyLevel}
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <span>🏷️</span> {activity.category}
              </div>
              <div className="flex items-center gap-2 text-stone-600 font-bold text-emerald-600">
                <span>$</span> {activity.category === 'Free' ? '0' : activity.estimatedCost}
              </div>
            </div>

            <p className="text-sm text-stone-500 italic line-clamp-2">{activity.notes || 'No notes added.'}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <ActivityModal 
          onClose={() => setIsModalOpen(false)} 
          onSave={actions.addActivity} 
        />
      )}
    </div>
  );
};

const ActivityModal = ({ onClose, onSave }: any) => {
  const [formData, setFormData] = useState<Partial<Activity>>({
    name: '',
    category: 'Free',
    estimatedCost: 0,
    duration: '1h',
    energyLevel: 'Medium',
    indoorOutdoor: 'Indoor',
    type: 'Adventure',
    notes: '',
    scope: 'Shared'
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto no-scrollbar">
        <h3 className="text-2xl font-bold mb-6 text-stone-900">Create New Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Name</label>
            <input 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Hiking at Pine Hill"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Who is this for?</label>
            <select 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.scope}
              onChange={e => setFormData({...formData, scope: e.target.value as any})}
            >
              <option value="Shared">Both (Shared)</option>
              <option value="Individual">Individual Only</option>
            </select>
          </div>

          {formData.scope === 'Individual' && (
            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">For whom?</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.targetUserId}
                onChange={e => setFormData({...formData, targetUserId: e.target.value})}
              >
                <option value="">Select person</option>
                <option value={USERS.DAVID.id}>David</option>
                <option value={USERS.CARLA.id}>Carla</option>
              </select>
            </div>
          )}

          <div className={formData.scope !== 'Individual' ? 'md:col-span-1' : ''}>
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Cost Type</label>
            <select 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value as any})}
            >
              <option value="Free">Free</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Est. Cost ($)</label>
            <input 
              type="number"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.estimatedCost}
              onChange={e => setFormData({...formData, estimatedCost: Number(e.target.value)})}
              disabled={formData.category === 'Free'}
            />
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Type</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
              >
                {['Adventure', 'Creative', 'Relaxing', 'Growth', 'Relationship', 'Health'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Energy Level</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.energyLevel}
                onChange={e => setFormData({...formData, energyLevel: e.target.value as any})}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Notes</label>
            <textarea 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button 
            onClick={() => { onSave({...formData, id: Date.now().toString()}); onClose(); }}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-colors"
          >
            Save Activity
          </button>
          <button onClick={onClose} className="px-8 bg-stone-100 text-stone-500 py-4 rounded-2xl font-bold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityDB;
