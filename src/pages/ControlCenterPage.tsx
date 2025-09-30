import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OctahedronLoader } from "@/components/ui/octahedron-loader";
import { authService, AuthState } from "@/lib/auth/AuthService";
import { useUser } from "@/contexts/UserContext";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Building2, MapPin, Check } from "lucide-react";
import { WelcomeComponent } from "@/components/WelcomeComponent";
import { ClinicEntrance } from "@/components/ClinicEntrance";

const loginBanner = "/src/assets/images/login-banner.png";

export default function ControlCenterPage() {
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { authState } = useUser();

  // Login form
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  // Register form
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Setup wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [companyData, setCompanyData] = useState({
    name: "",
    address: "",
    phone: "",
  });
  const [clinicData, setClinicData] = useState({
    name: "",
    location: "",
    phone_number: "",
    email: "",
  });

  // UI state
  const [showWelcome, setShowWelcome] = useState(false);
  const [showClinicEntrance, setShowClinicEntrance] = useState(false);

  // Load setup data when in setup required state
  useEffect(() => {
    if (authState === AuthState.SETUP_REQUIRED) {
      loadSetupData();
    }
  }, [authState]);

  const loadSetupData = async () => {
    const setupData = await authService.getSetupData();
    if (setupData?.email) {
      setClinicData((prev) => ({ ...prev, email: setupData.email }));
    }
  };

  // ============================================================================
  // LOGIN HANDLERS
  // ============================================================================

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginForm.email || !loginForm.password) {
      toast.error("אנא מלא את כל השדות");
      return;
    }

    setLoading(true);
    try {
      const success = await authService.signInWithEmail(
        loginForm.email,
        loginForm.password,
      );

      if (!success) {
        toast.error("פרטי התחברות שגויים");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await authService.signInWithGoogle();
      // OAuth will complete in popup, reset loading after popup opens
      setLoading(false);
    } catch (error: any) {
      console.error("Google login error:", error);
      toast.error(error.message || "שגיאה בהתחברות עם Google");
      setLoading(false);
    }
  };

  // ============================================================================
  // REGISTER HANDLERS
  // ============================================================================

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !registerForm.fullName ||
      !registerForm.email ||
      !registerForm.password
    ) {
      toast.error("אנא מלא את כל השדות");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("הסיסמאות אינן תואמות");
      return;
    }

    if (registerForm.password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.signUp(
        registerForm.email,
        registerForm.password,
        registerForm.fullName,
      );

      if (!result.success) {
        if (result.error === "email_exists_but_wrong_password") {
          toast.error("האימייל כבר קיים במערכת - אנא התחבר");
        } else {
          toast.error("שגיאה ביצירת חשבון");
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SETUP WIZARD HANDLERS
  // ============================================================================

  const handleCompleteSetup = async () => {
    if (!companyData.name || !clinicData.name) {
      toast.error("אנא מלא את השדות הנדרשים");
      return;
    }

    setLoading(true);
    try {
      const success = await authService.completeSetup(companyData, clinicData);

      if (!success) {
        toast.error("שגיאה בהשלמת ההגדרה");
      }
    } catch (error) {
      console.error("Setup error:", error);
      toast.error("שגיאה בהשלמת ההגדרה");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 1) {
      // Cancel setup
      authService.signOut();
    } else {
      setCurrentStep((s) => Math.max(1, s - 1));
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (authState === AuthState.LOADING) {
    return (
      <div className="flex h-screen items-center justify-center">
        <OctahedronLoader size="3xl" />
      </div>
    );
  }

  return (
    <div
      className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10"
      dir="rtl"
      style={{ scrollbarWidth: "none" }}
    >
      <div className={cn("w-full max-w-sm md:max-w-5xl")}>
        {!showWelcome && !showClinicEntrance && (
          <div className="mb-2" dir="ltr">
            <button
              type="button"
              onClick={() => setShowWelcome(true)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>מסך פתיחה</span>
            </button>
          </div>
        )}

        {showWelcome ? (
          <WelcomeComponent
            onControlCenterClick={() => setShowWelcome(false)}
            onClinicEntranceClick={() => {
              setShowWelcome(false);
              setShowClinicEntrance(true);
            }}
          />
        ) : showClinicEntrance ? (
          <div
            className="bg-accent/50 flex h-[640px] items-center justify-center p-6 dark:bg-slate-900"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="w-full">
              <ClinicEntrance
                onBackToWelcome={() => {
                  setShowClinicEntrance(false);
                  setShowWelcome(true);
                }}
              />
            </div>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-6")}>
            <Card className="overflow-hidden p-0">
              <CardContent className="grid h-[640px] p-0 md:grid-cols-2">
                {authState === AuthState.SETUP_REQUIRED ? (
                  <SetupWizard
                    currentStep={currentStep}
                    setCurrentStep={setCurrentStep}
                    companyData={companyData}
                    setCompanyData={setCompanyData}
                    clinicData={clinicData}
                    setClinicData={setClinicData}
                    loading={loading}
                    onComplete={handleCompleteSetup}
                    onPrevious={handlePreviousStep}
                  />
                ) : isRegisterMode ? (
                  <RegisterForm
                    form={registerForm}
                    setForm={setRegisterForm}
                    loading={loading}
                    onSubmit={handleRegister}
                    onGoogleClick={handleGoogleLogin}
                    onToggleMode={() => setIsRegisterMode(false)}
                  />
                ) : (
                  <LoginForm
                    form={loginForm}
                    setForm={setLoginForm}
                    loading={loading}
                    onSubmit={handleLogin}
                    onGoogleClick={handleGoogleLogin}
                    onToggleMode={() => setIsRegisterMode(true)}
                  />
                )}
                <div className="bg-muted relative hidden md:block">
                  <img
                    src={loginBanner}
                    alt="Image"
                    className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                  />
                </div>
              </CardContent>
            </Card>
            <div className="text-muted-foreground text-center text-xs text-balance">
              בלחיצה על המשך, אתה מסכים ל־{" "}
              <a
                href="#"
                className="hover:text-primary underline underline-offset-4"
              >
                תנאי השירות
              </a>{" "}
              ו־{" "}
              <a
                href="#"
                className="hover:text-primary underline underline-offset-4"
              >
                מדיניות הפרטיות
              </a>
              .
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function LoginForm({
  form,
  setForm,
  loading,
  onSubmit,
  onGoogleClick,
  onToggleMode,
}: any) {
  return (
    <div className="flex items-center justify-center p-6 md:p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold">ברוך שובך</h1>
            <p className="text-muted-foreground text-balance">
              התחבר למרכז הבקרה
            </p>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              dir="rtl"
              placeholder="m@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((prev: any) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center">
              <Label htmlFor="password">סיסמה</Label>
              <a
                href="#"
                className="ml-auto text-sm underline-offset-2 hover:underline"
              >
                שכחת סיסמה?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              dir="rtl"
              value={form.password}
              onChange={(e) =>
                setForm((prev: any) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </div>

          <Button
            type="submit"
            className="bg-general-primary hover:bg-general-primary/80 w-full"
            disabled={loading}
          >
            {loading ? "מתחבר..." : "התחברות"}
          </Button>

          <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            <span className="bg-card text-muted-foreground relative z-10 px-2">
              או המשך עם
            </span>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={onGoogleClick}
            disabled={loading}
          >
            <GoogleIcon />
            התחבר עם Google
          </Button>

          <div className="text-center text-sm">
            אין לך חשבון?{" "}
            <button
              type="button"
              onClick={onToggleMode}
              className="underline underline-offset-4"
            >
              הירשם
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function RegisterForm({
  form,
  setForm,
  loading,
  onSubmit,
  onGoogleClick,
  onToggleMode,
}: any) {
  return (
    <form
      onSubmit={onSubmit}
      className="overflow-auto p-6 md:p-8"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">צור חשבון חדש</h1>
          <p className="text-muted-foreground text-balance">
            המשך להגדרת החברה
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="fullName">שם מלא</Label>
            <Input
              id="fullName"
              type="text"
              dir="rtl"
              value={form.fullName}
              onChange={(e) =>
                setForm((prev: any) => ({ ...prev, fullName: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="regEmail">אימייל</Label>
            <Input
              id="regEmail"
              type="email"
              dir="rtl"
              value={form.email}
              onChange={(e) =>
                setForm((prev: any) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="regPassword">סיסמה</Label>
            <Input
              id="regPassword"
              type="password"
              dir="rtl"
              value={form.password}
              onChange={(e) =>
                setForm((prev: any) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="confirmPassword">אישור סיסמה</Label>
            <Input
              id="confirmPassword"
              type="password"
              dir="rtl"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="bg-general-primary hover:bg-general-primary/80 w-full"
          disabled={loading}
        >
          {loading ? "ממשיך..." : "המשך להגדרת החברה"}
        </Button>

        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-card text-muted-foreground relative z-10 px-2">
            או המשך עם
          </span>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={onGoogleClick}
          disabled={loading}
        >
          <GoogleIcon />
          הירשם עם Google
        </Button>

        <div className="text-center text-sm">
          כבר יש לך חשבון?{" "}
          <button
            type="button"
            onClick={onToggleMode}
            className="underline underline-offset-4"
          >
            התחבר
          </button>
        </div>
      </div>
    </form>
  );
}

function SetupWizard({
  currentStep,
  setCurrentStep,
  companyData,
  setCompanyData,
  clinicData,
  setClinicData,
  loading,
  onComplete,
  onPrevious,
}: any) {
  return (
    <div className="relative h-full">
      <div
        className="overflow-auto p-6 pb-24 md:p-8"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 flex justify-center">
              <Progress value={(currentStep / 3) * 100} className="w-48" />
            </div>
            <h1 className="text-2xl font-bold">יצירת חברה</h1>
            <p className="text-muted-foreground text-balance">
              ממלאים כמה פרטים ומתחילים
            </p>
          </div>

          {currentStep === 1 && (
            <div className="grid gap-4" dir="rtl">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">פרטי החברה</h3>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="companyName">שם החברה *</Label>
                <Input
                  id="companyName"
                  value={companyData.name}
                  onChange={(e) =>
                    setCompanyData((prev: any) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  dir="rtl"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="companyAddress">כתובת החברה</Label>
                <Input
                  id="companyAddress"
                  value={companyData.address}
                  onChange={(e) =>
                    setCompanyData((prev: any) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  dir="rtl"
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="companyPhone">טלפון החברה</Label>
                <Input
                  id="companyPhone"
                  value={companyData.phone}
                  onChange={(e) =>
                    setCompanyData((prev: any) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  dir="rtl"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-4" dir="rtl">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">הגדרת מרפאה ראשונה</h3>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="clinicName">שם המרפאה *</Label>
                <Input
                  id="clinicName"
                  value={clinicData.name}
                  onChange={(e) =>
                    setClinicData((prev: any) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  dir="rtl"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="clinicLocation">מיקום המרפאה</Label>
                <Input
                  id="clinicLocation"
                  value={clinicData.location}
                  onChange={(e) =>
                    setClinicData((prev: any) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="clinicPhone">טלפון המרפאה</Label>
                  <Input
                    id="clinicPhone"
                    value={clinicData.phone_number}
                    onChange={(e) =>
                      setClinicData((prev: any) => ({
                        ...prev,
                        phone_number: e.target.value,
                      }))
                    }
                    dir="rtl"
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="clinicEmail">אימייל המרפאה</Label>
                  <Input
                    id="clinicEmail"
                    type="email"
                    value={clinicData.email}
                    onChange={(e) =>
                      setClinicData((prev: any) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid gap-4" dir="rtl">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">סיכום</h3>
              </div>
              <div className="bg-muted space-y-3 rounded-lg p-4">
                <div>
                  <h4 className="font-semibold">חברה</h4>
                  <p className="text-muted-foreground text-sm">
                    {companyData.name}
                  </p>
                  {companyData.address && (
                    <p className="text-muted-foreground text-sm">
                      {companyData.address}
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">מרפאה</h4>
                  <p className="text-muted-foreground text-sm">
                    {clinicData.name}
                  </p>
                  {clinicData.location && (
                    <p className="text-muted-foreground text-sm">
                      {clinicData.location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="bg-card/90 supports-[backdrop-filter]:bg-card/60 absolute inset-x-0 bottom-0 z-10 border-t px-6 py-3 backdrop-blur md:px-8"
        dir="ltr"
      >
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={onPrevious}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 1 ? "ביטול" : "הקודם"}
          </Button>
          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep((s: number) => Math.min(3, s + 1))}
              className="bg-general-primary hover:bg-general-primary/80 flex items-center gap-2"
            >
              הבא
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {loading ? "מגדיר..." : "סיום הגדרה"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  );
}
