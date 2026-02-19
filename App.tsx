import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { User, PlannerState, Activity, CalendarEvent, Goal, ActivityLog } from './types';
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import BudgetDashboard from './components/BudgetDashboard';
import ActivityDB from './components/ActivityDB';
import GoalsSystem from './components/GoalsSystem';
import InsightsPanel from './components/InsightsPanel';
import supabase from './supabaseClient';

const STORAGE_KEY = 'couple_planner_data';
const AUTH_INTENT_KEY = 'planner_auth_intent';
const THEME_KEY = 'planner_theme';
const DEBUG_SYNC = (import.meta.env.VITE_DEBUG_SYNC ?? 'false') === 'true';

const FALLBACK_AVATAR = 'https://picsum.photos/seed/default-avatar/100/100';

type AuthIntent = 'login' | 'register';
type LinkMode = 'choose' | 'invited' | 'new';

type AppUserProfile = {
  id: string;
  google_id: string | null;
  email: string;
  username: string;
  avatar_url: string | null;
  birthday: string | null;
  phone: string | null;
  planner_id: string | null;
  created_at: string;
};

type PlannerMemberRow = {
  user_id: string;
  member_slot: number;
};

type PlannerMemberProfile = {
  user_id: string;
  member_slot: number;
  username: string;
  avatar_url: string | null;
  birthday: string | null;
  phone: string | null;
};

const getStoredAuthIntent = (): AuthIntent => {
  const raw = localStorage.getItem(AUTH_INTENT_KEY);
  return raw === 'register' ? 'register' : 'login';
};

const setStoredAuthIntent = (intent: AuthIntent) => {
  localStorage.setItem(AUTH_INTENT_KEY, intent);
};

const toPlannerUser = (slot: number, username: string, avatarUrl?: string | null): User => ({
  id: slot === 2 ? 'user-2' : 'user-1',
  name: username,
  avatar: avatarUrl || FALLBACK_AVATAR,
});

const buildInitialPlannerState = (currentUser: User, partner: User): PlannerState => ({
  currentUser,
  partner,
  activities: [],
  events: [],
  sharedGoals: [],
  individualGoals: [],
  budget: { monthlyLimit: 2000 },
  logs: [],
});

