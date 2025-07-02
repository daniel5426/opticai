import { examComponentRegistry } from './exam-component-registry'
import { useState } from 'react'

// Example: Adding a new "Biometry" component
// Just register it once and everything else works automatically!

// registry.register<BiometryExam>('biometry', {
//   name: 'ביומטריה',
//   getData: getBiometryExamByLayoutInstanceId,
//   createData: createBiometryExam,
//   updateData: updateBiometryExam,
//   getNumericFields: () => ["r_axial_length", "l_axial_length", "r_corneal_power", "l_corneal_power"],
//   getIntegerFields: () => [],
//   validateField: (field, rawValue) => {
//     const numericFields = ["r_axial_length", "l_axial_length", "r_corneal_power", "l_corneal_power"]
//     if (numericFields.includes(field as string)) {
//       const val = parseFloat(rawValue)
//       return rawValue === "" || isNaN(val) ? undefined : val
//     }
//     return rawValue === "" ? undefined : rawValue
//   },
//   hasData: (data) => Object.values(data).some(value => 
//     value !== undefined && value !== null && value !== ''
//   )
// })

// That's it! No other changes needed.
// The registry automatically handles:
// - Data loading for all layout instances
// - Field validation and change handling  
// - Save/update operations
// - Form data management
// - State synchronization

export interface ExamComponentManager {
  // Unified interface for all exam operations
  loadAllData(layoutInstanceId: number): Promise<Record<string, any>>
  saveAllData(layoutInstanceId: number, formData: Record<string, any>): Promise<Record<string, any>>
  createFieldHandlers(): Record<string, (field: string, value: string) => void>
  initializeFormData(layoutInstanceId: number): Record<string, any>
  validateAllFields(componentType: string, data: Record<string, any>): Record<string, any>
}

// Usage in ExamDetailPage becomes much simpler:
export const useSimplifiedExamManagement = () => {
  // Single state object for all components
  const [examData, setExamData] = useState<Record<string, any>>({})
  const [formData, setFormData] = useState<Record<string, any>>({})
  
  // Single load function
  const loadData = async (layoutInstanceId: number) => {
    const data = await examComponentRegistry.loadAllData(layoutInstanceId)
    setExamData(data)
    
    // Initialize form data
    const initialFormData: Record<string, any> = {}
    examComponentRegistry.getAllTypes().forEach(type => {
      initialFormData[type] = data[type] || { layout_instance_id: layoutInstanceId }
    })
    setFormData(initialFormData)
  }
  
  // Single save function
  const saveData = async (layoutInstanceId: number) => {
    return await examComponentRegistry.saveAllData(layoutInstanceId, formData)
  }
  
  // Auto-generated field handlers
  const fieldHandlers = examComponentRegistry.getAllTypes().reduce((handlers, type) => {
    handlers[type] = examComponentRegistry.createFieldChangeHandler(
      type,
      (updater: (prev: any) => any) => {
        setFormData(prev => ({
          ...prev,
          [type]: updater(prev[type] || {})
        }))
      }
    )
    return handlers
  }, {} as Record<string, (field: string, value: string) => void>)
  
  return {
    examData,
    formData,
    loadData,
    saveData,
    fieldHandlers,
    getAllComponentTypes: () => examComponentRegistry.getAllTypes()
  }
}

// Benefits of this approach:
// 1. DRY (Don't Repeat Yourself) - No more boilerplate code
// 2. Type Safety - All field validation is centralized and typed
// 3. Consistency - All components follow the same patterns
// 4. Maintainability - Changes to the pattern affect all components
// 5. Scalability - Adding new components is trivial
// 6. Testing - Much easier to test unified logic vs scattered code
// 7. Performance - Can optimize all components at once (caching, batching, etc.)

export { examComponentRegistry } 