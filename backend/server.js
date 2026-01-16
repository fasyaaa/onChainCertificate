import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// ================= UPLOAD FILE =================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileStream = fs.createReadStream(req.file.path);

    const formData = new FormData();
    formData.append("file", fileStream);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
        },
      }
    );

    fs.unlinkSync(req.file.path);

    res.json({ ipfsHash: response.data.IpfsHash });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPLOAD JSON =================
app.post("/upload-json", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      req.body,
      {
        headers: {
          pinata_api_key: process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
        },
      }
    );

    res.json({ ipfsHash: response.data.IpfsHash });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
