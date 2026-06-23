const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const uploadFileToS3 = require("../middlewares/s3upload");

const router = express.Router();

router.post('/images', upload.array('files', 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log('Files received:', req.files.length);

    const uploadPromises = req.files.map((file) =>
      uploadFileToS3(file.buffer, file.originalname, 'officers/images'),
    );

    const urls = await Promise.all(uploadPromises);

    console.log('All uploads success:', urls);
    return res.status(200).json({ urls });

  } catch (error) {
    console.log('Batch upload error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;