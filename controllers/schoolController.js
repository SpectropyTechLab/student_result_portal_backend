import { supabase } from '../config/supabaseClient.js';

export const addOrGetSchool = async (req, res) => {
  const { schoolName } = req.body;

  if (!schoolName) return res.status(400).json({ error: 'School name is required' });

  try {
    // Check if school exists
    const { data: existingSchool, error: fetchError } = await supabase
      .from('schools')
      .select('*')
      .eq('name', schoolName)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return res.status(500).json({ error: fetchError.message });
    }

    if (existingSchool) {
      return res.status(200).json({ message: 'School found', school: existingSchool });
    }

    // If not exists, insert new
    const { data: newSchool, error: insertError } = await supabase
      .from('schools')
      .insert([{ name: schoolName }])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(201).json({ message: 'New school added', school: newSchool });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};

// New endpoint to get all schools
export const getAllSchools = async (req, res) => {
  try {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ schools });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};
