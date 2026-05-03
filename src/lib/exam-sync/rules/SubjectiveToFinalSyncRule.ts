import { SyncRule, FieldChange, SyncContext, FieldUpdates } from '../types';

export class SubjectiveToFinalSyncRule implements SyncRule {
  id = 'subjective-to-final-sync';

  // Fields to map from Subjective to Final Subjective
  // Key: Subjective field, Value: Final Subjective field
  private fieldMapping: Record<string, string> = {
    'r_sph': 'r_sph',
    'l_sph': 'l_sph',
    'r_cyl': 'r_cyl',
    'l_cyl': 'l_cyl',
    'r_ax': 'r_ax',
    'l_ax': 'l_ax',
    'r_pris': 'r_pris',
    'l_pris': 'l_pris',
    'r_base': 'r_base',
    'l_base': 'l_base',
    'r_va': 'r_va',
    'l_va': 'l_va',
    'r_pd_far': 'r_pd_far',
    'l_pd_far': 'l_pd_far',
    'r_pd_close': 'r_pd_close',
    'l_pd_close': 'l_pd_close',
    'comb_va': 'comb_va',
    'comb_pd_far': 'comb_pd_far',
    'comb_pd_close': 'comb_pd_close',
  };

  isEnabled(context: SyncContext): boolean {
    return !!context.userSettings.sync_subjective_to_final_subjective;
  }

  shouldRun(change: FieldChange, context: SyncContext): boolean {
    // Only run if changing 'subjective' component
    return change.modelName === 'subjective' && Object.keys(this.fieldMapping).includes(change.fieldName);
  }

  execute(change: FieldChange, context: SyncContext): FieldUpdates {
    const targetField = this.fieldMapping[change.fieldName];
    if (!targetField) return {};

    const updates: FieldUpdates = {};
    
    // Helper to process data bucket
    const processBucket = (instanceId: string, data: Record<string, any>) => {
         Object.keys(data).forEach(key => {
            if (key.startsWith('final-subjective-')) {
                if (!updates[instanceId]) updates[instanceId] = {};
                if (!updates[instanceId][key]) updates[instanceId][key] = {};
                updates[instanceId][key][targetField] = change.newValue;
            }
         });
    };

    // 1. Check Active Instance
    if (context.activeInstanceId != null) {
        processBucket(context.activeInstanceId.toString(), context.activeInstanceData);
    }
    
    // 2. Check Other Instances
    Object.entries(context.otherInstancesData).forEach(([instId, data]) => {
        // Skip active instance if present in otherInstancesData (it shouldn't be relied on as source of truth if we have activeInstanceData, but checking ID is safer)
        if (String(instId) !== String(context.activeInstanceId)) {
             processBucket(String(instId), data);
        }
    });

    return updates;
  }
}
