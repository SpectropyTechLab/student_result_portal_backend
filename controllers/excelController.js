import fs from 'fs';
import xlsx from 'xlsx';
import { supabase } from '../config/supabaseClient.js';

export async function WholeclassResults(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const {
    schoolId,
    academicYear,
    program,
    examName,
    examFormat,
    classValue
  } = req.body;

  if (!schoolId || !academicYear || !program || !examName || !examFormat || !classValue) {
    return res.status(400).json({ error: 'Missing required fields in form data' });
  }

  try {
    // ✅ Step 1: Read Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (data.length === 0) return res.status(400).json({ error: 'No data found in the file' });

    const headerRow = data[0];
    const headerKeys = Object.keys(headerRow);

    const findSubjectIndex = (subject) => {
      for (let key of headerKeys) {
        const val = key?.toString().trim().toLowerCase();
        if (val === subject.toLowerCase()) return key;
      }
      return null;
    };

    const physicsCol = findSubjectIndex("Physics");
    const chemistryCol = findSubjectIndex("Chemistry");
    const mathsCol = findSubjectIndex("Maths");
    const biologyCol = findSubjectIndex("Biology");

    const excelData = data;

    // ✅ Step 2: Map Data
    const refinedData = excelData.map(entry => {
      const correct = parseInt(entry["Correct Answers"] ?? 0);
      const incorrect = parseInt(entry["Incorrect Answers"] ?? 0);
      const unattempted = parseInt(entry["Not attempted"] ?? 0);
      const total_marks = parseInt(entry["Total Marks"] ?? 0);
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
        academic_year: academicYear,
        program,
        exam_name: examName,
        exam_format: examFormat,
        class_name: classValue,

        exam: entry["Exam"] ?? null,
        examset: entry["Exam Set"] ?? null,
        roll_no: entry["Roll No"] !== null ? parseInt(entry["Roll No"]) : null,
        name: entry["Name"] ?? null,
        total_marks,
        paper_marks,
        grade,
        // ⛔️ No rank from Excel
        physics: physicsCol && entry[physicsCol] !== null ? parseFloat(entry[physicsCol]) : null,
        chemistry: chemistryCol && entry[chemistryCol] !== null ? parseFloat(entry[chemistryCol]) : null,
        maths: mathsCol && entry[mathsCol] !== null ? parseFloat(entry[mathsCol]) : null,
        biology: biologyCol && entry[biologyCol] !== null ? parseFloat(entry[biologyCol]) : null,
        school_id: parseInt(schoolId)
      };
    });

    // ✅ Step 3: Upsert to Supabase
    const { error: upsertError } = await supabase
      .from('results')
      .upsert(refinedData, {
        onConflict: ['school_id', 'exam_name', 'class_name', 'roll_no']
      });

    fs.unlinkSync(req.file.path); // 🧹 cleanup uploaded file

    if (upsertError) {
      return res.status(500).json({ error: upsertError.message });
    }

    // ✅ Step 4: Call Supabase Function to Recalculate Rank
    const { error: rpcError } = await supabase.rpc('recalculate_rank', {
      input_school_id: parseInt(schoolId),
      input_class_name: classValue,
      input_exam_name: examName,
      input_program: program,
      input_exam_format: examFormat,
      input_academic_year: academicYear
    });

    if (rpcError) {
      return res.status(500).json({ error: 'Upserted but failed to recalculate rank', details: rpcError.message });
    }

    // ✅ Final Response
    res.json({ status: 'Success', inserted_or_updated: refinedData.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
}
