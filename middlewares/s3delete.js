const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

// Replace 'YOUR_ACCOUNT_ID' with your actual Cloudflare Account ID
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // Try without forcePathStyle for R2
});

/**
 * Deletes a file from Cloudflare R2 using the file URL.
 * @param {string} imageUrl - The URL of the file to delete.
 * @returns {Promise<void>}
 */

// const deleteFromS3 = async (imageUrl) => {
//   let r2Key;

//   if (imageUrl) {
//     // For your URL format: https://pub-79ee03a4a23e4dbbb70c7d799d3cb786.r2.dev/collectionofficer/image/c62686c4-986f-4a10-b6b2-a4ea073f3676.jpeg
//     // We need to extract: collectionofficer/image/c62686c4-986f-4a10-b6b2-a4ea073f3676.jpeg

//     const r2Domain = process.env.R2_ENDPOINT?.replace('https://', '') || 'pub-79ee03a4a23e4dbbb70c7d799d3cb786.r2.dev';

//     if (imageUrl.startsWith(`https://${r2Domain}/`)) {
//       r2Key = imageUrl.replace(`https://${r2Domain}/`, '');
//     } else if (imageUrl.includes('.r2.dev/')) {
//       // Extract everything after .r2.dev/
//       const parts = imageUrl.split('.r2.dev/');
//       if (parts.length > 1) {
//         r2Key = parts[1];
//       }
//     }

//     console.log(`Extracted R2 key: ${r2Key} from URL: ${imageUrl}`);
//   }

//   if (!r2Key) {
//     console.log("No R2 key could be extracted from URL, skipping deletion.");
//     return;
//   }

//   const deleteParams = {
//     Bucket: process.env.R2_BUCKET_NAME,
//     Key: r2Key,
//   };

//   console.log(`Attempting to delete from bucket: ${process.env.R2_BUCKET_NAME}, key: ${r2Key}`);

//   try {
//     // Create and send the DeleteObjectCommand
//     const command = new DeleteObjectCommand(deleteParams);
//     const result = await r2Client.send(command);
//     console.log(`Successfully deleted object from R2: ${r2Key}`, result);
//   } catch (error) {
//     console.error("Error deleting file from R2:", error);
//     console.error("Error details:", error.$response?.body?.toString());
//     throw new Error("Failed to delete file from R2");
//   }
// };

// not existing contunue process
const deleteFromS3 = async (imageUrl) => {
  let r2Key;
  
  if (imageUrl) {
    const r2Domain = process.env.R2_ENDPOINT?.replace('https://', '') || 'pub-79ee03a4a23e4dbbb70c7d799d3cb786.r2.dev';
    
    if (imageUrl.startsWith(`https://${r2Domain}/`)) {
      r2Key = imageUrl.replace(`https://${r2Domain}/`, '');
    } else if (imageUrl.includes('.r2.dev/')) {
      const parts = imageUrl.split('.r2.dev/');
      if (parts.length > 1) {
        r2Key = parts[1];
      }
    }
    
    console.log(`Extracted R2 key: ${r2Key} from URL: ${imageUrl}`);
  }
  
  if (!r2Key) {
    console.log("No R2 key could be extracted from URL, skipping deletion.");
    return;
  }
  
  const deleteParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: r2Key,
  };
  
  console.log(`Attempting to delete from bucket: ${process.env.R2_BUCKET_NAME}, key: ${r2Key}`);
  
  try {
    const command = new DeleteObjectCommand(deleteParams);
    const result = await r2Client.send(command);
    console.log(`Successfully deleted object from R2: ${r2Key}`, result);
  } catch (error) {
    // Don't throw error if object doesn't exist (NoSuchKey error)
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      console.log(`Object not found in R2, skipping: ${r2Key}`);
      return;
    }
    
    console.error("Error deleting file from R2:", error);
    console.error("Error details:", error.$response?.body?.toString());
    // Don't throw - just log the error and continue
    console.log("Continuing despite deletion error...");
  }
};


module.exports = deleteFromS3;