
import { supabase } from '@/integrations/supabase/client';

export const setupVectorSearch = async () => {
  try {
    // Call the edge function to create the match_documents function
    const { data, error } = await supabase.functions.invoke('create-match-function');
    
    if (error) {
      console.error('Error setting up vector search:', error);
      return false;
    }
    
    console.log('Vector search function created successfully');
    return true;
  } catch (error) {
    console.error('Failed to setup vector search:', error);
    return false;
  }
};
