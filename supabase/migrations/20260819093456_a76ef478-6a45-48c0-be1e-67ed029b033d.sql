CREATE POLICY "farmer_docs_read_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "farmer_docs_write_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "farmer_docs_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "farmer_docs_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);