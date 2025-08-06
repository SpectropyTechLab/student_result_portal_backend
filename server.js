import express from 'express';
import cors from 'cors';
import routes from './routes/Routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // For parsing JSON bodies
app.use('/upload', routes); // Base path

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
