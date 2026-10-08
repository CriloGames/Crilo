-- Rename two existing wheel milestones without changing keys, conditions or awards.
-- Safe to rerun. Execute in Supabase SQL Editor.
UPDATE public.badges
SET name = 'Triple Threat'
WHERE badge_key = 'upgrade_3';

UPDATE public.badges
SET name = 'Double Trouble'
WHERE badge_key = 'double_back2';

SELECT badge_key, name FROM public.badges
WHERE badge_key IN ('upgrade_3', 'double_back2')
ORDER BY badge_key;
