// backend/upload.example.js
// Example Node.js/Express endpoint for handling audio uploads
// This is a reference implementation for AF.02 Background Upload

const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Configure S3 or your storage service
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * POST /api/notes/upload
 * 
 * Handles background audio file uploads from mobile app
 * 
 * Form Data:
 *   - noteId: string (unique identifier for the note)
 *   - audio: File (the audio file to upload)
 * 
 * Response:
 *   {
 *     success: boolean,
 *     url: string (S3 URL or your storage URL),
 *     transcriptionId: string (ID for tracking transcription processing)
 *   }
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const { noteId } = req.body;
    const audioFile = req.file;

    if (!noteId || !audioFile) {
      return res.status(400).json({ error: 'Missing noteId or audio file' });
    }

    // Upload to S3 (or your storage service)
    const s3Key = `audio/${noteId}/${Date.now()}.m4a`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: audioFile.buffer,
      ContentType: audioFile.mimetype,
      ACL: 'private',
    };

    const result = await s3.upload(params).promise();

    // Optionally trigger transcription processing via serverless function
    // Example: AWS Lambda, Google Cloud Functions, etc.
    const transcriptionId = `transcription_${noteId}_${Date.now()}`;
    
    // Queue transcription job (Firebase Cloud Tasks, AWS SQS, etc.)
    // await queueTranscriptionJob(noteId, result.Location, transcriptionId);

    res.json({
      success: true,
      url: result.Location,
      transcriptionId: transcriptionId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Install dependencies:
 *    npm install express multer aws-sdk
 * 
 * 2. Set environment variables:
 *    EXPO_PUBLIC_UPLOAD_URL=https://your-backend.com/api/notes/upload
 *    AWS_ACCESS_KEY_ID=...
 *    AWS_SECRET_ACCESS_KEY=...
 *    AWS_S3_BUCKET=your-bucket-name
 * 
 * 3. Create .env file in MyExpoApp root:
 *    EXPO_PUBLIC_UPLOAD_URL=https://your-backend.com/api/notes/upload
 * 
 * 4. The mobile app will automatically:
 *    - Queue audio files when notes are saved
 *    - Upload in background using expo-background-fetch
 *    - Retry up to 3 times on failure
 *    - Continue uploads even if app is closed
 * 
 * 5. For transcription, integrate with:
 *    - Google Cloud Speech-to-Text API
 *    - AWS Transcribe
 *    - Whisper API
 *    - Other STT providers
 * 
 * 6. Optionally track custom vocabulary (AF.13):
 *    Pass customVocabulary in transcription request
 */
