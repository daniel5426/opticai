import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IconBrandWhatsapp, IconCheck, IconAlertCircle, IconLoader2, IconExternalLink, IconLock, IconInfoCircle } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

interface WhatsAppTabProps {
  formData: {
    id?: number;
    whatsapp_access_token?: string;
    whatsapp_phone_number_id?: string;
    whatsapp_business_account_id?: string;
    whatsapp_verify_token?: string;
  };
  onChange: (field: string, value: string) => void;
}

export function WhatsAppTab({ formData, onChange }: WhatsAppTabProps) {
  const [connecting, setConnecting] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(false)

  const isConnected = !!(formData.whatsapp_access_token && formData.whatsapp_phone_number_id)

  useEffect(() => {
    // Load Facebook SDK
    const fbAppId = (import.meta as any).env?.VITE_FB_APP_ID || '1177651030438171' // Fallback or defined in env

    if (!window.FB) {
      window.fbAsyncInit = function() {
        window.FB.init({
          appId: fbAppId,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        setSdkLoaded(true)
      };

      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s) as HTMLScriptElement; js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode?.insertBefore(js, fjs);
      }(document, 'script', 'facebook-jssdk'));
    } else {
      setSdkLoaded(true)
    }
  }, [])

  const handleConnect = () => {
    if (!window.FB) {
      toast.error("Facebook SDK לא נטען עדיין. נסה שוב בעוד רגע.")
      return
    }

    setConnecting(true)

    window.FB.login((response: any) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken
        
        // Call backend to handle the automated onboarding
        if (formData.id) {
          apiClient.connectWhatsApp(formData.id, accessToken)
            .then((res: any) => {
              if (res.data && res.data.status === 'success') {
                toast.success("WhatsApp חובק בהצלחה!")
                // Trigger a refresh of the company data in parent
                onChange('whatsapp_access_token', 'connected') // Temporary marker
                window.location.reload() // Simplest way to refresh the whole state
              } else {
                toast.error(res.error || "חיבור נכשל")
              }
            })
            .catch(err => {
              toast.error("שגיאה בתקשורת עם השרת")
              console.error(err)
            })
            .finally(() => {
              setConnecting(false)
            })
        }
      } else {
        setConnecting(false)
        console.log('User cancelled login or did not fully authorize.')
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
      extras: {
        feature: 'whatsapp_embedded_signup'
      }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300" dir="rtl">
      <div className="flex flex-col gap-2 text-right mb-4">
        <div className="flex items-center gap-2 text-green-600">
          <h2 className="text-xl font-bold">חיבור WhatsApp</h2>
          <IconBrandWhatsapp size={28} />
        </div>
        <p className="text-muted-foreground">חבר את המרפאה שלך ל-WhatsApp Cloud API בקליק אחד</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="md:col-span-4 space-y-6">
          <Card className="shadow-lg border bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardHeader className="text-right">
              <div className="flex justify-between items-start">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl">
                  <IconBrandWhatsapp className="text-green-600 h-6 w-6" />
                </div>
                {isConnected ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 px-3">
                    <IconCheck size={14} />
                    מחובר
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 px-3">
                    לא מחובר
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-4 text-xl">Meta Embedded Signup</CardTitle>
              <CardDescription className="text-right">
                הדרך הרשמית והמהירה ביותר לחבר את המרפאה ל-WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-right pb-8">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3 justify-end">
                    <span>ללא צורך במפתחים או בהגדרות מורכבות</span>
                    <IconCheck size={16} className="text-green-500 shrink-0" />
                  </li>
                  <li className="flex items-center gap-3 justify-end">
                    <span>תהליך אימות רשמי מול Meta</span>
                    <IconCheck size={16} className="text-green-500 shrink-0" />
                  </li>
                  <li className="flex items-center gap-3 justify-end">
                    <span>שליטה מלאה על מספר הטלפון והחשבון העסקי</span>
                    <IconCheck size={16} className="text-green-500 shrink-0" />
                  </li>
                </ul>
              </div>

              <div className="flex flex-col items-center gap-4 pt-4">
                <Button 
                  onClick={handleConnect} 
                  disabled={connecting || !sdkLoaded}
                  size="lg"
                  className={`w-full max-w-sm h-12 text-lg font-bold gap-2 ${isConnected ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                  {connecting ? (
                    <IconLoader2 className="animate-spin" />
                  ) : (
                    <IconBrandWhatsapp />
                  )}
                  {isConnected ? 'חבר מספר חדש' : 'התחבר עם Meta'}
                </Button>
                
                {!sdkLoaded && (
                  <p className="text-xs text-muted-foreground animate-pulse">טוען SDK של Meta...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {isConnected && (
            <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 text-right flex flex-row-reverse items-start gap-4">
              <IconLock className="h-5 w-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <AlertTitle className="text-blue-800 dark:text-blue-400 font-bold mb-1">פרטי חיבור</AlertTitle>
                <AlertDescription className="text-blue-700/80 dark:text-blue-400/80 text-xs leading-relaxed space-y-1">
                  <div><strong>מספר טלפון מזהה:</strong> {formData.whatsapp_phone_number_id}</div>
                  <div><strong>מזהה חשבון עסקי:</strong> {formData.whatsapp_business_account_id}</div>
                  <div className="mt-2 text-[10px] opacity-70">החיבור מנוהל באופן אוטומטי על ידי Meta.</div>
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card className="border shadow-sm text-right">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-end gap-2">
                איך זה עובד?
                <IconInfoCircle size={16} className="text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-4">
              <div className="flex gap-2">
                <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">1</div>
                <p>לוחצים על הכפתור "התחבר עם Meta"</p>
              </div>
              <div className="flex gap-2">
                <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">2</div>
                <p>בוחרים או יוצרים חשבון Meta Business</p>
              </div>
              <div className="flex gap-2">
                <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">3</div>
                <p>מאמתים את מספר הטלפון ב-SMS</p>
              </div>
              <div className="flex gap-2">
                <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">4</div>
                <p>זהו! המערכת תזהה את הכל אוטומטית</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-right bg-amber-50/30 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-end gap-2 text-amber-700 dark:text-amber-500">
                שים לב
                <IconAlertCircle size={16} />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-amber-600/80 dark:text-amber-500/80">
              <p>שימוש ב-WhatsApp Cloud API עשוי להיות כרוך בתשלום ישירות ל-Meta בהתאם לנפח ההודעות וסוג השיחה.</p>
              <a 
                href="https://developers.facebook.com/docs/whatsapp/pricing" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 underline hover:text-amber-800"
              >
                למידע נוסף על תמחור Meta
                <IconExternalLink size={10} />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
