/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sebmossplzlkfdznzsoo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYm1vc3NwbHpsa2Zkem56c29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDQ4ODQsImV4cCI6MjA4MDA4MDg4NH0.XCRDqvWTIn1CZsDZGQEYkcSTu8gK8E_ZbWEx6-jiXaM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface EburonTTSCurrent {
  id: number;
  client_id: string | null;
  source_text: string;
  source_lang_code: string | null;
  source_lang_label: string | null;
  translated_text: string | null;
  target_language: string | null;
  updated_at: string;
}
