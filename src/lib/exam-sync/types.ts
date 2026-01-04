export interface SyncRule {
  id: string;
  isEnabled: (context: SyncContext) => boolean;
  shouldRun: (change: FieldChange, context: SyncContext) => boolean;
  execute: (change: FieldChange, context: SyncContext) => FieldUpdates;
}

export interface SyncContext {
  userSettings: {
    sync_subjective_to_final_subjective?: boolean;
    [key: string]: any;
  };
  activeInstanceData: Record<string, any>;
  otherInstancesData: Record<number | string, Record<string, any>>; 
  activeInstanceId: number | null;
}

export interface FieldChange {
  modelName: string; // e.g., 'subjective', 'final-subjective'
  fieldName: string; // e.g., 'r_sph', 'l_cyl'
  newValue: any;
  instanceId: string; // The card instance ID (e.g., 'subjective-1')
  layoutInstanceId: number; // The layout instance ID (database ID)
}

export interface FieldUpdates {
  [layoutInstanceId: string]: { // key is layoutInstanceId (converted to string)
     [componentKey: string]: Record<string, any>; 
  }
}
