-- A driving school can have male and female instructors: gender 'both'. It is found whichever the learner asks for, and
-- the learner's choice is kept on the booking (details.want) so the school sends the right instructor.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.set_instructor_setup'::regproc);
  if position('''both''' in d) = 0 then
    if position('in (''male'',''female'',''none'')' in d) = 0 then raise exception 'setup: gender list not found'; end if;
    d := replace(d, 'in (''male'',''female'',''none'')', 'in (''male'',''female'',''both'',''none'')'); execute d;
  end if;
  d := pg_get_functiondef('public.find_instructors'::regproc);
  if position('''both''' in d) = 0 then
    if position('q.inst->>''gender'' = p_gender)' in d) = 0 then raise exception 'find: gender test not found'; end if;
    d := replace(d, 'q.inst->>''gender'' = p_gender)', 'q.inst->>''gender'' in (p_gender, ''both''))'); execute d;
  end if;
  d := pg_get_functiondef('public.book_lesson'::regproc);
  if position('''want''' in d) = 0 then
    if position('''mode'', mode, ''pack'', pk.id,' in d) = 0 or position('case when pk.id is not null then '' Part of: ''' in d) = 0 then raise exception 'book: places not found'; end if;
    d := replace(d, '''mode'', mode, ''pack'', pk.id,', '''mode'', mode, ''want'', case when p->>''want'' in (''male'',''female'') then p->>''want'' else null end, ''pack'', pk.id,');
    d := replace(d, 'case when pk.id is not null then '' Part of: ''', 'case when inst->>''gender'' = ''both'' and p->>''want'' in (''male'',''female'') then '' The learner asked for a '' || (p->>''want'') || '' instructor.'' else '''' end ||' || E'\n    ' || 'case when pk.id is not null then '' Part of: ''');
    execute d;
  end if;
  d := pg_get_functiondef('public.instructor_diary'::regproc);
  if position('''want''' in d) = 0 then
    d := replace(d, '''pack'', b.details->>''pack_title'',', '''pack'', b.details->>''pack_title'', ''want'', b.details->>''want'','); execute d;
  end if;
end $$;
