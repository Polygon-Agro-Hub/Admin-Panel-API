const express = require("express");
const GoviLinkEp = require("../end-point/GoviLink-ep");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = require("../middlewares/uploadMiddleware");
const router = express.Router();

router.post(
  "/save-officer-service",
  authMiddleware,
  GoviLinkEp.saveOfficerService
);

router.put(
  "/update-officer-service/:id",
  authMiddleware,
  GoviLinkEp.updateOfficerService
);

router.get(
  "/get-officer-service-by-id/:id",
  authMiddleware,
  GoviLinkEp.getOfficerServiceById
);

router.get(
  "/get-all-officer-service",
  authMiddleware,
  GoviLinkEp.getAllOfficerServices
);

router.delete(
  "/officer-service/:id",
  authMiddleware,
  GoviLinkEp.deleteOfficerService
);

// Get all govi link jobs
router.get(
  "/get-all-govi-link-jobs",
  authMiddleware,
  GoviLinkEp.getAllGoviLinkJobs
);

// Get officers by job role
router.get(
  "/get-officers-by-jobrole",
  authMiddleware,
  GoviLinkEp.getOfficersByJobRole
);

// Assign officer to job
router.post(
  "/assign-officer-to-job",
  authMiddleware,
  GoviLinkEp.assignOfficerToJob
);

// Get job details by ID
router.get(
  "/get-job-basic-details/:jobId",
  authMiddleware,
  GoviLinkEp.getJobBasicDetailsById
);

router.get(
  "/get-field-audit-history",
  authMiddleware,
  GoviLinkEp.getFieldAuditDetails
);


router.get(
  "/get-complain-details/:id",
  authMiddleware,
  GoviLinkEp.getFieldOfficerComplainById
);

 router.put(
  '/reply-field-officer-complain/:id', 
  authMiddleware, 
  GoviLinkEp.replyFieldOfficerComplain
);


module.exports = router;
