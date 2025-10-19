import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconBuilding,
  IconSettings,
  IconChevronDown,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Clinic } from "@/lib/db/schema-interface";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { cn } from "@/utils/tailwind";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth/AuthService";

interface ClinicDropdownProps {
  currentClinic?: Clinic | null;
  clinicName?: string;
  logoPath?: string | null;
  isLogoLoaded?: boolean;
  children: React.ReactNode;
}

export function ClinicDropdown({
  currentClinic,
  clinicName,
  logoPath,
  isLogoLoaded,
  children,
}: ClinicDropdownProps) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentUser, setCurrentClinic, clinicRefreshTrigger } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isInControlCenter = location.pathname.startsWith("/control-center");

  const effectiveCompanyId = isInControlCenter
    ? currentUser?.company_id || null
    : currentClinic?.company_id || null;

  const clinicsCacheRef = React.useRef<Map<number, Clinic[]>>(new Map());

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role !== "company_ceo") {
      return;
    }

    setLoading(true);
    try {
      const companyId = effectiveCompanyId;
      if (!companyId) {
        setClinics([]);
        return;
      }

      const cache = clinicsCacheRef.current.get(companyId);
      if (cache && cache.length) {
        setClinics(cache);
        return;
      }

      const companyClinicsResponse = await apiClient.getClinicsByCompany(companyId);
      const companyClinics = companyClinicsResponse.data || [];
      const activeClinics = companyClinics.filter((clinic: Clinic) => clinic.is_active);
      clinicsCacheRef.current.set(companyId, activeClinics);
      setClinics(activeClinics);
    } catch (error) {
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, [currentUser, effectiveCompanyId, clinicRefreshTrigger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const companyId = effectiveCompanyId;
    if (companyId) {
      clinicsCacheRef.current.delete(companyId);
      loadData();
    }
  }, [clinicRefreshTrigger, effectiveCompanyId, loadData]);

  const handleClinicSelect = async (clinic: Clinic) => {
    if (!isInControlCenter && clinic.id === currentClinic?.id) {
      return;
    }

    try {
      console.log('ClinicDropdown: Handling clinic select for:', clinic.name, 'user role:', currentUser?.role);
      
      // For CEO users switching to a clinic, set up the clinic session properly
      if (currentUser?.role === 'company_ceo') {
        console.log('ClinicDropdown: CEO selecting clinic, setting clinic session');
        authService.setClinicSession(clinic, currentUser);
        // Always navigate to dashboard regardless of current route state
        // Ensures UI updates even if router thinks it's already on a clinic route
        setTimeout(() => {
          try {
            navigate({ to: "/dashboard" });
          } catch (e) {
            console.error('ClinicDropdown: navigate to /dashboard failed:', e)
          }
        }, 0);
      } else {
        setCurrentClinic(clinic);
        setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 100);
      }
    } catch (error) {
      console.error('ClinicDropdown: Error in handleClinicSelect:', error);
      toast.error("שגיאה בהחלפת מרפאה");
    }
  };

  const handleControlCenterClick = () => {
    const companyId = effectiveCompanyId;
    if (!companyId) {
      toast.error("לא ניתן לגשת למרכז הבקרה");
      return;
    }

    // Navigate immediately to avoid blocking on network calls
    navigate({
      to: "/control-center/dashboard",
      search: {
        companyId: companyId.toString(),
        companyName: "",
        fromSetup: "false",
      },
    });

    // Fire-and-forget enrichment: fetch company and persist for later use
    (async () => {
      try {
        const companyResponse = await apiClient.getCompany(companyId);
        if (companyResponse?.data) {
          try { localStorage.setItem("controlCenterCompany", JSON.stringify(companyResponse.data)); } catch {}
        }
        if (currentUser) try { localStorage.setItem("currentUser", JSON.stringify(currentUser)); } catch {}
      } catch (_error) {
        // swallow errors; navigation already happened
      }
    })();
  };

  if (!currentUser || currentUser.role !== "company_ceo") {
    console.log("ClinicDropdown: User is not CEO, rendering as link");
    return <>{children}</>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex ring-0 border-0 h-auto w-full max-w-full items-start gap-2 p-0 hover:bg-transparent data-[state=open]:bg-transparent whitespace-normal overflow-hidden"
          type="button"
        >
          <div className="flex w-full max-w-full items-start gap-2 min-w-0 overflow-hidden">
            <div className="flex-1 ring-0 border-0 min-w-0 overflow-hidden">
              {children}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64"
        align="end"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuItem
          dir="rtl"
          onSelect={(e) => {
            console.log("ClinicDropdown: Control center clicked");
            handleControlCenterClick();
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2",
            isInControlCenter && "bg-muted/50",
          )}
          disabled={isInControlCenter}
        >
          <IconSettings className="h-4 w-4" />
          <span className="font-medium">מרכז בקרה</span>
          {isInControlCenter && (
            <span className="text-muted-foreground text-xs">(נוכחי)</span>
          )}
        </DropdownMenuItem>

        {currentClinic && !isInControlCenter && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              dir="rtl"
              className="bg-muted/50 flex cursor-pointer items-center gap-2"
              disabled
            >
              <IconBuilding className="h-4 w-4" />
              <span className="font-medium">{currentClinic.name}</span>
              <span className="text-muted-foreground text-xs">(נוכחי)</span>
            </DropdownMenuItem>
          </>
        )}

        {(() => {
          const otherClinics = clinics.filter((clinic) =>
            !isInControlCenter ? clinic.id !== currentClinic?.id : true,
          );
          return (
            otherClinics.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {loading ? (
                  <DropdownMenuItem dir="rtl" disabled>
                    <span>טוען מרפאות...</span>
                  </DropdownMenuItem>
                ) : (
                  otherClinics.map((clinic, index) => (
                    <DropdownMenuItem
                      key={clinic.id}
                      onSelect={(e) => {
                        // Use only onSelect to avoid duplicate calls
                        console.log(
                          "ClinicDropdown: Clinic item clicked:",
                          clinic.name,
                        );
                        e.preventDefault();
                        handleClinicSelect(clinic);
                      }}
                      dir="rtl"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <IconBuilding className="h-4 w-4" />
                      <span>{clinic.name}</span>
                      {clinic.location && (
                        <span className="text-muted-foreground text-xs">
                          ({clinic.location})
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </>
            )
          );
        })()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
