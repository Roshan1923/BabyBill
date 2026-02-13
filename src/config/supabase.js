import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://jebizjtpvjowumixhczl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYml6anRwdmpvd3VtaXhoY3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDQ1MjUsImV4cCI6MjA4NjE4MDUyNX0.HBiArKVevlpU90d8VCuzceLJM1U1JI-53kGD8TMj9O4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);