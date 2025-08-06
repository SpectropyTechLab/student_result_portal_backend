import fs from 'fs';
import xlsx from 'xlsx';
import { supabase } from '../config/supabaseClient.js';

export async function WholeclassResults(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const {
    schoolName,
    academicYear,
    program,
    examName,
    examFormat,
    classValue
  } = req.body;

  if (!schoolName || !academicYear || !program || !examName || !examFormat) {
    return res.status(400).json({ error: 'Missing required fields in form data' });
  }

  try {
    // Step 1: Get or create school_id
    let { data: schooldata, error: schoolError } = await supabase
      .from('schooldata')
      .select('id')
      .eq('name', schoolName)
      .single();

    if (!schooldata) {
      const { data: newSchool, error: insertError } = await supabase
        .from('schooldata')
        .insert([{ name: schoolName }])
        .select()
        .single();

      if (insertError) return res.status(500).json({ error: insertError.message });
      schooldata = newSchool;
    }

    const school_id = schooldata.id;

    // Step 2: Parse Excel
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

    const excelData = data.slice(1); // skip header

    // Step 3: Map student data
    const refinedData = excelData.map(entry => {
      const correct = entry["Correct Answers"] !== null ? parseInt(entry["Correct Answers"]) : 0;
      const incorrect = entry["Incorrect Answers"] !== null ? parseInt(entry["Incorrect Answers"]) : 0;
      const unattempted = entry["Not attempted"] !== null ? parseInt(entry["Not attempted"]) : 0;
      const total_marks = entry["Total Marks"] !== null ? parseInt(entry["Total Marks"]) : 0;
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
        program: program,
        exam_name: examName,
        exam_format: examFormat,
        class_name:classValue,
        exam: entry["Exam"] ?? null,
        examset: entry["Exam Set"] ?? null,
        roll_no: entry["Roll No"] !== null ? parseInt(entry["Roll No"]) : null,
        name: entry["Name"] ?? null,
        total_marks,
        paper_marks,
        grade,
        rank: parseInt(entry["Rank"]) ?? null,
        physics: physicsCol && entry[physicsCol] !== null ? parseFloat(entry[physicsCol]) : null,
        chemistry: chemistryCol && entry[chemistryCol] !== null ? parseFloat(entry[chemistryCol]) : null,
        maths: mathsCol && entry[mathsCol] !== null ? parseFloat(entry[mathsCol]) : null,
        biology: biologyCol && entry[biologyCol] !== null ? parseFloat(entry[biologyCol]) : null,
        school_id
      };
    });

    // Step 4: Upsert into Supabase
    const { error: upsertError } = await supabase
      .from('results')
      .upsert(refinedData, {
        onConflict: ['school_id', 'exam_name', 'class_name', 'roll_no']
      });

    fs.unlinkSync(req.file.path); // Clean up uploaded temp file

    if (upsertError) {
      return res.status(500).json({ error: upsertError.message });
    }

    res.json({ status: 'Success', inserted_or_updated: refinedData.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
}
