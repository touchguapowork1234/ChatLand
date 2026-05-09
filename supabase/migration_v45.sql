-- Allow admins to delete premium codes and item codes

CREATE POLICY "Admins can delete premium_codes"
ON premium_codes FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can delete item_codes"
ON item_codes FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
