import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS Headers for Vercel
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const { base64Data, mimeType } = req.body;

  if (!base64Data) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter: base64Data is required."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set on Vercel. Using simulated receipt analyzer.");
      return res.status(200).json({
        success: true,
        simulated: true,
        data: {
          txid: "TX" + Math.random().toString(16).slice(2, 10) + Date.now().toString(16) + "e880bc",
          amount: 150,
          network: "TRC20"
        },
        warning: "No GEMINI_API_KEY detected in Vercel environment variables. Returning simulated receipt data."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    let cleanBase64 = base64Data;
    let detectedMimeType = mimeType || "image/png";

    if (base64Data.startsWith("data:")) {
      const parts = base64Data.split(";base64,");
      if (parts.length === 2) {
        detectedMimeType = parts[0].replace("data:", "").split(";")[0];
        cleanBase64 = parts[1];
      }
    }

    console.log(`[Vercel Serverless] Analyzing receipt screenshot, mime: ${detectedMimeType}...`);

    const imagePart = {
      inlineData: {
        mimeType: detectedMimeType,
        data: cleanBase64
      }
    };

    const promptPart = {
      text: "You are an AI-powered payment auditor. Carefully analyze this receipt or screenshot of a crypto transfer (USDT). " +
            "Identify and extract the following fields precisely:\n" +
            "1. 'txid': The transaction hash, transaction ID, or reference code (usually a long alphanumeric/hexadecimal string like 'TX...' or '0x...'). Do NOT include words like 'TxID' or 'Transaction ID' inside the string, just the clean hash itself.\n" +
            "2. 'amount': The exact transfer or deposit amount of USDT parsed as a number. Only return the number (e.g. 150).\n" +
            "3. 'network': The matching blockchain transfer network. Look for signs of 'TRC20', 'TRX', 'Tron', 'BEP20', 'BSC', 'BNB Smart Chain'. Return either 'TRC20' or 'BEP20'. If not clearly mentioned, default to 'TRC20' if it starts with 'T', or 'BEP20' if the address starts with '0x'. If no network is found, return null.\n\n" +
            "Format the output STRICTLY as JSON matching the schema."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            txid: {
              type: Type.STRING,
              description: "The transaction hash, ID or TxID from the screenshot."
            },
            amount: {
              type: Type.NUMBER,
              description: "The transfer amount parsed as a number."
            },
            network: {
              type: Type.STRING,
              description: "The blockchain network ('TRC20' or 'BEP20')."
            }
          },
          required: ["txid", "amount", "network"]
        }
      }
    });

    const responseText = response.text || "{}";
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }
    const parsedData = JSON.parse(cleanedResponse);

    return res.status(200).json({
      success: true,
      data: parsedData
    });

  } catch (error: any) {
    console.error("[Vercel Serverless] Error parsing receipt screenshot:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred during Gemini AI screenshot analysis."
    });
  }
}
