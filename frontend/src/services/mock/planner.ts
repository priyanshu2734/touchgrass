/**
 * MOCK PLANNER. A small rule-based matcher that runs in the browser so the
 * planner UI can be built and tested before the backend exists.
 * It is NOT an AI model and plans from it are labelled as samples.
 */
import {
  ACCESSIBILITY_LABEL,
  BUDGET_LABEL,
  COMPANY_LABEL,
  ENERGY_LABEL,
  INTEREST_META,
} from '../../data/options';
import { MOCK_ACTIVITIES } from '../../data/activities';
import type { Activity, ActivityPlan, BackupOption, Budget, Energy, PlanPreferences } from '../../types';
import { formatDuration } from '../../utils/format';

const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 };
const BUDGET_RANK: Record<Budget, number> = { free: 0, low: 1, flexible: 2 };

function meetsHardLimits(activity: Activity, prefs: PlanPreferences): boolean {
  return (
    activity.minutes <= prefs.minutes &&
    BUDGET_RANK[activity.budget] <= BUDGET_RANK[prefs.budget] &&
    ENERGY_RANK[activity.energy] <= ENERGY_RANK[prefs.energy] &&
    prefs.accessibility.every((need) => activity.accessibility.includes(need))
  );
}

function score(activity: Activity, prefs: PlanPreferences): number {
  const overlap = activity.interests.filter((interest) => prefs.interests.includes(interest)).length;
  const companyBonus = activity.company.includes(prefs.company) ? 2 : 0;
  const timeFit = activity.minutes / prefs.minutes;
  return overlap * 3 + companyBonus + timeFit * 2;
}

function rank(prefs: PlanPreferences, catalogue: Activity[]): Activity[] {
  return catalogue
    .filter((activity) => meetsHardLimits(activity, prefs))
    .sort((a, b) => score(b, prefs) - score(a, prefs));
}

const WINDOW_BACKUP: BackupOption = {
  title: 'Window and doorway sky watch',
  summary: 'If conditions change, open a window or stand in a doorway for five minutes and watch the sky or street.',
  durationMinutes: 5,
};

export function buildMockPlan(prefs: PlanPreferences, catalogue: Activity[] = MOCK_ACTIVITIES): ActivityPlan {
  const ranked = rank(prefs, catalogue);
  const primary = ranked[0];
  if (!primary) {
    throw new Error('No sample activities are available for these preferences.');
  }

  const backupActivity = ranked.find((a) => a.id !== primary.id && a.minutes <= primary.minutes);
  const backup: BackupOption = backupActivity
    ? {
        title: backupActivity.title,
        summary: backupActivity.summary,
        durationMinutes: backupActivity.minutes,
      }
    : WINDOW_BACKUP;

  const interestNames = prefs.interests.map((interest) => INTEREST_META[interest].label.toLowerCase()).join(', ');
  const reason = `Matched on ${formatDuration(prefs.minutes)} available, ${BUDGET_LABEL[prefs.budget].toLowerCase()}, ${ENERGY_LABEL[
    prefs.energy
  ].toLowerCase()}, ${COMPANY_LABEL[prefs.company]}${interestNames ? ` and interest in ${interestNames}` : ''}.`;

  const id = `plan-${Date.now().toString(36)}`;
  const extras: string[] = ['Phone on silent or in a pocket', 'Look outside and check the forecast. Switch to the backup if you need to'];
  if (prefs.company !== 'solo') extras.unshift('Tell everyone the plan and a meeting point');

  const checklist = [...primary.checklist, ...extras].map((label, index) => ({
    id: `${id}-${index}`,
    label,
  }));

  const accessibilityNotes = prefs.accessibility.length
    ? `This sample only considered activities tagged for ${prefs.accessibility
        .map((need) => ACCESSIBILITY_LABEL[need])
        .join(', ')}. Tags are general, so check the actual route and place yourself before you go.`
    : undefined;

  return {
    id,
    title: primary.title,
    summary: primary.summary,
    reason,
    durationMinutes: primary.minutes,
    estimatedCost: primary.cost,
    checklist,
    tips: primary.tips,
    backup,
    accessibilityNotes,
    generatedAt: new Date().toISOString(),
    source: 'mock',
  };
}
