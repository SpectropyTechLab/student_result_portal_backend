import express from 'express';
import multer from 'multer';
import { uploadExcel } from '../controllers/resultController.js';
// import { addOrGetSchool, getAllSchools } from '../controllers/schoolController.js';

const router = express.Router();
const upload = multer({ dest: 'config/' });

// For uploading Excel file
router.post('/excel', upload.single('excel'), uploadExcel);

// // For adding/getting school by name
// router.post('/school', addOrGetSchool);

// // For getting all schools
// router.get('/schools', getAllSchools);

export default router;
