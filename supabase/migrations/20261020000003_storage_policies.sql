-- ====================================================================
-- Practical Pathways CRM Private Storage Bucket & Policies
-- Supabase Storage: 'crm-private-attachments'
-- ====================================================================

-- Create private bucket for CRM files, call recordings, and lead attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-private-attachments', 'crm-private-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can only upload and read files within their organization path
-- Object path convention: {organization_id}/{contact_id}/{filename}
CREATE POLICY "Authorized users can read organization attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'crm-private-attachments' AND (
      (storage.foldername(name))[1]::uuid = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Authorized users can upload organization attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'crm-private-attachments' AND (
      (storage.foldername(name))[1]::uuid = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Only owners can delete attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'crm-private-attachments' AND (
      (storage.foldername(name))[1]::uuid = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    )
  );
