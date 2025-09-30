const express = require('express');
const GoviLinkEp = require('../end-point/GoviLink-ep');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = require("../middlewares/uploadMiddleware");


const router = express.Router();

// router.delete('/delete-news/:id', 
//     authMiddleware, 
//     GoviLinkEp.deleteNews
// );




module.exports = router;