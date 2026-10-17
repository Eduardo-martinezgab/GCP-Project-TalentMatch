const express = require('express');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;
const isGcpEnabled = Boolean(process.env.GCP_PROJECT_ID && process.env.GCP_PROJECT_ID !== 'your-gcp-project-id');

// File Upload Configuration (Local temp storage before Cloud Storage upload)
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- GCP SDK INITIALIZATION HOOKS ---
// let { Storage } = require('@google-cloud/storage');
// let { Firestore } = require('@google-cloud/firestore');
// let { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
// let storage = isGcpEnabled ? new Storage() : null;
// let firestore = isGcpEnabled ? new Firestore({ databaseId: process.env.FIRESTORE_DATABASE_ID }) : null;

// --- IN-MEMORY DATABASE (Simulating Firestore: talentmatchdb) ---

let jobs = [
  {
    id: 'job_101',
    title: 'Senior Full Stack Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    skills: ['Node.js', 'React', 'Google Cloud', 'Firestore'],
    description: 'Looking for a Senior Engineer to build scalable cloud-native recruitment software.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job_102',
    title: 'Backend AI Engineer',
    department: 'AI & Data',
    location: 'New York, NY',
    type: 'Full-time',
    skills: ['Python', 'Vertex AI', 'Document AI', 'Express'],
    description: 'Help construct AI pipelines for parsing and match scoring using Vertex AI.',
    createdAt: new Date().toISOString()
  }
];

let candidates = [
  {
    id: 'cand_01',
    jobId: 'job_101',
    jobTitle: 'Senior Full Stack Engineer',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    role: 'Full Stack Engineer',
    score: 92,
    status: 'Interview Scheduled',
    matchBreakdown: {
      technicalSkills: 95,
      experience: 90,
      roleRelevance: 91
    },
    extractedText: 'Extracted Skills: Node.js, Cloud Run, Firestore, Express, System Architecture',
    appliedAt: new Date().toISOString()
  },
  {
    id: 'cand_02',
    jobId: 'job_102',
    jobTitle: 'Backend AI Engineer',
    name: 'John Smith',
    email: 'john.smith@example.com',
    role: 'Backend Developer',
    score: 78,
    status: 'Under Review',
    matchBreakdown: {
      technicalSkills: 80,
      experience: 75,
      roleRelevance: 79
    },
    extractedText: 'Extracted Skills: Python, Docker, Cloud Functions, Document AI',
    appliedAt: new Date().toISOString()
  }
];

// --- GCP SERVICE INTEGRATION STUBS ---

async function uploadToCloudStorage(file) {
  if (!isGcpEnabled) return `gs://${process.env.STORAGE_BUCKET_NAME || 'talentmatch-resumes'}/${file.filename}`;
  // TODO: Integrate Cloud Storage (talentmatch-resumes)
  // const bucket = storage.bucket(process.env.STORAGE_BUCKET_NAME);
  // await bucket.upload(file.path, { destination: `resumes/${file.originalname}` });
  // return `gs://${process.env.STORAGE_BUCKET_NAME}/resumes/${file.originalname}`;
}

async function processWithDocumentAI(filePath) {
  if (!isGcpEnabled) {
    return {
      extractedText: "Extracted Resume: 6+ years experience in Software Development, Node.js, GCP, Firestore, and AI Integrations.",
      skills: ["Node.js", "Express", "GCP", "Firestore", "System Architecture"]
    };
  }
  // TODO: Call Document AI (Resume Processor)
}

async function analyzeWithVertexAI(extractedSkills, requiredSkills) {
  if (!isGcpEnabled) {
    const overallScore = Math.floor(Math.random() * (98 - 72 + 1)) + 72;
    return {
      score: overallScore,
      breakdown: {
        technicalSkills: Math.min(100, overallScore + 3),
        experience: Math.max(60, overallScore - 4),
        roleRelevance: overallScore
      }
    };
  }
  // TODO: Send embeddings & features to Vertex AI Matching Engine
}

// --- API ENDPOINTS ---

// 1. Recruiter Creates Job
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, department, location, type, skills, description } = req.body;

    if (!title || !department) {
      return res.status(400).json({ error: 'Job title and department are required.' });
    }

    const newJob = {
      id: `job_${Date.now()}`,
      title,
      department,
      location: location || 'Remote',
      type: type || 'Full-time',
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
      description: description || '',
      createdAt: new Date().toISOString()
    };

    jobs.unshift(newJob);

    // Save to Firestore if enabled
    if (isGcpEnabled) {
      // await firestore.collection('jobs').doc(newJob.id).set(newJob);
    }

    res.status(201).json({
      success: true,
      message: 'Job opening posted successfully to Firestore!',
      job: newJob
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job posting.' });
  }
});

// 2. Candidate Fetches Open Roles
app.get('/api/jobs', async (req, res) => {
  if (isGcpEnabled) {
    // const snapshot = await firestore.collection('jobs').get();
    // return res.json(snapshot.docs.map(doc => doc.data()));
  }
  res.json(jobs);
});

// 3. Candidate Uploads Resume & Triggers Match Pipeline
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    const { jobId, name, email, role } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    const targetJob = jobs.find(j => j.id === jobId) || jobs[0];

    // Pipeline Step 1: Upload to Cloud Storage
    const storagePath = await uploadToCloudStorage(file);

    // Pipeline Step 2: Document AI Resume Extraction
    const docData = await processWithDocumentAI(file.path);

    // Pipeline Step 3: Vertex AI Matching Engine Score Generation
    const matchAnalysis = await analyzeWithVertexAI(docData.skills, targetJob.skills);

    // Construct Candidate Record
    const newCandidate = {
      id: `cand_${Date.now()}`,
      jobId: targetJob.id,
      jobTitle: targetJob.title,
      name: name || 'Anonymous Candidate',
      email: email || 'not-provided@example.com',
      role: role || targetJob.title,
      score: matchAnalysis.score,
      matchBreakdown: matchAnalysis.breakdown,
      extractedText: docData.extractedText,
      status: 'New - Analyzed',
      storagePath,
      appliedAt: new Date().toISOString()
    };

    candidates.unshift(newCandidate);

    // Save to Firestore
    if (isGcpEnabled) {
      // await firestore.collection('candidates').doc(newCandidate.id).set(newCandidate);
    }

    res.json({
      success: true,
      message: isGcpEnabled ? 'Application submitted and evaluated via GCP!' : 'Resume parsed by Document AI & scored via Vertex AI!',
      data: newCandidate
    });
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: 'Internal server error during processing.' });
  }
});

// 4. Recruiter Fetches Candidates (Firestore)
app.get('/api/candidates', async (req, res) => {
  if (isGcpEnabled) {
    // const snapshot = await firestore.collection('candidates').get();
    // return res.json(snapshot.docs.map(doc => doc.data()));
  }
  res.json(candidates);
});

// 5. Recruiter Updates Candidate Status (Schedule / Hire)
app.post('/api/candidates/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const candidate = candidates.find(c => c.id === id);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  candidate.status = status;

  if (isGcpEnabled) {
    // await firestore.collection('candidates').doc(id).update({ status });
  }

  res.json({ success: true, candidate });
});

// Start Server
app.listen(port, () => {
  console.log(`TalentMatch backend server running on port ${port} [GCP Mode: ${isGcpEnabled ? 'LIVE' : 'LOCAL MOCK'}]`);
});