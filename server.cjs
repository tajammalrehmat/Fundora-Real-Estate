var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Headers, *");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/send-otp", async (req, res) => {
    const { toEmail, toName, otpCode } = req.body;
    if (!toEmail || !otpCode) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: toEmail and otpCode are required."
      });
    }
    const resendApiKey = (process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || "").trim();
    const resendFromEmail = (process.env.RESEND_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || "fundora.one@gmail.com").trim();
    if (!resendApiKey) {
      console.error("Resend API key is not configured in .env on the server.");
      return res.status(500).json({
        success: false,
        error: "Resend API Key is not configured on the server. Please add your RESEND_API_KEY in the environment variables settings."
      });
    }
    try {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Fundora OTP</title>
</head>

<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 0 10px rgba(0,0,0,.08);">

<tr>
<td style="background:#0d6efd;color:#ffffff;padding:20px;text-align:center;font-size:26px;font-weight:bold;">
Fundora
</td>
</tr>

<tr>
<td style="padding:35px;">

<h2 style="margin-top:0;color:#222;">
Verify Your Email
</h2>

<p style="font-size:16px;color:#555;">
Hello ${toName || "Investor"},
</p>

<p style="font-size:16px;color:#555;line-height:26px;">
Use the verification code below to complete your registration.
</p>

<div style="margin:35px 0;text-align:center;">

<div style="
display:inline-block;
background:#0d6efd;
color:#fff;
padding:18px 35px;
font-size:34px;
font-weight:bold;
letter-spacing:8px;
border-radius:8px;">
${otpCode}
</div>

</div>

<p style="font-size:15px;color:#777;">
This code will expire in <strong>10 minutes</strong>.
</p>

<p style="font-size:15px;color:#777;">
If you didn't request this verification, simply ignore this email.
</p>

<hr>

<p style="font-size:13px;color:#999;text-align:center;">
\xA9 2026 Fundora. All rights reserved.
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
      console.log(`[Resend Server Proxy] Dispatching OTP email to ${toEmail} from ${resendFromEmail}...`);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `Fundora <${resendFromEmail}>`,
          to: [toEmail],
          subject: "Your Fundora Verification Code",
          html: htmlContent
        })
      });
      if (response.ok) {
        const responseData = await response.json();
        console.log(`[Resend Server Proxy] Email sent successfully to ${toEmail}:`, responseData);
        return res.json({ success: true, data: responseData });
      } else {
        const errorText = await response.text();
        console.error(`[Resend Server Proxy] Resend API failed:`, errorText);
        return res.status(response.status).json({
          success: false,
          error: errorText || "Resend API failed to accept the email."
        });
      }
    } catch (error) {
      console.error("[Resend Server Proxy] Network/Server exception:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An exception occurred during server-side email dispatch."
      });
    }
  });
  app.post("/api/analyze-receipt", async (req, res) => {
    const { base64Data, mimeType, apiKey: clientBodyKey } = req.body;
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: base64Data is required."
      });
    }
    try {
      const headerKey = req.headers["x-gemini-key"];
      let apiKey = clientBodyKey || headerKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
      const isKeyValid = (key) => {
        if (!key) return false;
        const clean = key.trim();
        return clean.startsWith("AIzaSy") && clean.length > 20;
      };
      if (!isKeyValid(apiKey)) {
        apiKey = void 0;
      }
      if (!apiKey) {
        console.warn("[Receipt Analyzer] No valid GEMINI_API_KEY detected in env or request.");
        return res.status(400).json({
          success: false,
          error: "No valid Gemini API Key available for receipt OCR parsing."
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      let cleanBase64 = base64Data;
      let detectedMimeType = mimeType || "image/jpeg";
      if (base64Data.startsWith("data:")) {
        const parts = base64Data.split(";base64,");
        if (parts.length === 2) {
          detectedMimeType = parts[0].replace("data:", "").split(";")[0];
          cleanBase64 = parts[1];
        }
      }
      console.log(`[Receipt Analyzer] Triggering Gemini 2.5 Flash for receipt parsing, size: ~${Math.round(cleanBase64.length / 1024)} KB, mime: ${detectedMimeType}...`);
      const imagePart = {
        inlineData: {
          mimeType: detectedMimeType,
          data: cleanBase64
        }
      };
      const promptPart = {
        text: "You are an expert AI payment auditor. Carefully analyze this image of a cryptocurrency payment receipt, deposit confirmation, transfer invoice, or order screenshot (such as Quotex, Binance, OKX, Bybit, Trust Wallet, MetaMask, Bitnbox, KuCoin, etc.).\n\nIdentify and extract these EXACT fields from the screenshot:\n1. 'amount': The exact numerical transfer, deposit, or payment amount in USDT or USD. Look for labels like 'Total amount', 'Amount', 'Net Amount', 'Transferred', 'Paid', 'Payment', 'Total', 'Sum', 'Value'. Look at all numbers next to 'USDT', 'USD', '$', or payment amount labels (e.g. if the screenshot shows '12 USDT' or 'Total amount 12 USDT', return 12). Only return the clean pure number as a float/integer, without currency symbols or text.\n2. 'txid': The transaction hash, transaction ID, Order ID, Deposit ID, Ref No, or Reference Code (e.g. '124119776', 'TX...', '0x...'). Look for labels like 'Order ID', 'Deposit ID', 'Quotex Deposit ID', 'TxID', 'TxHash', 'Transaction ID', 'Ref No', 'Reference Number', 'Hash', 'ID'. Extract the clean ID string without prefixes or labels.\n3. 'network': The matching transfer network (e.g. 'TRC20', 'BEP20', 'BSC', 'TRX'). Default to 'TRC20' if not specified.\n\nFormat the output STRICTLY as JSON matching the schema."
      };
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts: [imagePart, promptPart] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                txid: {
                  type: import_genai.Type.STRING,
                  description: "The transaction hash, Order ID, Deposit ID, or TxID from the screenshot."
                },
                amount: {
                  type: import_genai.Type.NUMBER,
                  description: "The transfer/payment amount parsed strictly as a number."
                },
                network: {
                  type: import_genai.Type.STRING,
                  description: "The blockchain network ('TRC20' or 'BEP20')."
                }
              },
              required: ["txid", "amount", "network"]
            }
          }
        });
      } catch (primaryErr) {
        console.warn("[Receipt Analyzer] gemini-2.5-flash call failed, trying gemini-1.5-flash fallback:", primaryErr?.message || primaryErr);
        response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: { parts: [imagePart, promptPart] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                txid: {
                  type: import_genai.Type.STRING,
                  description: "The transaction hash, Order ID, Deposit ID, or TxID from the screenshot."
                },
                amount: {
                  type: import_genai.Type.NUMBER,
                  description: "The transfer/payment amount parsed strictly as a number."
                },
                network: {
                  type: import_genai.Type.STRING,
                  description: "The blockchain network ('TRC20' or 'BEP20')."
                }
              },
              required: ["txid", "amount", "network"]
            }
          }
        });
      }
      const responseText = response.text || "{}";
      console.log(`[Receipt Analyzer] Gemini Raw Response:`, responseText);
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      }
      const parsedData = JSON.parse(cleanedResponse);
      return res.json({
        success: true,
        data: parsedData
      });
    } catch (error) {
      console.error("[Receipt Analyzer] Error parsing receipt screenshot:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to parse receipt screenshot with AI."
      });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/join", (req, res) => {
    const ref = req.query.ref || "";
    const redirectUrl = ref ? `/#/register?ref=${ref}` : "/#/register";
    console.log(`[Redirect] /join path accessed. Redirecting to ${redirectUrl}`);
    res.redirect(redirectUrl);
  });
  app.get("/register", (req, res) => {
    const ref = req.query.ref || "";
    const redirectUrl = ref ? `/#/register?ref=${ref}` : "/#/register";
    console.log(`[Redirect] /register path accessed. Redirecting to ${redirectUrl}`);
    res.redirect(redirectUrl);
  });
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start the Express proxy server:", err);
});
//# sourceMappingURL=server.cjs.map
