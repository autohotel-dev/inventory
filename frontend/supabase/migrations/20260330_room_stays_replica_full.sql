-- Habilitar REPLICA IDENTITY FULL en room_stays
-- Esto asegura que los eventos UPDATE de Supabase Realtime incluyan todos los campos en payload.old,
-- lo que corrige el bug de notificaciones duplicadas en el frontend (ej: "Vehículo registrado") 
-- que se disparaban erróneamente en cada actualización parcial de la tabla.

ALTER TABLE room_stays REPLICA IDENTITY FULL;
