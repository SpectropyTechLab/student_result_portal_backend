import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import { supabase } from '../uploads/supabaseClient.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/excel', upload.single('excel'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (data.length === 0) return res.status(400).json({ error: 'No data found in the file' });
        // console.log('Data to insert:', data);

        const excelData = data.slice(1);  // skip header row

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
                total_marks: total_marks, // original marks scored
                paper_marks: paper_marks, // total paper value based on number of questions
                grade: grade, // will update later
                rank: parseInt(entry["6"]) ?? null,  // will update later
                physics: entry["14"] !== null ? parseFloat(entry["14"]) : null,
                chemistry: entry["22"] !== null ? parseFloat(entry["22"]) : null,
                maths: entry["30"] !== null ? parseFloat(entry["30"]) : null,
                biology: entry["38"] !== null ? parseFloat(entry["38"]) : null
            };
        });



        const { error: insertError } = await supabase.from('student_results').insert(refinedData);
        fs.unlinkSync(req.file.path);

        if (insertError) return res.status(500).json({ error: insertError.message });

        // Assign ranks after insertion
        const { error: updateError } = await supabase.rpc('assign_student_ranks');
        if (updateError) return res.status(500).json({ error: updateError.message });

        res.json({ status: 'Success', inserted: refinedData.length, rank_assigned: true });
    } catch (err) {
        res.status(500).json({ error: 'Processing failed', details: err.message });
    }
});

export default router;
