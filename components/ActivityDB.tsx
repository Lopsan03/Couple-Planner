
import React, { useState } from 'react';
import { PlannerState, Activity, ActivityScope } from '../types';
import { ACTIVITY_EMOJI_OPTIONS, CATEGORY_ICONS, DEFAULT_ACTIVITY_TYPES } from '../constants';

interface ActivityDBProps {
  state: PlannerState;
  actions: any;
  language: 'en' | 'es';
  highlightAddButton?: boolean;
}

const getTypeIcon = (type: string) => {
  const icon = CATEGORY_ICONS[type];
  return typeof icon === 'string' ? icon : '✨';
};

const ActivityDB: React.FC<ActivityDBProps> = ({ state, actions, language, highlightAddButton = false }) => {
  const isSpanish = language === 'es';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const availableTypes = [
    ...DEFAULT_ACTIVITY_TYPES,
    ...(state.customActivityTypes || []),
  ];

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
            placeholder={isSpanish ? 'Buscar actividades...' : 'Search activities...'} 
            className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3 top-3.5 text-stone-400">🔍</span>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className={`w-full md:w-auto px-6 py-3 bg-stone-900 text-white font-semibold rounded-2xl shadow-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2 ${highlightAddButton ? 'ring-4 ring-emerald-300 animate-pulse' : ''}`}
        >
          <span>➕</span> {isSpanish ? 'Agregar Actividad' : 'Add New Activity'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(activity => (
          <div key={activity.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-stone-50 rounded-2xl">{activity.emoji || getTypeIcon(activity.type)}</span>
                <div>
                  <h3 className="font-bold text-stone-900">{activity.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-stone-500">{activity.type}</p>
                    <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded uppercase font-bold text-stone-400">
                      {activity.scope === 'Shared'
                        ? (isSpanish ? 'Compartida' : 'Shared')
                        : activity.targetUserId === state.currentUser.id
                          ? state.currentUser.name
                          : activity.targetUserId === state.partner.id
                            ? state.partner.name
                            : (isSpanish ? 'Individual' : 'Individual')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button title={isSpanish ? 'Eliminar actividad' : 'Delete activity'} onClick={() => actions.deleteActivity(activity.id)} className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
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

            <p className="text-sm text-stone-500 italic line-clamp-2">{activity.notes || (isSpanish ? 'Sin notas.' : 'No notes added.')}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <ActivityModal 
          state={state}
          language={language}
          onClose={() => setIsModalOpen(false)} 
          onSave={actions.addActivity}
          onAddCustomType={actions.addCustomActivityType}
          availableTypes={availableTypes}
        />
      )}
    </div>
  );
};

const ActivityModal = ({ state, language, onClose, onSave, onAddCustomType, availableTypes }: any) => {
  const isSpanish = language === 'es';
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Activity>>({
    name: '',
    emoji: getTypeIcon('Adventure'),
    category: 'Free',
    estimatedCost: 0,
    duration: '1h',
    energyLevel: 'Medium',
    indoorOutdoor: 'Indoor',
    type: 'Adventure',
    notes: '',
    scope: 'Shared'
  });
  const [estimatedCostInput, setEstimatedCostInput] = useState('');
  const [customTypeInput, setCustomTypeInput] = useState('');

  const handleAddCustomType = () => {
    const normalized = customTypeInput.trim();
    if (!normalized) return;

    const exists = availableTypes.some((type: string) => type.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      onAddCustomType(normalized);
    }

    setFormData({ ...formData, type: normalized });
    setCustomTypeInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto no-scrollbar">
        <h3 className="text-2xl font-bold mb-6 text-stone-900">Create New Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? 'Nombre' : 'Name'}</label>
            <input 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder={isSpanish ? 'Ej. Caminata en el parque' : 'e.g. Hiking at Pine Hill'}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? '¿Para quién es?' : 'Who is this for?'}</label>
            <select 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.scope}
              onChange={e => setFormData({...formData, scope: e.target.value as any})}
            >
              <option value="Shared">{isSpanish ? 'Ambos (Compartida)' : 'Both (Shared)'}</option>
              <option value="Individual">{isSpanish ? 'Solo Individual' : 'Individual Only'}</option>
            </select>
          </div>

          {formData.scope === 'Individual' && (
            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? '¿Para quién?' : 'For whom?'}</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.targetUserId}
                onChange={e => setFormData({...formData, targetUserId: e.target.value})}
              >
                <option value="">{isSpanish ? 'Selecciona persona' : 'Select person'}</option>
                <option value={state.currentUser.id}>{state.currentUser.name}</option>
                <option value={state.partner.id}>{state.partner.name}</option>
              </select>
            </div>
          )}

          <div className={formData.scope !== 'Individual' ? 'md:col-span-1' : ''}>
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? 'Tipo de Costo' : 'Cost Type'}</label>
            <select 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.category}
              onChange={e => {
                const nextCategory = e.target.value as any;
                setFormData({
                  ...formData,
                  category: nextCategory,
                  estimatedCost: nextCategory === 'Free' ? 0 : (Number(estimatedCostInput) || 0),
                });
                if (nextCategory === 'Free') {
                  setEstimatedCostInput('');
                }
              }}
            >
              <option value="Free">{isSpanish ? 'Gratis' : 'Free'}</option>
              <option value="Paid">{isSpanish ? 'Pagado' : 'Paid'}</option>
            </select>
          </div>

          {formData.category === 'Paid' && (
            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? 'Costo Est. ($)' : 'Est. Cost ($)'}</label>
              <input 
                type="number"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={estimatedCostInput}
                onChange={e => {
                  const nextValue = e.target.value;
                  setEstimatedCostInput(nextValue);
                  setFormData({
                    ...formData,
                    estimatedCost: nextValue === '' ? 0 : Number(nextValue),
                  });
                }}
              />
            </div>
          )}

          <div className="md:col-span-2 grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Type</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.type}
                onChange={e => {
                  const nextType = e.target.value as any;
                  setFormData({ ...formData, type: nextType });
                }}
              >
                {availableTypes.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 bg-white text-sm"
                  value={customTypeInput}
                  onChange={e => setCustomTypeInput(e.target.value)}
                  placeholder={isSpanish ? 'Agregar tipo personalizado' : 'Add custom type'}
                />
                <button
                  type="button"
                  onClick={handleAddCustomType}
                  className="px-3 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold whitespace-nowrap"
                >
                  {isSpanish ? 'Agregar' : 'Add'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? 'Nivel de Energía' : 'Energy Level'}</label>
              <select 
                className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
                value={formData.energyLevel}
                onChange={e => setFormData({...formData, energyLevel: e.target.value as any})}
              >
                <option value="Low">{isSpanish ? 'Baja' : 'Low'}</option>
                <option value="Medium">{isSpanish ? 'Media' : 'Medium'}</option>
                <option value="High">{isSpanish ? 'Alta' : 'High'}</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">Emoji</label>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-2 mb-3">
              {ACTIVITY_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setFormData({ ...formData, emoji })}
                  className={`h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${formData.emoji === emoji ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 bg-white"
              value={formData.emoji || ''}
              onChange={e => setFormData({ ...formData, emoji: e.target.value })}
              placeholder={isSpanish ? 'O pega cualquier emoji' : 'Or paste any emoji'}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-stone-500 mb-2 uppercase tracking-wider">{isSpanish ? 'Notas' : 'Notes'}</label>
            <textarea 
              className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>
        </div>

        {validationError && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">{isSpanish ? 'Validación' : 'Validation'}</p>
            <p className="text-sm font-semibold text-rose-700 mt-1">{validationError}</p>
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <button 
            onClick={() => {
              if (!(formData.name || '').trim()) {
                setValidationError(isSpanish ? 'Por favor ingresa un nombre para la actividad.' : 'Please enter an activity name.');
                return;
              }
              if (formData.scope === 'Individual' && !formData.targetUserId) {
                setValidationError(isSpanish ? 'Selecciona a quién se asigna esta actividad.' : 'Please select who this activity is for.');
                return;
              }

              setValidationError(null);
              const finalEstimatedCost = formData.category === 'Free'
                ? 0
                : (estimatedCostInput.trim() === '' ? 0 : Number(estimatedCostInput));
              onSave({
                ...formData,
                estimatedCost: finalEstimatedCost,
                emoji: (formData.emoji || '').trim() || getTypeIcon(String(formData.type || 'Adventure')),
                id: Date.now().toString()
              });
              onClose();
            }}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-colors"
          >
            {isSpanish ? 'Guardar Actividad' : 'Save Activity'}
          </button>
          <button onClick={onClose} className="px-8 bg-stone-100 text-stone-500 py-4 rounded-2xl font-bold">
            {isSpanish ? 'Cancelar' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityDB;
