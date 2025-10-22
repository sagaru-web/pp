import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InterviewQuestion, QuestionCategory, TechnicalSolution, StructuredFeedback, InterviewPrepResult, ValidationResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert File to a Gemini-compatible FilePart object.
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const validationSchema = {
    type: Type.OBJECT,
    properties: {
        status: {
            type: Type.STRING,
            enum: ['valid', 'improvable', 'invalid'],
            description: "Categorize the input: 'valid' if it's good, 'improvable' if it's plausible but could be better, 'invalid' if it's gibberish or completely irrelevant."
        },
        reason: {
            type: Type.STRING,
            description: "If 'invalid', a brief explanation for the user. If 'improvable', a helpful suggestion for the user. If 'valid', a simple success message."
        }
    },
    required: ['status', 'reason']
};


const interviewPrepSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: {
            type: Type.STRING,
            description: "The name of the company hiring for this role, extracted from the job description. If no specific company is mentioned, this field must be null."
        },
        approachGuide: {
            type: Type.STRING,
            description: "A detailed guide on how to approach the interview process for the identified company, formatted with newline characters for paragraphs or lists. This should include tips on cultural fit, what to emphasize, and how to prepare. If no company name is found, this field must be null."
        },
        questions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: {
                        type: Type.STRING,
                        description: 'The interview question.'
                    },
                    category: {
                        type: Type.STRING,
                        enum: [QuestionCategory.HR, QuestionCategory.Technical, QuestionCategory.Behavioral],
                        description: 'The category of the question.'
                    },
                    suggestedAnswer: {
                        type: Type.STRING,
                        description: "Provide the answer from a first-person perspective (e.g., 'I believe...', 'In my previous role...'). It should sound like a human candidate is speaking directly to the interviewer. For behavioral questions, structure the answer using the STAR method. For sub-topics like 'Situation', 'Task', 'Action', 'Result', place them on their own line followed by a colon (e.g., 'Situation:'). CRITICAL: Each sub-topic MUST start on a new line using a '\\n' character. Absolutely no markdown formatting (like asterisks for bolding) should be used."
                    }
                },
                required: ['question', 'category', 'suggestedAnswer']
            }
        }
    },
    required: ['companyName', 'approachGuide', 'questions']
};


const technicalSolutionSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: {
            type: Type.STRING,
            description: "A clear, step-by-step explanation of the solution, including the approach, any relevant algorithms or data structures, and an analysis of the time and space complexity. No markdown formatting should be used."
        },
        code: {
            type: Type.STRING,
            description: "The complete, runnable, and production-quality code solution in the specified language. The code should be optimal, adhering to industry best practices, and include comments for complex logic. This field MUST ONLY contain valid, runnable code. All explanatory text, notes, or introductions must be in the 'explanation' field."
        }
    },
    required: ['explanation', 'code']
};

const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        clarity: {
            type: Type.INTEGER,
            description: "A rating from 1 to 5 on the clarity and conciseness of the answer."
        },
        structure: {
            type: Type.INTEGER,
            description: "A rating from 1 to 5 on the logical structure of the answer (e.g., use of STAR method)."
        },
        relevance: {
            type: Type.INTEGER,
            description: "A rating from 1 to 5 on how relevant the answer is to the question and the job role."
        },
        overallImpression: {
            type: Type.STRING,
            description: "A brief, one-paragraph summary of the overall impression of the answer. Start with positive reinforcement."
        },
        improvementPoints: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING
            },
            description: "A list of 2-3 specific, actionable bullet points for improvement. No markdown formatting."
        },
        followUpQuestion: {
            type: Type.STRING,
            description: "Based on the candidate's answer, create a logical and challenging follow-up question an interviewer might ask. This should probe deeper into their experience or test their critical thinking."
        }
    },
    required: ['clarity', 'structure', 'relevance', 'overallImpression', 'improvementPoints']
};


