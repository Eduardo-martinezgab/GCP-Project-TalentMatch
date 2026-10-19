const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { VertexAI } = require('@google-cloud/vertexai');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const firestore = new Firestore();
const storage = new Storage();
const docAiClient = new DocumentProcessorServiceClient();

// Initialize Vertex AI
const vertexAi = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_REGION || 'us-central1',
});

// Export the function using the CloudEvents format
exports.processResume = async (cloudEvent) => {
  const fileData = cloudEvent.data;
  const bucketName = fileData.bucket;
  const fileName = fileData.name;

  console.log(`Event triggered! Processing resume: ${fileName} from bucket: ${bucketName}`);

  try {
    // 1. Download file content from Cloud Storage
    const file = storage.bucket(bucketName).file(fileName);
    const [fileBuffer] = await file.download();

    // 2. Process with Document AI
    const name = `projects/${process.env.GCP_PROJECT_ID}/locations/us/processors/${process.env.DOC_AI_PROCESSOR_ID}`;
    const docAiRequest = {
      name,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: fileData.contentType || 'application/pdf',
      },
    };

    console.log('Sending document to Document AI...');
    const [result] = await docAiClient.processDocument(docAiRequest);
    const extractedText = result.document.text;

    // 3. Generate Match Score using Vertex AI (Gemini)
    console.log('Sending extracted text to Vertex AI for scoring...');
    const generativeModel = vertexAi.getGenerativeModel({
      model: 'gemini-1.5-flash-002',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      You are an expert technical recruiter AI. 
      Evaluate the candidate resume text against general software engineering standards.
      Resume Text: ${extractedText.substring(0, 5000)} // Truncated for token limits
      
      Respond STRICTLY in JSON format:
      {
        "score": <overall score 0-100>,
        "breakdown": {
          "technicalSkills": <0-100>,
          "experience": <0-100>,
          "roleRelevance": <0-100>
        }
      }
    `;

    const aiResponse = await generativeModel.generateContent(prompt);
    const scoreData = JSON.parse(aiResponse.response.candidates[0].content.parts[0].text);

    // 4. Save Candidate Record to Firestore
    const candidateRef = firestore.collection('candidates').doc();
    await candidateRef.set({
      resumePath: `gs://${bucketName}/${fileName}`,
      extractedText: extractedText.substring(0, 500), // Save a snippet
      score: scoreData.score,
      matchBreakdown: scoreData.breakdown,
      status: 'New - Analyzed',
      createdAt: new Date().toISOString()
    });

    console.log(`Success! Candidate record ${candidateRef.id} processed and saved to Firestore.`);
  } catch (error) {
    console.error('Error processing resume pipeline:', error);
    throw error; // Throwing error ensures Cloud Functions logs it as a failure
  }
};