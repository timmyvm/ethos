-- 0014: pin the entitlement guard's search_path (Supabase advisor 0011).
--
-- guard_profile_entitlement (0012, 0013) reads only NEW, OLD and
-- current_user, never a table by name, so an empty search_path changes
-- nothing it does and leaves nothing for a caller's path to redirect.

alter function public.guard_profile_entitlement() set search_path = '';
