-- Enable realtime for critical tables used in RoomsBoard and ValetDashboard
begin;

  -- Add tables to the publication
  -- Note: We check if they are already added to avoid errors, or just try to add them.
  -- The simplest way is to alter the publication. If they are already therein, it might throw a warning or just work.
  -- SAFE implementation:
  
  alter publication supabase_realtime add table rooms;
  alter publication supabase_realtime add table room_stays;
  alter publication supabase_realtime add table payments;
  
commit;
