-- Crilo: award "Hello, World!" to every existing profile.
-- Safe to run more than once. Does not remove or replace earned badges.
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT p.id, b.id, now()
FROM public.profiles AS p
CROSS JOIN public.badges AS b
WHERE b.name = 'Hello, World!'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_badges AS ub
    WHERE ub.user_id = p.id AND ub.badge_id = b.id
  )
ON CONFLICT DO NOTHING;

-- Check the result:
SELECT count(*) AS profiles_with_hello_world
FROM public.user_badges ub
JOIN public.badges b ON b.id = ub.badge_id
WHERE b.name = 'Hello, World!';
