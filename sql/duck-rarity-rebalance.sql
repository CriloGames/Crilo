-- Crilo duck encounter rebalance — run once in Supabase SQL Editor.
-- Lower unlock requirements by approximately 20%, and modestly increase
-- encounter weights for less-common ducks. Existing progress is preserved.
-- This is idempotent: values are set, not repeatedly multiplied.
update public.duck_types as d
set unlock_runs=v.unlock_runs,appearance_weight=v.appearance_weight
from (values
 (1,0,1000),(2,1,550),(3,2,450),(4,4,400),(5,6,360),
 (6,8,330),(7,10,286),(8,12,264),(9,14,242),(10,17,220),
 (11,20,187),(12,24,165),(13,28,156),(14,32,138),
 (15,36,120),(16,40,108),(17,44,96),(18,48,84),
 (19,56,75),(20,64,63),(21,72,56),(22,80,50),
 (23,92,43),(24,104,36),(25,120,31),(26,140,26),
 (27,160,21),(28,184,16),(29,208,12),(30,240,7)
) as v(id,unlock_runs,appearance_weight)
where d.id=v.id;
