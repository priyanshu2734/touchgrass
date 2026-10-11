import {
  Bird,
  Camera,
  Dumbbell,
  Footprints,
  Heart,
  Palette,
  Sprout,
  TreePine,
  User,
  Users,
  UsersRound,
  Hand,
  type LucideIcon,
} from 'lucide-react';
import type {
  AccessibilityNeed,
  Budget,
  Company,
  Difficulty,
  Energy,
  Interest,
  QuestCategory,
  TimeOption,
} from '../types';

export type ChipTone = 'forest' | 'sage' | 'ember' | 'cream';

export const TIME_CHOICES: { value: TimeOption; label: string }[] = [
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
  { value: 120, label: '120+ min' },
];

export const BUDGET_CHOICES: { value: Budget; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'low', label: 'Low-cost' },
  { value: 'flexible', label: 'Flexible' },
];

export const ENERGY_CHOICES: { value: Energy; label: string }[] = [
  { value: 'low', label: 'Low energy' },
  { value: 'medium', label: 'Medium energy' },
  { value: 'high', label: 'High energy' },
];

export const INTEREST_META: Record<Interest, { label: string; icon: LucideIcon; tone: ChipTone }> = {
  walking: { label: 'Walking', icon: Footprints, tone: 'sage' },
  nature: { label: 'Nature', icon: TreePine, tone: 'forest' },
  photography: { label: 'Photography', icon: Camera, tone: 'ember' },
  gardening: { label: 'Gardening', icon: Sprout, tone: 'sage' },
  fitness: { label: 'Fitness', icon: Dumbbell, tone: 'forest' },
  birdwatching: { label: 'Birdwatching', icon: Bird, tone: 'cream' },
  creativity: { label: 'Creativity', icon: Palette, tone: 'ember' },
  social: { label: 'Social activities', icon: Users, tone: 'cream' },
};

export const INTEREST_IDS = Object.keys(INTEREST_META) as Interest[];

export const COMPANY_CHOICES: { value: Company; label: string; icon: LucideIcon }[] = [
  { value: 'solo', label: 'Solo', icon: User },
  { value: 'friends', label: 'Friends', icon: Users },
  { value: 'family', label: 'Family', icon: Heart },
  { value: 'group', label: 'Group', icon: UsersRound },
];

export const ACCESSIBILITY_CHOICES: { value: AccessibilityNeed; label: string }[] = [
  { value: 'step-free', label: 'Step-free routes' },
  { value: 'seating', label: 'Seating nearby' },
  { value: 'shade', label: 'Shade' },
  { value: 'low-sensory', label: 'Quiet, low-sensory' },
  { value: 'short-distance', label: 'Short distances' },
];

export const ACCESSIBILITY_LABEL: Record<AccessibilityNeed, string> = {
  'step-free': 'step-free routes',
  seating: 'seating nearby',
  shade: 'shade',
  'low-sensory': 'quiet, low-sensory spaces',
  'short-distance': 'short distances',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging',
};

export const ENERGY_LABEL: Record<Energy, string> = {
  low: 'Low energy',
  medium: 'Medium energy',
  high: 'High energy',
};

export const BUDGET_LABEL: Record<Budget, string> = {
  free: 'Free',
  low: 'Low-cost',
  flexible: 'Flexible budget',
};

export const COMPANY_LABEL: Record<Company, string> = {
  solo: 'solo',
  friends: 'with friends',
  family: 'with family',
  group: 'in a group',
};

export const QUEST_CATEGORY_META: Record<QuestCategory, { label: string; icon: LucideIcon; tone: ChipTone }> = {
  'nature-observation': { label: 'Nature observation', icon: TreePine, tone: 'forest' },
  walking: { label: 'Walking and movement', icon: Footprints, tone: 'sage' },
  photography: { label: 'Photography and creativity', icon: Camera, tone: 'ember' },
  gardening: { label: 'Gardening and environmental care', icon: Sprout, tone: 'sage' },
  kindness: { label: 'Neighbourhood kindness', icon: Hand, tone: 'cream' },
  social: { label: 'Social and group activities', icon: Users, tone: 'cream' },
};

export const QUEST_CATEGORY_IDS = Object.keys(QUEST_CATEGORY_META) as QuestCategory[];
