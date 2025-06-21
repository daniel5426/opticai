/// <reference path="../types/electron.d.ts" />

export async function minimizeWindow() {
  if (!window.electronWindow) {
    console.error('electronWindow is not available on window object');
    return;
  }
  await window.electronWindow.minimize();
}

export async function maximizeWindow() {
  if (!window.electronWindow) {
    console.error('electronWindow is not available on window object');
    return;
  }
  await window.electronWindow.maximize();
}

export async function closeWindow() {
  if (!window.electronWindow) {
    console.error('electronWindow is not available on window object');
    return;
  }
  await window.electronWindow.close();
}
