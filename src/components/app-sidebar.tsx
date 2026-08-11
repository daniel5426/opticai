import * as React from "react";
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSettings,
  IconUsers,
  IconEye,
  IconShoppingCart,
  IconCircleDot,
  IconArrowForward,
  IconCalendar,
  IconRobot,
  IconFiles,
  IconLayoutGrid,
  IconChartLine,
  IconUserCog,
  IconFlask,
  IconPackages,
  IconSearch,
} from "@tabler/icons-react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { ClinicDropdown } from "@/components/clinic-dropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/utils/tailwind";
import { User, Clinic } from "@/lib/db/schema-interface";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { SidebarQuickActions } from "@/components/sidebar-quick-actions";

const showBetaSidebarItems = import.meta.env.DEV;

const getNavData = (
  t: (key: string) => string,
  currentUser?: User,
  onOpenSearch?: () => void,
) => ({
  navMain: [
    {
      title: t("calendar"),
      url: "/dashboard",
      icon: IconDashboard,
      quickAction: "appointment" as const,
    },
    {
      title: t("clients"),
      url: "/clients",
      icon: IconUsers,
      quickAction: "client" as const,
    },
    ...(showBetaSidebarItems
      ? [
          {
            title: t("smartAssistant"),
            url: "/ai-assistant",
            icon: IconRobot,
          },
        ]
      : []),
    {
      title: t("attendance"),
      url: "/worker-stats",
      icon: IconChartLine,
    },
    ...(showBetaSidebarItems &&
    isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager)
      ? [
          {
            title: t("campaigns"),
            url: "/campaigns",
            icon: IconChartBar,
          },
        ]
      : []),
    ...(showBetaSidebarItems
      ? [
          {
            title: t("uiTests"),
            url: "/dev/ui-tests",
            icon: IconFlask,
          },
        ]
      : []),
  ],
  navSecondary: [
    {
      title: t("search"),
      icon: IconSearch,
      onClick: onOpenSearch,
    },
    {
      title: t("settings"),
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: t("help"),
      url: "https://prysm.co.il/contact",
      icon: IconHelp,
    },
  ],
  documents: [
    {
      name: t("exams"),
      url: "/exams",
      icon: IconEye,
      quickAction: "exam" as const,
    },
    {
      name: t("orders"),
      url: "/orders",
      icon: IconShoppingCart,
      quickAction: "order" as const,
    },
    {
      name: t("inventory"),
      url: "/inventory",
      icon: IconPackages,
      quickAction: "inventory" as const,
    },
    {
      name: t("referrals"),
      url: "/referrals",
      icon: IconArrowForward,
      quickAction: "referral" as const,
    },
    {
      name: t("appointments"),
      url: "/appointments",
      icon: IconCalendar,
      quickAction: "appointment" as const,
    },
    {
      name: t("files"),
      url: "/files",
      icon: IconFiles,
      quickAction: "file" as const,
    },
  ],
});

export function AppSidebar({
  clinicName,
  currentUser,
  logoPath,
  isLogoLoaded,
  currentClinic,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  clinicName?: string;
  currentUser?: User;
  logoPath?: string | null;
  isLogoLoaded?: boolean;
  currentClinic?: Clinic | null;
}) {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const hasLogo = logoPath;
  const [isLogoVisible, setIsLogoVisible] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const navData = getNavData(t, currentUser, () => setIsSearchOpen(true));

  React.useEffect(() => {
    if (state === "collapsed") {
      setIsLogoVisible(false);
    } else if (state === "expanded" && isLogoLoaded) {
      const timer = setTimeout(() => {
        setIsLogoVisible(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state, isLogoLoaded]);

  const clinicHeaderContent = (
    <>
      {hasLogo && (
        <img
          src={logoPath}
          alt="לוגו המרפאה"
          className={cn(
            "h-auto max-h-10 w-auto rounded object-contain",
            state === "expanded" && "transition-opacity duration-300",
            isLogoLoaded && isLogoVisible ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      <span className="max-w-full self-center text-right text-base leading-tight font-semibold break-words whitespace-normal">
        {clinicName || ""}
      </span>
    </>
  );

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu className="border-0 ring-0">
          <SidebarMenuItem className="border-0 ring-0">
            <SidebarMenuButton
              asChild
              className="!h-auto min-h-5 items-start border-0 ring-0 data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div>
                <ClinicDropdown
                  currentClinic={currentClinic}
                  clinicName={clinicName}
                  logoPath={logoPath}
                  isLogoLoaded={true}
                >
                  <div className="flex w-full max-w-full min-w-0 items-start gap-2 overflow-hidden border-0 ring-0">
                    {clinicHeaderContent}
                  </div>
                </ClinicDropdown>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarQuickActions>
        {(renderQuickAction) => (
          <SidebarContent>
            <NavMain
              items={navData.navMain}
              renderQuickAction={renderQuickAction}
            />
            <NavDocuments
              items={navData.documents}
              renderQuickAction={renderQuickAction}
            />
            <NavSecondary items={navData.navSecondary} className="mt-auto" />
          </SidebarContent>
        )}
      </SidebarQuickActions>
      <SidebarFooter>
        <NavUser currentUser={currentUser} />
      </SidebarFooter>
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          className="!top-[10vh] max-h-[calc(90vh-1rem)] w-[98vw] !translate-y-0 !gap-0 overflow-hidden rounded-lg !p-0 shadow-lg sm:max-w-screen-sm"
        >
          <DialogTitle className="sr-only">{t("search")}</DialogTitle>
          <GlobalSearch inModal onClose={() => setIsSearchOpen(false)} />
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
