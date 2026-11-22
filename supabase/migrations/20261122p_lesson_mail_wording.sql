-- the instructor's "new booking" email said "Driving lesson, your vehicle": leave the vehicle off for lessons
do $$
declare d text := pg_get_functiondef('private.mail_booking'::regproc);
begin
  if position('''New job booked: '' || svc || '', '' || veh' in d) > 0 then
    d := replace(d, '''New job booked: '' || svc || '', '' || veh', '''New job booked: '' || svc || case when new.kind = ''Driving lesson'' then '''' else '', '' || veh end');
    execute d;
  end if;
end $$;
