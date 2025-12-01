// const multer = require("multer");
// const path = require("path");

// // Set up memory storage engine
// const storage = multer.memoryStorage();

// // Set up file filter to allow only image files
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif/;
//   const extname = allowedTypes.test(
//     path.extname(file.originalname).toLowerCase()
//   );
//   const mimetype = allowedTypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb(new Error("Only images are allowed"));
//   }
// };

// // Initialize multer with the memory storage engine and file filter
// const upload = multer({
//   storage: multer.memoryStorage(),
//   fileFilter: function (req, file, cb) {
//     // Allowed extensions
//     const filetypes = /\.(csv|xlsx|xls)$/i;
//     const extname = filetypes.test(path.extname(file.originalname));

//     // Allowed MIME types
//     const mimetypes = [
//       "text/csv",
//       "application/vnd.ms-excel",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       "application/octet-stream",
//     ];
//     const mimetype = mimetypes.includes(file.mimetype);

//     console.log("File validation:", {
//       filename: file.originalname,
//       extname: path.extname(file.originalname),
//       mimetype: file.mimetype,
//       extValid: extname,
//       mimeValid: mimetype,
//     });

//     if (extname && mimetype) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           `Only Excel/CSV files are allowed. Detected: ${file.mimetype}`
//         )
//       );
//     }
//   },
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//   },
// });

// module.exports = upload;


const multer = require("multer");
const path = require("path");

// Set up memory storage engine
const storage = multer.memoryStorage();

// Initialize multer with the memory storage engine and file filter
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Allowed extensions for images and documents
    const imageExtensions = /jpeg|jpg|png|gif/i;
    const documentExtensions = /csv|xlsx|xls/i;

    // Get file extension
    const extname = path.extname(file.originalname).toLowerCase().replace('.', '');

    // Allowed MIME types
    const imageMimetypes = ['image/jpeg', 'image/png', 'image/gif'];
    const documentMimetypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];

    // Check if either image or document type matches
    const isImage = imageExtensions.test(extname) && imageMimetypes.includes(file.mimetype);
    const isDocument = documentExtensions.test(extname) && documentMimetypes.includes(file.mimetype);

    console.log("File validation:", {
      filename: file.originalname,
      extension: extname,
      mimetype: file.mimetype,
      isImage: isImage,
      isDocument: isDocument
    });

    if (isImage || isDocument) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, JPG, PNG, GIF) and documents (CSV, XLSX, XLS) are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for actual files
    fieldSize: 10 * 1024 * 1024, // 10MB limit for text fields (base64 strings)
  },
});

module.exports = upload;