const parseAndValidateJSON = <T>(responseText: string, schemaKeys: (keyof T)[]): T => {
    try {
        const jsonText = responseText.trim();
        // Handle cases where the AI might return an empty string or non-JSON content
        if (!jsonText || !jsonText.startsWith('{') && !jsonText.startsWith('[')) {
             throw new Error("AI returned non-JSON response.");
        }
        const parsedData = JSON.parse(jsonText);

        for (const key of schemaKeys) {
            if (parsedData[key] === undefined) {
                // Allow followUpQuestion to be optional
                if (String(key) === 'followUpQuestion') continue;
                throw new Error(`Invalid data structure from AI: missing key "${String(key)}".`);
            }
        }
        return parsedData as T;
    } catch (e: any) {
        console.error("JSON parsing or validation failed:", e.message, "Raw Response:", responseText);
        throw new Error("The AI returned a response in an unexpected format. Please try again.");
    }
};

export const validateJobInput = async (jobRole: string, jobDescription: string): Promise<ValidationResult> => {
    const systemInstruction = `You are an expert career coach acting as a helpful assistant. Your goal is to ensure the user provides reasonable input for interview preparation. You must be collaborative and lenient, understanding that job roles often overlap.
1.  **Assess Plausibility & Relevance:**
    - **'valid':** The description is plausible and relevant to the role. This is the default status for any reasonable input. **Roles with natural overlaps are considered VALID.**
        - Example 1: Role='Frontend Developer', Description='UI/UX designer'. This is VALID because design is a core part of frontend work.
        - Example 2: Role='Backend Developer', Description='tester'. This is VALID because backend developers are often involved in testing.
        - The 'reason' for a valid status should be a simple success message like "Input is valid."
    - **'improvable':** Use this status ONLY if the input is extremely brief and generic, but still related. The goal is to gently nudge the user to provide more detail if possible, without blocking them.
        - Example: Role='Software Engineer', Description='coding'. This is technically correct but not very descriptive. A good 'reason' would be a suggestion like "This is a good start! Adding more details about specific technologies or projects could lead to even better questions. Do you wish to continue?"
    - **'invalid':** This status is ONLY for complete gibberish (e.g., 'asdfghjkl') or descriptions that are completely and obviously unrelated to the job role (e.g., Role='Software Engineer', Description='baking cakes').
2.  **Provide a Verdict:** Respond with a JSON object containing 'status' ('valid', 'improvable', or 'invalid') and a concise, user-friendly 'reason'. Your tone should always be encouraging.`;

    const prompt = `
        Job Role: "${jobRole}"
        Job Description: "${jobDescription}"

        Please assess this input and respond in the required JSON format.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: validationSchema,
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const parsed = JSON.parse(response.text.trim());
        if (!['valid', 'improvable', 'invalid'].includes(parsed.status) || typeof parsed.reason !== 'string') {
             throw new Error("AI returned an invalid validation structure.");
        }
        return parsed;

    } catch (error) {
        console.error("Error validating job input:", error);
        return { status: 'valid', reason: "Validation check failed, proceeding anyway." };
    }
};


export const generateInterviewQuestions = async (jobRole: string, jobDescription: string, experienceLevel: string, companyName: string): Promise<InterviewPrepResult> => {
    const systemInstruction = `You are an AI role-playing as an expert career coach and a top-tier candidate for the provided job role. Your task is to provide a comprehensive interview preparation package tailored for a candidate with ${experienceLevel} of experience.
1. A company name is provided: '${companyName || 'unspecified'}'. If a specific name is given, all your advice MUST be tailored to that company. Use it to generate the "Approach Guide". The 'companyName' field in your response must match the provided name.
2. If the provided company name is empty or 'unspecified', you may attempt to extract one from the job description. If you find one, use it for the guide and the 'companyName' field.
3. If no company can be determined from either the input or the description, the 'companyName' and 'approachGuide' fields in your response MUST be null.
4. Generate a list of 10 relevant interview questions and provide high-quality, first-person answers as if you were that top-tier candidate. The tone should be confident and professional. Adhere strictly to the JSON schema and do not use markdown.`;

    const prompt = `
        Job Role: ${jobRole}
        Company Name: ${companyName || 'Not specified'}
        Experience Level: ${experienceLevel}
        Job Description:
        ---
        ${jobDescription}
        ---
        Please generate the full interview preparation package based on this information.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: interviewPrepSchema,
                temperature: 0.7,
            },
        });
        
        return parseAndValidateJSON<InterviewPrepResult>(response.text, ['questions', 'companyName', 'approachGuide']);

    } catch (error) {
        console.error("Error generating interview questions:", error);
        throw new Error("Could not generate interview questions. This could be due to a network issue or a content safety filter on your input. Please check your job description for sensitive terms or try again later.");
    }
};

