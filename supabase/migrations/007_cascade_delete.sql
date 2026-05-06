-- Add ON DELETE CASCADE to scores and streaks so that deleting a user
-- automatically removes all their related rows.
ALTER TABLE public.scores
  DROP CONSTRAINT scores_user_id_fkey,
  ADD CONSTRAINT scores_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.streaks
  DROP CONSTRAINT streaks_user_id_fkey,
  ADD CONSTRAINT streaks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
