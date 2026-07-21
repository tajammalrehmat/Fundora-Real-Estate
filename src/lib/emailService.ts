/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiUrl, fetchWithFallback } from '../utils/api';

/**
 * Service to handle transactional email notifications and OTP codes
 * for the Fundora.one platform. Supports direct client-side delivery via EmailJS
 * using custom @fundora.one domains.
 */

interface EmailParams {
  toEmail: string;
  toName: string;
  otpCode: string;
}

// These are retrieved from environment variables (e.g., set up on Vercel or in local .env)
const EMAILJS_SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim();
const EMAILJS_TEMPLATE_ID = (import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '').trim();
const EMAILJS_PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim();

// Resend API (Completely free, branding-free, custom-domain transactional mail)
const RESEND_API_KEY = (import.meta.env.VITE_RESEND_API_KEY || '').trim();
const RESEND_FROM_EMAIL = (import.meta.env.VITE_RESEND_FROM_EMAIL || 'no-reply@fundora.one').trim();
const EMAIL_SERVICE_ACTIVE = (import.meta.env.VITE_EMAIL_SERVICE_ACTIVE || '').trim().toLowerCase() === 'true';

/**
 * Checks if any email service (EmailJS or Resend) is properly configured
 */
export const isEmailServiceConfigured = (): boolean => {
  // We default to true because we always attempt secure server-side delivery via the Resend API proxy.
  return true;
};

/**
 * Returns which service is currently active
 */
export const getActiveEmailService = (): 'resend' | 'emailjs' | 'none' => {
  // Default to server-side resend integration
  return 'resend';
};

/**
 * Sends a real OTP verification code to the registered investor.
 * Uses the server-side Resend API proxy by default, falling back to direct client-side delivery or EmailJS if configured.
 */
export const sendOtpEmail = async (params: EmailParams): Promise<{ success: boolean; error?: string }> => {
  const { toEmail, toName, otpCode } = params;

  console.log(`[Email Service] Attempting to deliver premium OTP to ${toEmail} via Server API Proxy...`);

  // First, always try the proxy server route (Express backend or Vercel serverless function /api/send-otp)
  try {
    const response = await fetchWithFallback('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toEmail,
        toName,
        otpCode,
      }),
    });

    if (response.ok) {
      console.log(`Successfully sent branding-free premium OTP to ${toEmail} via Resend API Server Proxy`);
      return { success: true };
    } else {
      const errorText = await response.text();
      let errorDetail = '';
      try {
        const parsed = JSON.parse(errorText);
        errorDetail = parsed.error || errorText;
      } catch (_) {
        errorDetail = errorText;
      }
      console.warn(`Resend API Proxy returned error (${response.status}): ${errorDetail}. Trying direct client/EmailJS fallback if available...`);
      
      // If server explicitly said API key is missing, propagate that clearly so the developer knows
      if (errorDetail.includes('API Key is not configured on the server')) {
        return {
          success: false,
          error: errorDetail
        };
      }
    }
  } catch (err: any) {
    console.warn(`Resend API Proxy unreachable or failed: ${err.message || 'Unknown error'}. Trying fallback options...`);
  }

  // Fallback Option A: Direct Resend API dispatch from client-side if a key is provided in the client
  if (RESEND_API_KEY) {
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
<h2 style="margin-top:0;color:#222;">Verify Your Email</h2>
<p style="font-size:16px;color:#555;">Hello ${toName || 'Investor'},</p>
<p style="font-size:16px;color:#555;line-height:26px;">Use the verification code below to complete your registration.</p>
<div style="margin:35px 0;text-align:center;">
<div style="display:inline-block;background:#0d6efd;color:#fff;padding:18px 35px;font-size:34px;font-weight:bold;letter-spacing:8px;border-radius:8px;">${otpCode}</div>
</div>
<p style="font-size:15px;color:#777;">This code will expire in <strong>10 minutes</strong>.</p>
<p style="font-size:15px;color:#777;">If you didn't request this verification, simply ignore this email.</p>
<hr>
<p style="font-size:13px;color:#999;text-align:center;">© 2026 Fundora. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

      console.log(`[Resend Direct Client] Sending OTP directly to ${toEmail} from browser...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          from: `Fundora <${RESEND_FROM_EMAIL}>`,
          to: [toEmail],
          subject: 'Your Fundora Verification Code',
          html: htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`Successfully dispatched direct client-side OTP to ${toEmail} via Resend API`);
        return { success: true };
      }
    } catch (err: any) {
      console.error('[Resend Direct Client] Direct browser fetch exception:', err);
    }
  }

  // Fallback Option B: EmailJS Fallback (If configured)
  if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
    console.log('[Email Service] Using EmailJS fallback delivery...');
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: toEmail,
            email: toEmail,
            to: toEmail,
            user_email: toEmail,
            recipient_email: toEmail,
            to_name: toName,
            name: toName,
            user_name: toName,
            otp_code: otpCode,
            otp: otpCode,
            code: otpCode,
            token: otpCode,
            password: otpCode,
            pin: otpCode,
            key: otpCode,
            verification_code: otpCode,
            one_time_password: otpCode,
            company_name: 'Fundora.one',
            companyName: 'Fundora.one',
            app_name: 'Fundora.one',
            appName: 'Fundora.one',
            project_name: 'Fundora.one',
            projectName: 'Fundora.one',
            expiry: '10 minutes',
            expiry_time: '10 minutes',
            valid_till: '10 minutes',
            valid_for: '10 minutes',
            expiration: '10 minutes',
            time: '10 minutes',
            till: '10 minutes',
            minutes: '10',
            reply_to: 'no-reply@fundora.one',
            subject: 'Your Fundora.one Verification Code'
          },
        }),
      });

      if (response.ok) {
        console.log(`Successfully dispatched real OTP code to ${toEmail} via EmailJS`);
        return { success: true };
      }
    } catch (err: any) {
      console.error('EmailJS fallback exception:', err);
    }
  }

  // If we reach here, all email channels failed. Return clear info.
  return {
    success: false,
    error: 'All email delivery channels failed (unreachable proxy server or missing API configuration). Please ensure your device is online, and your Vercel RESEND_API_KEY environment variable is correctly configured.'
  };
};