const generateInviteCode = (length = 10): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, value => alphabet[value % alphabet.length]).join('');
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);

  const [authIntent, setAuthIntent] = useState<AuthIntent>(() => getStoredAuthIntent());
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<PlannerMemberProfile[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>('choose');

  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileAvatarInput, setProfileAvatarInput] = useState('');
  const [profileBirthdayInput, setProfileBirthdayInput] = useState('');
  const [profilePhoneInput, setProfilePhoneInput] = useState('');
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileInviteCode, setProfileInviteCode] = useState<string | null>(null);
  const [profileInviteLoading, setProfileInviteLoading] = useState(false);

  const [state, setState] = useState<PlannerState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return buildInitialPlannerState(
        { id: 'user-1', name: 'You', avatar: FALLBACK_AVATAR },
        { id: 'user-2', name: 'Partner', avatar: FALLBACK_AVATAR }
      );
    }

    try {
      return JSON.parse(saved) as PlannerState;
    } catch {
      return buildInitialPlannerState(
        { id: 'user-1', name: 'You', avatar: FALLBACK_AVATAR },
        { id: 'user-2', name: 'Partner', avatar: FALLBACK_AVATAR }
      );
    }
  });

  const [currentTab, setCurrentTab] = useState('calendar');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === 'dark') return true;
    if (storedTheme === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const hasHydratedFromSupabase = useRef(false);
  const isApplyingRemoteState = useRef(false);
  const saveTimeoutId = useRef<number | null>(null);
  const lastSyncedStateSignature = useRef('');
  const activeRealtimeChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const debug = (...args: any[]) => {
    if (!DEBUG_SYNC) return;
    console.log('[PlannerDebug]', ...args);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', isDarkMode);
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const themeToggleButton = (
    <button
      onClick={() => setIsDarkMode(prev => !prev)}
      className="fixed top-4 right-4 z-[120] h-10 w-10 rounded-full border border-stone-200 bg-white/90 backdrop-blur text-lg shadow-sm hover:scale-105 transition-transform"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  );

  const beginGoogleAuth = async (intent: AuthIntent) => {
    setFormError(null);
    setAuthIntent(intent);
    setStoredAuthIntent(intent);
    debug('beginGoogleAuth', { intent });
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    debug('signOut:start');
    await supabase.auth.signOut();
    setProfile(null);
    setMemberProfiles([]);
    setGeneratedInviteCode(null);
    setLinkMode('choose');
    setFormError(null);
    debug('signOut:done');
  };

  const fetchProfile = useCallback(async (userId: string): Promise<AppUserProfile | null> => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (DEBUG_SYNC) {
      console.log('[PlannerDebug] fetchProfile', { userId, found: !!data, error: error?.message || null });
    }

    return (data as AppUserProfile | null) || null;
  }, []);

  const upsertPlannerState = useCallback(async (plannerId: string, plannerState: PlannerState) => {
    debug('savePlannerState:attempt', {
      plannerId,
      activities: plannerState.activities.length,
      events: plannerState.events.length,
      sharedGoals: plannerState.sharedGoals.length,
      individualGoals: plannerState.individualGoals.length,
      logs: plannerState.logs.length,
    });
    const { error } = await supabase.rpc('save_planner_state', {
      p_planner_id: plannerId,
      p_data: plannerState,
    });

    if (error) {
      debug('savePlannerState:error', { plannerId, error: error.message });
      throw new Error(error.message);
    }

    debug('savePlannerState:success', { plannerId });
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      debug('bootstrapAuth', { hasSession: !!data.session, userId: data.session?.user?.id || null });
      setSession(data.session);
      setAuthLoading(false);
    };

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      debug('onAuthStateChange', { event, hasSession: !!nextSession, userId: nextSession?.user?.id || null });
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        hasHydratedFromSupabase.current = false;
        lastSyncedStateSignature.current = '';
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      setMemberProfiles([]);
      return;
    }

    let active = true;
    setProfileLoading(true);

    fetchProfile(session.user.id)
      .then(userProfile => {
        if (!active) return;
        setProfile(userProfile);
      })
      .finally(() => {
        if (!active) return;
        setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, fetchProfile]);

  const loadPlannerContext = useCallback(async () => {
    if (!session?.user.id || !profile?.planner_id) return;

    setPlannerLoading(true);
    setFormError(null);

    const plannerId = profile.planner_id;
    debug('loadPlannerContext:start', { plannerId, userId: session.user.id });

    const { data: membersData, error: membersError } = await supabase
      .from('planner_members')
      .select('user_id, member_slot')
      .eq('planner_id', plannerId)
      .order('member_slot', { ascending: true });

    if (membersError) {
      debug('loadPlannerContext:membersError', { plannerId, error: membersError.message });
      setFormError(membersError.message);
      setPlannerLoading(false);
      return;
    }

    const members = (membersData || []) as PlannerMemberRow[];
    debug('loadPlannerContext:members', { plannerId, memberCount: members.length, members });
    const me = members.find(m => m.user_id === session.user.id);

    if (!me) {
      debug('loadPlannerContext:noMemberForCurrentUser', { plannerId, userId: session.user.id });
      setFormError('You are not linked correctly to this planner.');
      setPlannerLoading(false);
      return;
    }

    const memberUserIds = members.map(m => m.user_id);
    const { data: userProfilesData, error: userProfilesError } = await supabase
      .from('app_users')
      .select('id, username, avatar_url, birthday, phone')
      .in('id', memberUserIds);

    if (userProfilesError) {
      debug('loadPlannerContext:userProfilesError', { plannerId, error: userProfilesError.message });
      setFormError(userProfilesError.message);
      setPlannerLoading(false);
      return;
    }

    const userProfiles = userProfilesData || [];
    const usersById = new Map(userProfiles.map(user => [user.id, user]));
    const meProfile = usersById.get(session.user.id) || {
      id: session.user.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
    };

    const partnerMember = members.find(m => m.user_id !== session.user.id);
    const partnerProfile = partnerMember ? usersById.get(partnerMember.user_id) : null;

    const nextMemberProfiles: PlannerMemberProfile[] = members.map(member => {
      const userProfile = usersById.get(member.user_id);
      return {
        user_id: member.user_id,
        member_slot: member.member_slot,
        username: userProfile?.username || (member.user_id === session.user.id ? profile.username : 'Partner'),
        avatar_url: userProfile?.avatar_url || null,
        birthday: userProfile?.birthday || null,
        phone: userProfile?.phone || null,
      };
    });
    setMemberProfiles(nextMemberProfiles);

    const currentUser = toPlannerUser(me.member_slot, meProfile.username, meProfile.avatar_url);
    const partner = partnerMember
      ? toPlannerUser(partnerMember.member_slot, partnerProfile?.username || 'Partner', partnerProfile?.avatar_url || FALLBACK_AVATAR)
      : {
          id: me.member_slot === 1 ? 'user-2' : 'user-1',
          name: 'Waiting for partner',
          avatar: FALLBACK_AVATAR,
        };

    const { data: plannerStateRow, error: plannerStateError } = await supabase
      .from('planner_state')
      .select('data')
      .eq('planner_id', plannerId)
      .maybeSingle();
    if (plannerStateError) {
      debug('loadPlannerContext:stateRowError', { plannerId, error: plannerStateError.message });
    }
    debug('loadPlannerContext:stateRow', { plannerId, hasStateRow: !!plannerStateRow?.data });

    let nextState: PlannerState;

    if (plannerStateRow?.data) {
      const remoteState = plannerStateRow.data as PlannerState;
      nextState = {
        ...remoteState,
        currentUser,
        partner,
      };
    } else {
      nextState = buildInitialPlannerState(currentUser, partner);
      try {
        await upsertPlannerState(plannerId, nextState);
      } catch (error) {
        debug('loadPlannerContext:initSaveError', { plannerId, error: error instanceof Error ? error.message : String(error) });
        setFormError(error instanceof Error ? error.message : 'Failed to initialize planner state.');
      }
    }

    const signature = JSON.stringify(nextState);
    lastSyncedStateSignature.current = signature;
    isApplyingRemoteState.current = true;
    setState(nextState);
    window.setTimeout(() => {
      isApplyingRemoteState.current = false;
    }, 0);

    hasHydratedFromSupabase.current = true;
    debug('loadPlannerContext:done', {
      plannerId,
      hydrated: hasHydratedFromSupabase.current,
      activities: nextState.activities.length,
      events: nextState.events.length,
      sharedGoals: nextState.sharedGoals.length,
      individualGoals: nextState.individualGoals.length,
    });
    setPlannerLoading(false);
  }, [profile?.planner_id, session?.user.id, upsertPlannerState]);

  useEffect(() => {
    if (!profile?.planner_id || !session?.user.id) return;
    loadPlannerContext();
  }, [profile?.planner_id, session?.user.id, loadPlannerContext]);

  useEffect(() => {
    if (!profile?.planner_id) {
      if (activeRealtimeChannel.current) {
        supabase.removeChannel(activeRealtimeChannel.current);
        activeRealtimeChannel.current = null;
      }
      return;
    }

    if (activeRealtimeChannel.current) {
      supabase.removeChannel(activeRealtimeChannel.current);
      activeRealtimeChannel.current = null;
    }

    const plannerId = profile.planner_id;
    debug('realtime:subscribe', { plannerId });
    const channel = supabase
      .channel(`planner-state-${plannerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'planner_state',
          filter: `planner_id=eq.${plannerId}`,
        },
        (payload) => {
          const remoteState = (payload.new as { data?: PlannerState } | null)?.data;
          if (!remoteState) return;

          debug('realtime:payload', {
            plannerId,
            eventType: payload.eventType,
            hasData: !!remoteState,
            activities: remoteState.activities?.length,
            events: remoteState.events?.length,
            sharedGoals: remoteState.sharedGoals?.length,
            individualGoals: remoteState.individualGoals?.length,
          });

          const remoteSignature = JSON.stringify(remoteState);
          if (remoteSignature === lastSyncedStateSignature.current) {
            debug('realtime:skipSameSignature', { plannerId });
            return;
          }

          lastSyncedStateSignature.current = remoteSignature;
          isApplyingRemoteState.current = true;
          setState(remoteState);
          window.setTimeout(() => {
            isApplyingRemoteState.current = false;
          }, 0);
        }
      )
      .subscribe();

    activeRealtimeChannel.current = channel;

    return () => {
      debug('realtime:unsubscribe', { plannerId });
      supabase.removeChannel(channel);
    };
  }, [profile?.planner_id]);

  useEffect(() => {
    if (!hasHydratedFromSupabase.current || isApplyingRemoteState.current || !profile?.planner_id) {
      debug('saveEffect:blocked', {
        hydrated: hasHydratedFromSupabase.current,
        applyingRemote: isApplyingRemoteState.current,
        plannerId: profile?.planner_id || null,
      });
      return;
    }

    const nextSignature = JSON.stringify(state);
    if (nextSignature === lastSyncedStateSignature.current) {
      debug('saveEffect:skipSameSignature', { plannerId: profile.planner_id });
      return;
    }

    if (saveTimeoutId.current !== null) {
      window.clearTimeout(saveTimeoutId.current);
    }

    saveTimeoutId.current = window.setTimeout(async () => {
      try {
        debug('saveEffect:flush', { plannerId: profile.planner_id });
        await upsertPlannerState(profile.planner_id!, state);
        lastSyncedStateSignature.current = nextSignature;
      } catch (error) {
        debug('saveEffect:error', { plannerId: profile.planner_id, error: error instanceof Error ? error.message : String(error) });
        setFormError(error instanceof Error ? error.message : 'Failed to save planner changes.');
      }
    }, 250);
  }, [state, profile?.planner_id, upsertPlannerState]);

  const currentMemberProfile = memberProfiles.find(member => member.user_id === session?.user.id) || null;
  const isWaitingForPartner = Boolean(profile?.planner_id) && memberProfiles.length < 2;

  const loadOrCreateProfileInviteCode = useCallback(async () => {
    if (!profile?.planner_id || !session?.user.id) {
      setProfileInviteCode(null);
      return;
    }

    if (memberProfiles.length >= 2) {
      setProfileInviteCode(null);
      return;
    }

    setProfileInviteLoading(true);

    const { data: existingInvite, error: inviteFetchError } = await supabase
      .from('invite_codes')
      .select('code, created_at')
      .eq('planner_id', profile.planner_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteFetchError) {
      setFormError(inviteFetchError.message);
      setProfileInviteLoading(false);
      return;
    }

    if (existingInvite?.code) {
      setProfileInviteCode(existingInvite.code);
      setProfileInviteLoading(false);
      return;
    }

    let createdCode: string | null = null;
    for (let attempt = 0; attempt < 8 && !createdCode; attempt += 1) {
      const code = generateInviteCode();
      const { error } = await supabase.from('invite_codes').insert({
        code,
        planner_id: profile.planner_id,
        status: 'active',
      });

      if (!error) {
        createdCode = code;
      }
    }

    if (!createdCode) {
      setFormError('Failed to generate invite code. Please try again.');
      setProfileInviteCode(null);
      setProfileInviteLoading(false);
      return;
    }

    setProfileInviteCode(createdCode);
    setProfileInviteLoading(false);
  }, [memberProfiles.length, profile?.planner_id, session?.user.id]);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    setProfileAvatarInput(currentMemberProfile?.avatar_url || profile?.avatar_url || state.currentUser.avatar || '');
    setProfileBirthdayInput(currentMemberProfile?.birthday || profile?.birthday || '');
    setProfilePhoneInput(currentMemberProfile?.phone || profile?.phone || '');
  }, [isProfileModalOpen, currentMemberProfile, profile, state.currentUser.avatar]);

  useEffect(() => {
    if (!isProfileModalOpen) return;

    if (!isWaitingForPartner) {
      setProfileInviteCode(null);
      return;
    }

    loadOrCreateProfileInviteCode();
  }, [isProfileModalOpen, isWaitingForPartner, loadOrCreateProfileInviteCode]);

  const handleProfileImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = typeof reader.result === 'string' ? reader.result : '';
      if (base64Image) {
        setProfileAvatarInput(base64Image);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfileDetails = async () => {
    if (!session?.user.id) return;

    setProfileSaveLoading(true);
    setFormError(null);

    const { error } = await supabase
      .from('app_users')
      .update({
        avatar_url: profileAvatarInput || null,
        birthday: profileBirthdayInput || null,
        phone: profilePhoneInput || null,
      })
      .eq('id', session.user.id);

    if (error) {
      setFormError(error.message);
      setProfileSaveLoading(false);
      return;
    }

    const refreshed = await fetchProfile(session.user.id);
    setProfile(refreshed);
    await loadPlannerContext();
    setIsProfileModalOpen(false);
    setProfileSaveLoading(false);
  };

  const addLog = useCallback((message: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      message,
      userName: state.currentUser.name,
    };

    setState(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50),
    }));
  }, [state.currentUser.name]);

  const updateState = <K extends keyof PlannerState>(key: K, value: PlannerState[K]) => {
    debug('updateState', { key, valueType: typeof value });
    setState(prev => ({ ...prev, [key]: value }));
  };

  const createProfile = async () => {
    if (!session?.user || !usernameInput.trim()) {
      setFormError('Choose a username to continue.');
      return;
    }

    setActionLoading(true);
    setFormError(null);

    const googleId = (session.user.user_metadata?.sub as string | undefined)
      || (session.user.identities?.[0]?.identity_id as string | undefined)
      || null;

    const { error } = await supabase.from('app_users').insert({
      id: session.user.id,
      google_id: googleId,
      email: session.user.email || '',
      username: usernameInput.trim(),
      avatar_url: (session.user.user_metadata?.avatar_url as string | undefined)
        || (session.user.user_metadata?.picture as string | undefined)
        || null,
    });

    if (error) {
      setFormError(error.message.includes('app_users_username_key') ? 'Username already taken.' : error.message);
      setActionLoading(false);
      return;
    }

    const refreshed = await fetchProfile(session.user.id);
    setProfile(refreshed);
    setActionLoading(false);
  };

  const linkWithInviteCode = async () => {
    if (!session?.user.id || !profile || !inviteCodeInput.trim()) {
      setFormError('Enter a valid invite code.');
      return;
    }

    setActionLoading(true);
    setFormError(null);
    debug('linkWithInviteCode:start', { userId: session.user.id, code: inviteCodeInput.trim().toUpperCase() });

    const code = inviteCodeInput.trim().toUpperCase();

    const { data: inviteRow } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (!inviteRow || inviteRow.status !== 'active') {
      debug('linkWithInviteCode:invalid', { inviteFound: !!inviteRow, status: inviteRow?.status || null });
      setFormError('Invite code is invalid or already used.');
      setActionLoading(false);
      return;
    }

    const plannerId = inviteRow.planner_id as string;

    const { data: existingMembership } = await supabase
      .from('planner_members')
      .select('planner_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existingMembership?.planner_id) {
      setFormError('You are already linked to a planner.');
      setActionLoading(false);
      return;
    }

    const { data: members } = await supabase
      .from('planner_members')
      .select('member_slot')
      .eq('planner_id', plannerId);

    const currentMembers = members || [];
    if (currentMembers.length >= 2) {
      debug('linkWithInviteCode:plannerFull', { plannerId, memberCount: currentMembers.length });
      setFormError('This planner already has 2 linked users.');
      setActionLoading(false);
      return;
    }

    const usedSlots = new Set(currentMembers.map(m => m.member_slot));
    const slot = usedSlots.has(1) ? 2 : 1;

    const { error: memberError } = await supabase.from('planner_members').insert({
      planner_id: plannerId,
      user_id: session.user.id,
      member_slot: slot,
    });

    if (memberError) {
      debug('linkWithInviteCode:memberInsertError', { plannerId, error: memberError.message });
      setFormError(memberError.message);
      setActionLoading(false);
      return;
    }

    await supabase
      .from('app_users')
      .update({ planner_id: plannerId })
      .eq('id', session.user.id);

    await supabase
      .from('invite_codes')
      .update({ status: 'used', used_by: session.user.id, used_at: new Date().toISOString() })
      .eq('code', code)
      .eq('status', 'active');

    const refreshed = await fetchProfile(session.user.id);
    debug('linkWithInviteCode:success', { plannerId, userId: session.user.id });
    setProfile(refreshed);
    setActionLoading(false);
  };

  const createNewPlanner = async () => {
    if (!session?.user.id || !profile) {
      setFormError('Unable to create planner right now.');
      return;
    }

    setActionLoading(true);
    setFormError(null);
    debug('createNewPlanner:start', { userId: session.user.id });

    const { data: existingMembership } = await supabase
      .from('planner_members')
      .select('planner_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existingMembership?.planner_id) {
      setFormError('You are already linked to a planner.');
      setActionLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session?.access_token) {
      setFormError('Your session expired. Please sign in again.');
      setActionLoading(false);
      await signOut();
      return;
    }

    const { data: plannerIdFromRpc, error: plannerError } = await supabase
      .rpc('create_planner_for_current_user');

    if (plannerError || !plannerIdFromRpc) {
      debug('createNewPlanner:rpcError', { error: plannerError?.message || null });
      setFormError(plannerError?.message || 'Could not create planner.');
      setActionLoading(false);
      return;
    }

    const plannerId = plannerIdFromRpc as string;
    debug('createNewPlanner:plannerCreated', { plannerId });

    await supabase.from('planner_members').insert({
      planner_id: plannerId,
      user_id: session.user.id,
      member_slot: 1,
    });
    debug('createNewPlanner:memberInserted', { plannerId, userId: session.user.id });

    let codeCreated = false;
    let finalCode = '';

    for (let attempt = 0; attempt < 8 && !codeCreated; attempt += 1) {
      const code = generateInviteCode();
      const { error } = await supabase.from('invite_codes').insert({
        code,
        planner_id: plannerId,
        status: 'active',
      });

      if (!error) {
        codeCreated = true;
        finalCode = code;
      }
    }

    if (!codeCreated) {
      debug('createNewPlanner:inviteCodeFailed', { plannerId });
      setFormError('Failed to generate invite code. Try again.');
      setActionLoading(false);
      return;
    }

    await supabase
      .from('app_users')
      .update({ planner_id: plannerId })
      .eq('id', session.user.id);
    debug('createNewPlanner:userLinked', { plannerId, userId: session.user.id });

    const currentUser = toPlannerUser(1, profile.username, profile.avatar_url);
    const partner = toPlannerUser(2, 'Waiting for partner', FALLBACK_AVATAR);

    const seededState = buildInitialPlannerState(currentUser, partner);
    try {
      await upsertPlannerState(plannerId, seededState);
    } catch (error) {
      debug('createNewPlanner:seedStateError', { plannerId, error: error instanceof Error ? error.message : String(error) });
      setFormError(error instanceof Error ? error.message : 'Failed to seed planner state.');
      setActionLoading(false);
      return;
    }

    const refreshed = await fetchProfile(session.user.id);
    debug('createNewPlanner:success', { plannerId, inviteCode: finalCode });
    setProfile(refreshed);
    setGeneratedInviteCode(finalCode);
    setActionLoading(false);
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
      addLog('Deleted an activity');
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
      addLog('Removed an event from calendar');
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

  if (authLoading || profileLoading || plannerLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
        {themeToggleButton}
        <div className="bg-white border border-stone-200 rounded-3xl px-8 py-6 shadow-sm text-center">
          <p className="text-stone-900 font-bold">Loading Planner...</p>
          <p className="text-sm text-stone-500 mt-1">Syncing your workspace securely.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`min-h-screen text-stone-900 ${isDarkMode ? 'bg-slate-950' : 'bg-gradient-to-b from-white to-stone-100'}`}>
        {themeToggleButton}
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
          <header className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-lg">C</div>
              <span className="font-black text-xl tracking-tight">PlannerPro</span>
            </div>
            <div className="hidden md:flex gap-3">
              <button onClick={() => beginGoogleAuth('login')} className="px-5 py-2.5 border border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50 transition-colors">Login</button>
              <button onClick={() => beginGoogleAuth('register')} className="px-5 py-2.5 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors">Register</button>
            </div>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="inline-flex bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-5">Private Couple Workspace</p>
              <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight">Plan life together, in one synced planner.</h1>
              <p className="mt-5 text-lg text-stone-600 leading-relaxed max-w-xl">
                PlannerPro keeps your goals, activities, shared calendar, and budget in one place so both partners always see the same up-to-date plan in realtime.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button onClick={() => beginGoogleAuth('login')} className="px-6 py-3 border border-stone-300 rounded-2xl font-bold text-stone-700 hover:bg-stone-50 transition-colors">Login with Google</button>
                <button onClick={() => beginGoogleAuth('register')} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors">Register with Google</button>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-3xl p-8 md:p-10 shadow-sm">
              <h3 className="text-xl font-black text-stone-900 mb-5">How it works</h3>
              <div className="space-y-4 text-stone-600">
                <div>
                  <p className="font-bold text-stone-900">1) Authenticate securely</p>
                  <p className="text-sm">Use your Google account to sign in. No passwords to manage.</p>
                </div>
                <div>
                  <p className="font-bold text-stone-900">2) Link with your partner</p>
                  <p className="text-sm">Create a planner or join one with a one-time invite code.</p>
                </div>
                <div>
                  <p className="font-bold text-stone-900">3) Plan in realtime</p>
                  <p className="text-sm">Any update to goals, activities, events, or budget appears for both users instantly.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!profile) {
    if (authIntent === 'login') {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          {themeToggleButton}
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-sm text-center">
            <h2 className="text-2xl font-black text-stone-900 mb-3">No account found</h2>
            <p className="text-stone-600 mb-6">This Google account is not registered yet. Continue with registration to create your planner profile.</p>
            <div className="flex gap-3">
              <button onClick={signOut} className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600">Back</button>
              <button
                onClick={() => {
                  setAuthIntent('register');
                  setStoredAuthIntent('register');
                }}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold"
              >
                Continue Register
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        {themeToggleButton}
        <div className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-3xl font-black text-stone-900 mb-2">Create your profile</h2>
          <p className="text-stone-600 mb-2">You are signed in with Google, but your Planner profile is not created yet.</p>
          <p className="text-stone-600 mb-6">Pick a unique username before linking your planner.</p>
          <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Username</label>
          <input
            type="text"
            value={usernameInput}
            onChange={e => setUsernameInput(e.target.value)}
            placeholder="e.g. davidandcarla"
            className="w-full border-2 border-stone-200 bg-stone-50 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
          />
          {formError && <p className="text-rose-600 text-sm mt-3 font-medium">{formError}</p>}
          <div className="flex gap-3 mt-6">
            <button onClick={signOut} className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600">Back to Home</button>
            <button onClick={createProfile} disabled={actionLoading} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold disabled:opacity-60">
              {actionLoading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile.planner_id) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        {themeToggleButton}
        <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-3xl p-8 md:p-10 shadow-sm">
          <h2 className="text-3xl font-black text-stone-900 mb-2">Link your planner</h2>
          <p className="text-stone-600 mb-6">Were you invited, or are you starting a new planner?</p>

          {linkMode === 'choose' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setLinkMode('invited')} className="p-6 rounded-2xl border-2 border-stone-200 hover:border-emerald-500 text-left transition-all">
                <p className="text-lg font-black text-stone-900">I was invited</p>
                <p className="text-sm text-stone-600 mt-2">Join an existing planner with an invite code.</p>
              </button>
              <button onClick={() => setLinkMode('new')} className="p-6 rounded-2xl border-2 border-stone-200 hover:border-emerald-500 text-left transition-all">
                <p className="text-lg font-black text-stone-900">I am starting a new planner</p>
                <p className="text-sm text-stone-600 mt-2">Create your planner and generate a one-time invite code.</p>
              </button>
            </div>
          )}

          {linkMode === 'invited' && (
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em]">Enter Invite Code</label>
              <input
                type="text"
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. 8K7M2P9R"
                className="w-full border-2 border-stone-200 bg-stone-50 rounded-2xl px-5 py-4 font-black tracking-[0.2em] uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
              />
              <div className="flex gap-3">
                <button onClick={() => setLinkMode('choose')} className="px-5 py-3 border border-stone-200 rounded-xl font-bold text-stone-600">Back</button>
                <button onClick={linkWithInviteCode} disabled={actionLoading} className="px-5 py-3 bg-stone-900 text-white rounded-xl font-bold disabled:opacity-60">
                  {actionLoading ? 'Linking...' : 'Join Planner'}
                </button>
              </div>
            </div>
          )}

          {linkMode === 'new' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">A new planner will be created with you as owner. An invite code will be generated for one partner only.</p>
              <div className="flex gap-3">
                <button onClick={() => setLinkMode('choose')} className="px-5 py-3 border border-stone-200 rounded-xl font-bold text-stone-600">Back</button>
                <button onClick={createNewPlanner} disabled={actionLoading} className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-60">
                  {actionLoading ? 'Creating...' : 'Create Planner'}
                </button>
              </div>
            </div>
          )}

          {formError && <p className="text-rose-600 text-sm mt-4 font-medium">{formError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 flex-col lg:flex-row">
      {themeToggleButton}
      <header className="lg:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">C</div>
          <span className="font-black text-stone-900 tracking-tight">PlannerPro</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="px-3 py-1.5 text-xs rounded-full border border-stone-200 bg-stone-50 font-bold">Profile</button>
          <button onClick={signOut} className="px-3 py-1.5 text-xs rounded-full border border-stone-200 bg-stone-50 font-bold">Logout</button>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="rounded-full"
            title="Open profile"
          >
            <img className="h-8 w-8 rounded-full ring-2 ring-emerald-500 object-cover" src={state.currentUser.avatar} alt={state.currentUser.name} />
          </button>
        </div>
      </header>

      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={state.currentUser}
        partner={state.partner}
        switchUser={() => {}}
        showSwitchUser={false}
        onProfileClick={() => setIsProfileModalOpen(true)}
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
              <button onClick={() => setIsProfileModalOpen(true)} className="px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50">Profile</button>
              <button onClick={signOut} className="px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50">Logout</button>
            </div>
          </header>

          <section className="animate-in fade-in duration-500">
            {currentTab === 'calendar' && <CalendarView state={state} actions={actions} memberProfiles={memberProfiles} />}
            {currentTab === 'activities' && <ActivityDB state={state} actions={actions} />}
            {currentTab === 'budget' && <BudgetDashboard state={state} actions={actions} isDarkMode={isDarkMode} />}
            {currentTab === 'goals' && <GoalsSystem state={state} actions={actions} />}
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

      {generatedInviteCode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-5">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-2xl p-8 text-center">
            <h3 className="text-2xl font-black text-stone-900">Planner Created 🎉</h3>
            <p className="text-stone-600 mt-2">Share this code with one person only. This code can be used once.</p>
            <div className="mt-6 bg-stone-900 text-white rounded-2xl py-4 px-6 text-2xl font-black tracking-[0.3em]">{generatedInviteCode}</div>
            <button onClick={() => setGeneratedInviteCode(null)} className="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold">Continue to Dashboard</button>
          </div>
        </div>
      )}

      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-5">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-stone-200 shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-stone-900">Edit Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-stone-400 hover:text-stone-900 text-2xl">✕</button>
            </div>

            <div className="space-y-5">
              {isWaitingForPartner && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em]">Invite your partner</p>
                  <p className="text-sm text-emerald-800 mt-1">Share this code. It disappears once your partner links.</p>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 rounded-xl bg-stone-900 text-white px-4 py-3 text-center font-black tracking-[0.2em] text-base">
                      {profileInviteLoading ? 'Generating...' : (profileInviteCode || 'Unavailable')}
                    </div>
                    <button
                      onClick={() => {
                        if (!profileInviteCode) return;
                        navigator.clipboard.writeText(profileInviteCode);
                      }}
                      disabled={!profileInviteCode}
                      className="px-4 py-3 rounded-xl border border-emerald-300 text-emerald-700 font-bold bg-white disabled:opacity-60"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Profile Photo</label>
                <div className="flex items-center gap-4">
                  <img
                    src={profileAvatarInput || state.currentUser.avatar || FALLBACK_AVATAR}
                    alt="Profile preview"
                    className="w-16 h-16 rounded-full object-cover border border-stone-200"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-stone-100 file:text-stone-700 file:font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Birthday (Optional)</label>
                <input
                  type="date"
                  value={profileBirthdayInput}
                  onChange={(e) => setProfileBirthdayInput(e.target.value)}
                  className="w-full border-2 border-stone-200 bg-stone-50 rounded-2xl px-5 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Phone (Optional)</label>
                <input
                  type="tel"
                  value={profilePhoneInput}
                  onChange={(e) => setProfilePhoneInput(e.target.value)}
                  placeholder="e.g. +1 555 123 4567"
                  className="w-full border-2 border-stone-200 bg-stone-50 rounded-2xl px-5 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={saveProfileDetails}
                disabled={profileSaveLoading}
                className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold disabled:opacity-60"
              >
                {profileSaveLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
