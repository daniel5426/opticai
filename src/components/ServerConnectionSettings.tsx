import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Loader2, Server, Wifi, WifiOff, Search, Settings } from 'lucide-react';
import { connectionManager, ConnectionMode } from '../lib/db/connection-manager';
// import { electronServerMode } from '../lib/server-mode';

export function ServerConnectionSettings() {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local');
  const [serverUrl, setServerUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [isServerMode, setIsServerMode] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    const status = connectionManager.getConnectionStatus();
    setConnectionMode(status.mode);
    setServerUrl(status.serverUrl || '');
    
    // Temporarily disabled server mode
    setIsServerMode(false);
    setIsServerRunning(false);
  }, []);

  const handleScanForServers = async () => {
    setIsScanning(true);
    setConnectionStatus('מחפש שרתים ברשת...');
    
    try {
      const servers = await connectionManager.scanForServers();
      setDiscoveredServers(servers);
      setConnectionStatus(servers.length > 0 
        ? `נמצאו ${servers.length} שרתים` 
        : 'לא נמצאו שרתים ברשת');
    } catch (error) {
      setConnectionStatus('שגיאה בחיפוש שרתים');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectToServer = async (url: string) => {
    setIsConnecting(true);
    setConnectionStatus('מתחבר לשרת...');
    
    try {
      const success = await connectionManager.setRemoteMode(url);
      if (success) {
        setConnectionMode('remote');
        setServerUrl(url);
        setConnectionStatus('התחברות הצליחה!');
      } else {
        setConnectionStatus('התחברות נכשלה - שרת לא זמין');
      }
    } catch (error) {
      setConnectionStatus('שגיאה בהתחברות לשרת');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    connectionManager.setLocalMode();
    setConnectionMode('local');
    setServerUrl('');
    setConnectionStatus('התנתק מהשרת - עובד במצב מקומי');
  };

  const handleToggleServerMode = async () => {
    if (isServerMode) {
      try {
        await window.electronAPI.stopServerMode();
        setIsServerMode(false);
        setIsServerRunning(false);
        setConnectionStatus('השרת נעצר');
      } catch (error) {
        console.error('Error stopping server mode:', error);
        setConnectionStatus('שגיאה בעצירת השרת');
      }
    } else {
      try {
        setConnectionStatus('מתחיל שרת...');
        const success = await window.electronAPI.startServerMode();
        if (success) {
          const info = await window.electronAPI.getServerInfo();
          setIsServerMode(true);
          setIsServerRunning(true);
          setServerInfo(info);
          setConnectionStatus('השרת פועל - תחנות אחרות יכולות להתחבר');
        } else {
          setConnectionStatus('שגיאה בהפעלת השרת');
        }
      } catch (error) {
        console.error('Error starting server mode:', error);
        setConnectionStatus('שגיאה בהפעלת השרת');
      }
    }
  };

  const handleManualConnect = async () => {
    if (serverUrl.trim()) {
      await handleConnectToServer(serverUrl.trim());
    }
  };

  return (
    <div className="space-y-6" style={{scrollbarWidth: 'none'}} dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            הגדרות חיבור לשרת
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connectionMode === 'local' ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              <span>מצב נוכחי:</span>
            </div>
            <Badge variant={connectionMode === 'local' ? 'secondary' : 'default'}>
              {connectionMode === 'local' ? 'מקומי' : 'מחובר לשרת'}
            </Badge>
          </div>

          {connectionMode === 'remote' && (
            <div className="flex items-center justify-between">
              <span>שרת מחובר:</span>
              <span className="text-sm text-muted-foreground">{serverUrl}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>מצב שרת (שיתוף עם תחנות אחרות):</span>
            </div>
            <Switch dir="ltr"
              checked={isServerMode}
              onCheckedChange={handleToggleServerMode}
            />
          </div>

          {isServerRunning && serverInfo && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                🟢 השרת פועל ומשתף נתונים ברשת המקומית
              </p>
              <p className="text-xs text-green-600 mt-1">
                תחנות אחרות יכולות להתחבר לכתובות הבאות:
              </p>
              <div className="mt-2 space-y-1">
                {serverInfo.urls.map((url: string, index: number) => (
                  <div key={index} className="text-xs font-mono bg-green-100 px-2 py-1 rounded">
                    {url}
                  </div>
                ))}
              </div>
            </div>
          )}

          {connectionStatus && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">{connectionStatus}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>התחבר לשרת אחר</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleScanForServers}
              disabled={isScanning}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              חפש שרתים
            </Button>
            
            {connectionMode === 'remote' && (
              <Button onClick={handleDisconnect} variant="destructive">
                התנתק
              </Button>
            )}
          </div>

          {discoveredServers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">שרתים שנמצאו:</h4>
              {discoveredServers.map((server) => (
                <div key={server} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{server}</span>
                  <Button
                    size="sm"
                    onClick={() => handleConnectToServer(server)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'התחבר'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">התחברות ידנית:</h4>
            <div className="flex gap-2">
              <Input
                placeholder="http://192.168.1.10:3000"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={connectionMode === 'remote'}
              />
              <Button
                onClick={handleManualConnect}
                disabled={isConnecting || !serverUrl.trim() || connectionMode === 'remote'}
              >
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'התחבר'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 