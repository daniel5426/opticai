// This file contains the boot sequence that must complete before React renders

export async function prebootApp(): Promise<void> {
  // 1. Apply theme immediately from localStorage
  const root = document.documentElement;
  const savedUserData = localStorage.getItem('currentUser');
  
  if (savedUserData) {
    try {
      const user = JSON.parse(savedUserData);
      
      // Apply theme mode
      const themeKey = user.id ? `user_theme_${user.id}` : 'theme';
      const themePref = localStorage.getItem(themeKey) || user.theme_preference || 'system';
      
      const themeMode = (window as any).themeMode;
      if (themeMode) {
        let isDark = false;
        
        if (themePref === 'dark') {
          await themeMode.dark();
          isDark = true;
        } else if (themePref === 'light') {
          await themeMode.light();
          isDark = false;
        } else {
          isDark = await themeMode.system();
        }
        
        // Apply dark class immediately
        root.classList.toggle('dark', isDark);
        
        // Apply user colors in light mode
        if (!isDark && user.primary_theme_color) {
          const primaryHsl = hexToHsl(user.primary_theme_color);
          root.style.setProperty('--primary', primaryHsl);
        }
        
        if (!isDark && user.secondary_theme_color) {
          const secondaryHsl = hexToHsl(user.secondary_theme_color);
          root.style.setProperty('--secondary', secondaryHsl);
        }
      }
    } catch (error) {
      console.error('Error applying saved theme:', error);
    }
  }
  
  // Wait for next paint
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
