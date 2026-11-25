insert into ascent_game.direct_connection_facts(clue,word,reason)
select v.clue,'scaffolding',v.reason from (values
('hoist','Material hoists can be attached to scaffolding to lift supplies.'),
('building skeleton','Scaffolding provides elevated access to a building frame during construction.'),
('plaster','Workers use scaffolding to apply plaster to high walls.'),
('building site','Scaffolding provides temporary elevated working platforms on building sites.'),
('plank','Scaffold planks form the working platform.')
) v(clue,reason) where not exists(select 1 from ascent_game.rejected_associations r where (r.clue=v.clue and r.word='scaffolding') or (r.word=v.clue and r.clue='scaffolding'))
on conflict(clue,word) do nothing;
