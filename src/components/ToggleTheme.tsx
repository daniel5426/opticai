import { Moon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { toggleTheme } from "@/helpers/theme_helpers";
import { useUser } from "@/contexts/UserContext";

export default function ToggleTheme() {
  const { currentUser } = useUser();
  
  const handleToggleTheme = () => {
    toggleTheme(currentUser?.id);
  };

  return (
    <Button onClick={handleToggleTheme} size="icon">
      <Moon size={16} />
    </Button>
  );
}
