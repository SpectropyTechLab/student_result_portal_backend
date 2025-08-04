import express from 'express';
import cors from 'cors';
import router from './routes/Routes.js'; // ✅ Updated path and import name
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use('/upload', router); // Endpoint stays the same

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
