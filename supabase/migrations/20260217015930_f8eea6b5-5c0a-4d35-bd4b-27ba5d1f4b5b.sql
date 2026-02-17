CREATE POLICY "Allow public read of agent registrations"
ON public.agent_registrations
FOR SELECT
USING (true);