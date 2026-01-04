import { SyncContext, FieldChange, FieldUpdates, SyncRule } from './types';

export class ExamSyncManager {
  private rules: SyncRule[] = [];

  constructor() {
    // Rules will be registered here or via a register method
  }

  registerRule(rule: SyncRule) {
    this.rules.push(rule);
  }

  process(change: FieldChange, context: SyncContext): FieldUpdates {
    let updates: FieldUpdates = {};

    for (const rule of this.rules) {
      if (rule.isEnabled(context) && rule.shouldRun(change, context)) {
        const ruleUpdates = rule.execute(change, context);
        // Deep merge logic
        for (const [instanceId, components] of Object.entries(ruleUpdates)) {
            if (!updates[instanceId]) updates[instanceId] = {};
            for (const [compKey, fields] of Object.entries(components)) {
                if (!updates[instanceId][compKey]) updates[instanceId][compKey] = {};
                updates[instanceId][compKey] = { ...updates[instanceId][compKey], ...fields };
            }
        }
      }
    }

    return updates;
  }
}
