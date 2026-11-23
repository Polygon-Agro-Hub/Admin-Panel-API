const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const bodyParser = require("body-parser");
const path = require("path");
const newsDao = require("../dao/News-dao");
const newsValidate = require("../validations/News-validation");
const fs = require("fs");
const xlsx = require("xlsx");
const deleteFromS3 = require("../middlewares/s3delete");
const uploadFileToS3 = require("../middlewares/s3upload");

exports.deleteNews = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  const { id } = req.params;

  try {
    await newsValidate.deleteNewsSchema.validateAsync({ id });

    const news = await newsDao.geNewsById(id);

    if (!news) {
      return res.status(404).json({ message: "News not found" });
    }

    const imageUrl = news.image;

    let s3Key;

    if (
      imageUrl &&
      imageUrl.startsWith(
        `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      )
    ) {
      s3Key = imageUrl.split(
        `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      )[1];
    }

    const results = await newsDao.deleteNews(id);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "News not found" });
    }

    if (s3Key) {
      try {
        await deleteFromS3(s3Key);
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
      }
    }

    console.log("News deleted successfully");
    return res.status(200).json({ message: "News deleted successfully" });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error deleting news:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting news" });
  }
};

// exports.editNews = async (req, res) => {
//   const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
//   console.log("Request URL:", fullUrl);

//   const {
//     titleEnglish,
//     titleSinhala,
//     titleTamil,
//     descriptionEnglish,
//     descriptionSinhala,
//     descriptionTamil,
//     publishDate,
//     expireDate,
//   } = req.body;
//   const { id } = req.params;

//   try {
//     console.log(req.body);

//     const news = await newsDao.geNewsById(id);
//     if (!news) {
//       return res.status(404).json({ message: "News not found" });
//     }

//     const imageUrl = news.image;
//     let s3Key;

//     if (
//       imageUrl &&
//       imageUrl.startsWith(
//         `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
//       )
//     ) {
//       s3Key = imageUrl.split(
//         `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
//       )[1];
//     }

//     await deleteFromS3(s3Key);

//     let imageData = null;
//     if (req.file) {
//       const fileBuffer = req.file.buffer;
//       const fileName = req.file.originalname;
//       imageData = await uploadFileToS3(fileBuffer, fileName, "content/image");
//     }
//     const results = await newsDao.updateNews(
//       {
//         titleEnglish,
//         titleSinhala,
//         titleTamil,
//         descriptionEnglish,
//         descriptionSinhala,
//         descriptionTamil,
//         image: imageData,
//         publishDate,
//         expireDate,
//       },
//       id,
//     );

//     if (results.affectedRows === 0) {
//       return res.status(404).json({ message: "News not found" });
//     }

//     console.log("News updated successfully");
//     return res.status(200).json({ message: "News updated successfully" });
//   } catch (error) {
//     if (error.isJoi) {
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     console.error("Error updating news:", error);
//     return res
//       .status(500)
//       .json({ error: "An error occurred while updating news" });
//   }
// };

exports.editNews = async (req, res) => {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("Request URL:", fullUrl);

    const { titleEnglish, titleSinhala, titleTamil, descriptionEnglish, descriptionSinhala, descriptionTamil, publishDate, expireDate } = req.body;
    const { id } = req.params;

    const s3BaseUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    const getS3Key = (url) =>
        url && url.startsWith(s3BaseUrl) ? url.split(s3BaseUrl)[1] : null;

    // Never throws, so a failed cleanup can't break the request
    const safeDeleteFromS3 = async (url) => {
        const key = getS3Key(url);
        if (!key) return;
        try {
            await deleteFromS3(key);
        } catch (err) {
            console.error("S3 cleanup failed for:", key, err.message);
        }
    };

    let newImageUrl = null;

    try {
        const news = await newsDao.geNewsById(id);
        if (!news) {
            return res.status(404).json({ message: "News not found" });
        }

        const oldImageUrl = news.image;

        // 1. Upload the new image first (old image is untouched)
        if (req.file) {
            newImageUrl = await uploadFileToS3(
                req.file.buffer,
                req.file.originalname,
                "content/image"
            );
        }

        // 2. Update the database
        const results = await newsDao.updateNews(
            {
                titleEnglish,
                titleSinhala,
                titleTamil,
                descriptionEnglish,
                descriptionSinhala,
                descriptionTamil,
                image: newImageUrl, // null = keep existing image
                publishDate,
                expireDate,
            },
            id
        );

        if (results.affectedRows === 0) {
            await safeDeleteFromS3(newImageUrl); // roll back new upload
            return res.status(404).json({ message: "News not found" });
        }

        // 3. Only now delete the old image, and only if it was replaced
        if (newImageUrl && oldImageUrl && oldImageUrl !== newImageUrl) {
            await safeDeleteFromS3(oldImageUrl);
        }

        console.log("News updated successfully");
        return res.status(200).json({ message: "News updated successfully" });
    } catch (error) {
        // Roll back: remove the newly uploaded file, old image stays
        await safeDeleteFromS3(newImageUrl);

        if (error.isJoi) {
            return res.status(400).json({ error: error.details[0].message });
        }

        console.error("Error updating news:", error);
        return res.status(500).json({ error: "An error occurred while updating news" });
    }
};