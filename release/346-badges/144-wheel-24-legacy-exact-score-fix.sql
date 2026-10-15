-- Keep the legacy exact-score helper aligned with the retargeted
-- challenge badges. All original requirements are preserved in
-- crilo_wheel_20261014.badges for audit / rollback.
update public.badges b
set requirement=jsonb_set(b.requirement,'{score}',
to_jsonb((b.requirement->'rule'->>'target')::bigint),true)
where b.badge_key like 'v2_funny_score_%'
and b.requirement->'rule'->>'rule'='hit_exact'
and b.requirement->>'score' is distinct from b.requirement->'rule'->>'target';
do $check$ declare mismatches int;begin
select count(*) into mismatches from public.badges b where b.badge_key like 'v2_funny_score_%'
and (b.requirement->>'score')::bigint<>(b.requirement->'rule'->>'target')::bigint;
if mismatches>0 then raise exception 'Unconverted legacy funny score requirements: %',mismatches;end if;
end $check$;