-- Read-only badge regression examples (no user records are created).
WITH examples AS (
 SELECT 'first_four_distinct_positive' test_name, ARRAY['duck','upgrade','num:1','double']::text[] spins, true expected
 UNION ALL SELECT 'first_four_distinct_negative', ARRAY['duck','upgrade','duck','double']::text[], false
 UNION ALL SELECT 'first_three_special_positive', ARRAY['duck','double','spins','num:1','num:1','num:1','num:1','num:1','num:1']::text[], true
 UNION ALL SELECT 'first_three_special_negative', ARRAY['duck','num:1','spins','num:1','num:1','num:1','num:1']::text[], false
),
checks AS (
 SELECT test_name, expected,
 CASE WHEN test_name LIKE 'first_four%' THEN
   (SELECT count(DISTINCT x)=4 FROM unnest(spins[1:4]) AS x)
 ELSE NOT ('num:1'=ANY(spins[1:3]) OR 'num:2'=ANY(spins[1:3]) OR 'num:3'=ANY(spins[1:3]) OR 'num:5'=ANY(spins[1:3]))
 END AS actual
 FROM examples
)
SELECT test_name, expected, actual, (actual=expected) passed FROM checks ORDER BY test_name;
