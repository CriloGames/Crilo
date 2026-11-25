insert into ascent_game.direct_connection_facts(clue,word,reason)
select v.clue,v.word,v.reason from (values
('test','doctor','Doctors order and interpret medical tests.'),
('medical test','doctor','Doctors order and interpret medical tests.'),
('blood test','doctor','Doctors order blood tests to investigate health conditions.'),
('diagnostic test','doctor','Doctors use diagnostic tests to investigate symptoms.'),
('lab test','doctor','Doctors order and interpret laboratory tests.'),
('test results','doctor','Doctors interpret test results when diagnosing conditions.'),
('test','physician','Physicians order and interpret medical tests.'),
('medical test','physician','Physicians order and interpret medical tests.')
) v(clue,word,reason)
where not exists(select 1 from ascent_game.rejected_associations r where (r.clue=v.clue and r.word=v.word) or (r.word=v.clue and r.clue=v.word))
on conflict(clue,word) do update set reason=excluded.reason;
