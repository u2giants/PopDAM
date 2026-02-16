
-- Drop existing authenticated-only SELECT policies and replace with public read
DROP POLICY "Authenticated users can read assets" ON public.assets;
CREATE POLICY "Anyone can read assets" ON public.assets FOR SELECT USING (true);

DROP POLICY "Authenticated users can read asset_characters" ON public.asset_characters;
CREATE POLICY "Anyone can read asset_characters" ON public.asset_characters FOR SELECT USING (true);

DROP POLICY "Read characters" ON public.characters;
CREATE POLICY "Anyone can read characters" ON public.characters FOR SELECT USING (true);

DROP POLICY "Read licensors" ON public.licensors;
CREATE POLICY "Anyone can read licensors" ON public.licensors FOR SELECT USING (true);

DROP POLICY "Read properties" ON public.properties;
CREATE POLICY "Anyone can read properties" ON public.properties FOR SELECT USING (true);

DROP POLICY "Read product_categories" ON public.product_categories;
CREATE POLICY "Anyone can read product_categories" ON public.product_categories FOR SELECT USING (true);

DROP POLICY "Read product_types" ON public.product_types;
CREATE POLICY "Anyone can read product_types" ON public.product_types FOR SELECT USING (true);

DROP POLICY "Read product_subtypes" ON public.product_subtypes;
CREATE POLICY "Anyone can read product_subtypes" ON public.product_subtypes FOR SELECT USING (true);
