-- Allow authenticated users (staff/admins) to modify bottle package rules
DROP POLICY IF EXISTS "Allow modifications for service role" ON bottle_package_rules;

CREATE POLICY "Allow modifications for authenticated users"
  ON bottle_package_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
