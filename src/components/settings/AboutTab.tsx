import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { IconDownload, IconRefresh, IconCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';

export function AboutTab() {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    loadCurrentVersion();
    checkForUpdates();
  }, []);

  const loadCurrentVersion = async () => {
    try {
      const version = await window.electronAPI.getAppVersion();
      setCurrentVersion(version);
    } catch (error) {
      console.error('Error getting app version:', error);
      setCurrentVersion('Unknown');
    }
  };

  const checkForUpdates = async (manual: boolean = false) => {
    try {
      setChecking(true);
      if (manual) {
        toast.info('בודק עדכונים...');
      }

      const result = await window.electronAPI.checkForUpdates();
      setLastChecked(new Date());

      if (result.currentVersion) {
        setCurrentVersion(result.currentVersion);
      }

      if (result.available && result.version) {
        setUpdateAvailable(true);
        setLatestVersion(result.version);
        if (manual) {
          toast.success(`נמצאה גרסה חדשה: ${result.version}`);
        }
      } else {
        setUpdateAvailable(false);
        setLatestVersion(null);
        if (manual) {
          if (result.message) {
            toast.info(result.message);
          } else {
            toast.success('הגרסה שלך היא העדכנית ביותר');
          }
        }
      }

      if (result.error && manual) {
        toast.error(`שגיאה בבדיקת עדכונים: ${result.error}`);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      if (manual) {
        toast.error('שגיאה בבדיקת עדכונים');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      setDownloading(true);
      toast.info('מוריד עדכון...');

      const result = await window.electronAPI.downloadUpdate();

      if (result.success) {
        toast.success('העדכון הורד בהצלחה! לוחץ על "התקן עדכון" כדי להתקין');
      } else {
        toast.error(`שגיאה בהורדת עדכון: ${result.error}`);
      }
    } catch (error) {
      console.error('Error downloading update:', error);
      toast.error('שגיאה בהורדת עדכון');
    } finally {
      setDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      toast.info('מתקין עדכון... האפליקציה תאותחל מחדש');
      await window.electronAPI.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
      toast.error('שגיאה בהתקנת עדכון');
    }
  };

  return (
    <Card className="shadow-md border-none">
      <CardHeader>
        <CardTitle className="text-right flex items-center gap-2 justify-end">
          <IconInfoCircle className="h-5 w-5" />
          אודות האפליקציה
        </CardTitle>
        <p className="text-sm text-muted-foreground text-right">מידע על הגרסה הנוכחית ועדכונים זמינים</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Version Section */}
          <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border">
            <div className="flex items-center gap-3">
              {!updateAvailable ? (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <IconCheck className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <IconAlertCircle className="h-5 w-5" />
                </div>
              )}
              <div className="text-left">
                <div className="text-sm text-muted-foreground">
                  {!updateAvailable ? 'מעודכן' : 'עדכון זמין'}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-semibold text-lg">Prysm</div>
              <div className="text-sm text-muted-foreground">
                גרסה נוכחית: <span className="font-mono">{currentVersion || 'טוען...'}</span>
              </div>
              {updateAvailable && latestVersion && (
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  גרסה חדשה: <span className="font-mono font-semibold">{latestVersion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Update Available Section */}
          {updateAvailable && latestVersion && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3 text-right flex items-center gap-2 justify-end">
                <IconAlertCircle className="h-4 w-4" />
                עדכון חדש זמין
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 text-right mb-4" dir="rtl">
                גרסה {latestVersion} זמינה להורדה. מומלץ לעדכן לגרסה האחרונה כדי ליהנות מתכונות חדשות ותיקוני באגים.
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={handleInstallUpdate}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  התקן עכשיו
                </Button>
                <Button
                  onClick={handleDownloadUpdate}
                  disabled={downloading}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      מוריד...
                    </>
                  ) : (
                    <>
                      <IconDownload className="h-4 w-4" />
                      הורד עדכון
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Check for Updates Section */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Button
              onClick={() => checkForUpdates(true)}
              disabled={checking}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {checking ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  בודק...
                </>
              ) : (
                <>
                  <IconRefresh className="h-4 w-4" />
                  בדוק עדכונים
                </>
              )}
            </Button>
            
            <div className="text-right">
              <div className="text-sm font-medium">בדיקת עדכונים</div>
              {lastChecked && (
                <div className="text-xs text-muted-foreground">
                  נבדק לאחרונה: {lastChecked.toLocaleTimeString('he-IL', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              )}
            </div>
          </div>


          {/* App Information */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-right">פרטי האפליקציה</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span className="font-mono">{currentVersion}</span>
                <span>גרסה:</span>
              </div>
              <div className="flex justify-between">
                <span>Prysm</span>
                <span>שם:</span>
              </div>
              <div className="flex justify-between">
                <span>מערכת ניהול לאופטיקאים</span>
                <span>תיאור:</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono">{new Date().getFullYear()}</span>
                <span>© זכויות יוצרים:</span>
              </div>
            </div>
          </div>

          {/* Release Notes Link */}
          <div className="p-4 border rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-2">
              רוצה לראות מה חדש?
            </div>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                // Open GitHub releases page
                window.open('https://github.com/daniel5426/opticai/releases', '_blank');
              }}
              className="text-blue-600 dark:text-blue-400"
            >
              הצג הערות שחרור
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

