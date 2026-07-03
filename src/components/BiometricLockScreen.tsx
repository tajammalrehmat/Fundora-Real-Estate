import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, Unlock, KeyRound } from 'lucide-react';
import { UserAccount } from '../types';

interface BiometricLockScreenProps {
  activeUser: UserAccount;
  onUnlock: () => void;
  onLogout: () => void;
  addSystemLog: (action: string, details: string, status: 'Secure' | 'Alarm' | 'Info') => void;
}

export default function BiometricLockScreen({ activeUser, onUnlock, onLogout, addSystemLog }: BiometricLockScreenProps) {
  const [lockStep, setLockStep] = useState<'locked' | 'scanning' | 'success' | 'error'>('locked');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSimulatedSandbox, setIsSimulatedSandbox] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);

  // We ONLY fall back to simulated credentials if the application is running inside an iframe 
  // (e.g. the AI Studio developer preview window), where browser permissions policies strictly block 
  // real WebAuthn and throw SecurityError/NotAllowedError instantly.
  const isIframeContext = typeof window !== "undefined" && window.self !== window.top;

  useEffect(() => {
    if (isIframeContext) {
      console.log("Iframe detected (AI Studio sandbox). Initiating interactive secure biometric sandbox authentication...");
      setIsSimulatedSandbox(true);
    } else {
      setIsSimulatedSandbox(false);
      // Automatically trigger real biometric prompt on mount if outside iframe
      triggerRealBiometric();
    }
  }, []);

  // Handle simulated fingerprint hold progress
  useEffect(() => {
    let timer: any;
    if (isSimulatedSandbox && isPressed && lockStep === 'scanning') {
      timer = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setLockStep('success');
            addSystemLog('Login_Success', `App unlocked via Secure Sandbox Touch Verification for ${activeUser.email}`, 'Secure');
            
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }

            setTimeout(() => {
              onUnlock();
            }, 1000);
            return 100;
          }
          if (prev % 20 === 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(15);
          }
          return prev + 5;
        });
      }, 50);
    } else if (isSimulatedSandbox && !isPressed && scanProgress < 100) {
      timer = setInterval(() => {
        setScanProgress(prev => {
          if (prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return Math.max(0, prev - 10);
        });
      }, 50);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSimulatedSandbox, isPressed, lockStep]);

  const triggerRealBiometric = async () => {
    setErrorMsg('');
    setLockStep('scanning');

    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric WebAuthn authentication is not supported on this browser.");
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const pubKeyStr = activeUser.webAuthnPublicKey || '';
      const credIdStr = activeUser.webAuthnCredentialId || '';
      let allowCredsId: Uint8Array;

      if (pubKeyStr) {
        try {
          const binaryString = atob(pubKeyStr);
          allowCredsId = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            allowCredsId[i] = binaryString.charCodeAt(i);
          }
        } catch (e) {
          allowCredsId = new TextEncoder().encode(credIdStr);
        }
      } else {
        // Fallback with base64url decoding
        try {
          const base64 = credIdStr.replace(/-/g, '+').replace(/_/g, '/');
          const binaryString = atob(base64);
          allowCredsId = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            allowCredsId[i] = binaryString.charCodeAt(i);
          }
        } catch (e) {
          allowCredsId = new TextEncoder().encode(credIdStr);
        }
      }

      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          rpId: window.location.hostname || "localhost",
          userVerification: "required",
          allowCredentials: [{
            id: allowCredsId,
            type: 'public-key'
          }]
        }
      };

      const assertion = await navigator.credentials.get(options);
      if (assertion) {
        addSystemLog('Login_Success', `Biometric app unlock approved for ${activeUser.email}`, 'Secure');
        setLockStep('success');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
        setTimeout(() => {
          onUnlock();
        }, 1000);
      } else {
        throw new Error("No credential was returned by the device.");
      }
    } catch (err: any) {
      console.warn("Real WebAuthn verification failed on Lock Screen:", err);
      setLockStep('error');
      const isCancelled = err.name === "NotAllowedError" || err.message?.toLowerCase().includes("cancel") || err.message?.toLowerCase().includes("abort");
      const readableError = isCancelled 
        ? "Verification cancelled." 
        : (err.message || err.name || "Unknown verification error");
      setErrorMsg("Verification failed: " + readableError);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#030514] flex flex-col items-center justify-between p-6 sm:p-12 text-white overflow-y-auto">
      {/* Top design accent */}
      <div className="absolute top-0 inset-x-0 h-[200px] bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>

      {/* Brand Header */}
      <div className="w-full max-w-md text-center py-4 relative z-10">
        <h2 className="text-xl font-sans font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 uppercase">
          Fundora
        </h2>
        <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Real Estate Investment</p>
      </div>

      {/* Main content box */}
      <div className="w-full max-w-md bg-gradient-to-br from-[#0a0d24] via-[#11163b] to-[#060817] border border-indigo-500/20 rounded-3xl p-8 text-center space-y-8 shadow-2xl relative overflow-hidden z-10">
        {/* Glowing background bubble */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none animate-pulse"></div>

        <div className="space-y-3">
          <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
            {lockStep === 'success' ? (
              <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : (
              <Lock className="w-8 h-8 text-indigo-400" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-sans font-bold text-white">App Locked</h3>
            <p className="text-xs text-indigo-300 leading-relaxed">
              Verify biometric signature to unlock session for <strong className="text-white">{activeUser.name || activeUser.email}</strong>
            </p>
          </div>
        </div>

        {/* Biometric Trigger Area */}
        <div className="py-4">
          {isSimulatedSandbox ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider font-bold block">SI-SANDBOX ACTIVE</span>
                <p className="text-[10px] text-indigo-200/90 leading-normal max-w-[280px] mx-auto">
                  Please <strong className="text-emerald-400">press and hold</strong> the fingerprint sensor below to simulate device biometric check.
                </p>
              </div>

              <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                {/* SVG progress circle */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-indigo-950/40"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className={`transition-colors duration-150 ${isPressed ? 'text-emerald-400' : 'text-indigo-400'}`}
                    strokeWidth="3.5"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - scanProgress / 100)}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                  />
                </svg>

                <button
                  type="button"
                  onMouseDown={() => {
                    setIsPressed(true);
                    setLockStep('scanning');
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                  }}
                  onMouseUp={() => setIsPressed(false)}
                  onMouseLeave={() => setIsPressed(false)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setIsPressed(true);
                    setLockStep('scanning');
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsPressed(false);
                  }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg outline-none select-none ${
                    isPressed 
                      ? 'bg-emerald-500/25 border border-emerald-400 scale-95 shadow-emerald-400/20 text-emerald-400' 
                      : 'bg-indigo-950/50 border border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-950/70 scale-100 shadow-indigo-500/10 text-indigo-300'
                  }`}
                >
                  <Fingerprint className={`w-10 h-10 ${isPressed ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-mono font-bold">
                  {isPressed ? (
                    <span className="text-emerald-400 animate-pulse">SCANNING SENSOR: {scanProgress}%</span>
                  ) : (
                    <span className="text-indigo-300">TOUCH & HOLD TO UNLOCK</span>
                  )}
                </div>
                <div className="w-48 mx-auto bg-slate-950 rounded-full h-1 border border-indigo-500/10 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-100 ${isPressed ? 'bg-emerald-400' : 'bg-indigo-400'}`} 
                    style={{ width: `${scanProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={triggerRealBiometric}
                className="mx-auto w-24 h-24 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-full flex items-center justify-center text-indigo-400 hover:text-white transition-all duration-300 shadow-lg cursor-pointer group active:scale-95"
              >
                <Fingerprint className={`w-12 h-12 transition-transform duration-300 group-hover:scale-110 ${lockStep === 'scanning' ? 'animate-pulse text-indigo-300' : ''}`} />
              </button>

              <div className="space-y-1">
                <p className="text-xs text-indigo-300 font-mono">
                  {lockStep === 'scanning' ? 'Verifying with biometric sensor...' : 'Tap scanner to unlock'}
                </p>
                {lockStep === 'error' && (
                  <p className="text-[11px] text-rose-400 max-w-xs mx-auto font-sans leading-relaxed">{errorMsg}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alternate login options */}
        <div className="space-y-3 pt-2 border-t border-indigo-500/10">
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 bg-[#050716] hover:bg-slate-900 border border-slate-800/80 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-wider animate-none"
          >
            <KeyRound className="w-4 h-4" />
            Use Password / Another Account
          </button>
        </div>
      </div>

      {/* Bottom Footer Accent */}
      <div className="text-center py-4 relative z-10 text-[10px] text-slate-600 font-mono">
        SECURE BIOMETRIC SANDBOX CLIENT v2.4 • SHA256 PROTECTED
      </div>
    </div>
  );
}