export const generateTechnicalSolution = async (
    problem: string,
    language: string,
    level: string,
    file?: File | null
): Promise<TechnicalSolution> => {
    
    const systemInstruction = `You are a world-class software engineer and expert problem solver, equivalent to a principal engineer at a top tech company. Your task is to provide an optimal and production-quality solution to the given technical problem, specifically tailored for a developer with a ${level.toUpperCase()} skill level. You must provide a step-by-step explanation and the complete, runnable code in the specified language. If a file is provided, analyze its contents as part of the problem description.

- The 'code' field must contain ONLY pure, runnable code.
- All explanations, including complexity analysis, must be in the 'explanation' field.
- Adhere strictly to the JSON schema provided.`;

    const textPrompt = `
        Programming Language: ${language}
        Skill Level: ${level}
        Problem Description:
        ---
        ${problem}
        ---
        Please provide a detailed explanation and the complete code solution tailored for this skill level.
    `;

    const content: {parts: any[]} = { parts: [{ text: textPrompt }] };
    if (file) {
        const filePart = await fileToGenerativePart(file);
        content.parts.unshift(filePart);
    }
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: content,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: technicalSolutionSchema,
                temperature: 0.3,
            }
        });
        return parseAndValidateJSON<TechnicalSolution>(response.text, ['explanation', 'code']);
    } catch (error) {
        console.error("Error generating technical solution:", error);
        throw new Error("The AI failed to generate a solution. Your request might have been blocked for safety reasons, or there could be a temporary network issue. Please review your problem description and try again.");
    }
};

export const transcribeAudio = async (audioFile: File): Promise<string> => {
    try {
        const audioPart = await fileToGenerativePart(audioFile);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    audioPart,
                    { text: "Transcribe this audio recording of a person answering an interview question. Provide only the text of their answer, without any introductory phrases like 'The user said:'." }
                ]
            },
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("Failed to transcribe your audio. The file might be in an unsupported format, or the AI service may be temporarily unavailable. Please try again.");
    }
};

export const generateAnswerFeedback = async (question: string, answer: string, jobRole: string): Promise<StructuredFeedback> => {
    const systemInstruction = `You are an expert career coach and interviewer for the role of '${jobRole}'. Your task is to provide structured, constructive feedback on a candidate's answer to an interview question. Analyze the answer based on clarity, structure (e.g., STAR method), and relevance to the role. Provide ratings from 1-5, actionable improvement points, and a relevant follow-up question in the required JSON format.`;
    
    const prompt = `
        Interview Question: "${question}"
        
        Candidate's Answer: "${answer}"
        
        Please provide your structured feedback on this answer.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: feedbackSchema,
                temperature: 0.6,
            }
        });
        return parseAndValidateJSON<StructuredFeedback>(response.text, ['clarity', 'structure', 'relevance', 'overallImpression', 'improvementPoints', 'followUpQuestion']);
    } catch (error) {
        console.error("Error generating structured answer feedback:", error);
        throw new Error("Failed to generate feedback for your answer. There might be a temporary issue with the AI service. Please try again.");
    }
};

export const textToSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Read this interview question clearly and professionally: "${text}"` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A calm, professional voice
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate audio for the question.");
    }
};