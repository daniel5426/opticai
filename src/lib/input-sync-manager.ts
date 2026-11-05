type PendingInput = { sync: () => void; isDirty: () => boolean };

class InputSyncManager {
  private pending = new Map<() => void, PendingInput>();

  register(sync: () => void, isDirty: () => boolean = () => true) {
    this.pending.set(sync, { sync, isDirty });
  }

  unregister(sync: () => void) {
    this.pending.delete(sync);
  }

  // Read pending local edits on navigation, without subscribing the form to typing.
  hasPendingChanges() {
    return [...this.pending.values()].some(input => input.isDirty());
  }

  flush() {
    for (const { sync } of [...this.pending.values()]) {
      try { sync(); } catch (error) { console.error('Sync error:', error); }
    }
  }
}

export const inputSyncManager = new InputSyncManager();
