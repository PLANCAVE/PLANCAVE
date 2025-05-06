const express = require("express");
const { bucket } = require("../firebase"); // Import Firebase storage from firebase.js
const multer = require("multer");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() }); // Store files in memory

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const file = bucket.file(req.file.originalname);
  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype,
    },
  });

  stream.on("error", (err) => res.status(500).send(err));
  stream.on("finish", async () => {
    // Get public URL of the uploaded file
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    res.status(200).send({ message: "File uploaded successfully", url: publicUrl });
  });

  stream.end(req.file.buffer);
});

module.exports = router;