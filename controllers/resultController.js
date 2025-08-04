import fs from 'fs';
import xlsx from 'xlsx';
import { supabase } from '../config/supabaseClient.js';

export async function uploadExcel(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // console.log("Upload content :",req.body);

  const { schoolName } = req.body;
  console.log("school name: ", schoolName);
  if (!schoolName) return res.status(400).json({ error: 'School name missing' });

  try {
    // Step 1: Get or create school_id
    let { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('name', schoolName)
      .single();

      console.log("school id: ",schoolData.id);

    if (!schoolData) {
      const { data: newSchool, error: insertError } = await supabase
        .from('schools')
        .insert([{ name: schoolName }])
        .select()
        .single();

      if (insertError) return res.status(500).json({ error: insertError.message });
      schoolData = newSchool;
    }

    const school_id = schoolData.id;

    // Step 2: Parse Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (data.length === 0) return res.status(400).json({ error: 'No data found in the file' });

    const excelData = data.slice(1); // skip header

    // Step 3: Map student data
    const refinedData = excelData.map(entry => {
      const correct = entry["7"] !== null ? parseInt(entry["7"]) : 0;
      const incorrect = entry["8"] !== null ? parseInt(entry["8"]) : 0;
      const unattempted = entry["9"] !== null ? parseInt(entry["9"]) : 0;
      const total_marks = entry["4"] !== null ? parseInt(entry["4"]) : 0;
      const paper_marks = (correct + incorrect + unattempted) * 4;
      const percentage = paper_marks > 0 ? (total_marks / paper_marks) * 100 : 0;

      let grade = null;
      if (percentage >= 90) grade = "A+";
      else if (percentage >= 80) grade = "A";
      else if (percentage >= 70) grade = "B+";
      else if (percentage >= 60) grade = "B";
      else if (percentage >= 50) grade = "C";
      else if (percentage >= 35) grade = "D";
      else grade = "F";

      return {
        exam: entry["0"],
        examset: entry["1"] ?? null,
        roll_no: entry["2"] !== null ? parseInt(entry["2"]) : null,
        name: entry["3"],
        total_marks,
        paper_marks,
        grade,
        rank: parseInt(entry["6"]) ?? null,
        physics: entry["14"] !== null ? parseFloat(entry["14"]) : null,
        chemistry: entry["22"] !== null ? parseFloat(entry["22"]) : null,
        maths: entry["30"] !== null ? parseFloat(entry["30"]) : null,
        biology: entry["38"] !== null ? parseFloat(entry["38"]) : null,
        school_id
      };
    });

    const { error: insertError } = await supabase.from('student_results').insert(refinedData);
    fs.unlinkSync(req.file.path);

    if (insertError) return res.status(500).json({ error: insertError.message });

    const { error: updateError } = await supabase.rpc('assign_student_ranks');
    if (updateError) return res.status(500).json({ error: updateError.message });

    res.json({ status: 'Success', inserted: refinedData.length, rank_assigned: true });
  } catch (err) {
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
}
