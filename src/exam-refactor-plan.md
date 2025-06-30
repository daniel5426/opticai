# Exam Layout Refactoring Plan

## Schema Changes
1. ✓ Remove `layout_id` from `OpticalExam` interface and table
2. ✓ Add `exam_id`, `is_active`, `display_order` to `ExamLayout` interface and table
3. ✓ Change `exam_id` to `layout_id` in all exam component interfaces:
   - ✓ OldRefractionExam
   - ✓ ObjectiveExam
   - ✓ SubjectiveExam
   - ✓ AdditionExam
   - ✓ FinalSubjectiveExam
4. ✓ Update foreign key references in all exam component tables to point to `exam_layouts` instead of `optical_exams`

## Database Methods to Update
1. ✓ Methods for retrieving components by exam:
   - ✓ Change `getOldRefractionExamByExamId` to also support:
     - ✓ `getOldRefractionExamByLayoutId`
     - ✓ Keep backward compatibility with existing `getOldRefractionExamByExamId` 
   - ✓ Same for other component types

2. ✓ Methods for creating components:
   - ✓ Update `createOldRefractionExam`, `createObjectiveExam`, etc. to accept `layout_id` instead of `exam_id`

3. ✓ Create new methods:
   - ✓ `getLayoutsByExamId` to get all layouts for an exam
   - ✓ `setActiveLayout` to activate a specific layout for an exam

## UI Changes
1. ✓ ExamDetailPage.tsx:
   - ✓ Remove single layout selector
   - ✓ Add tabbed interface for multiple layouts
   - ✓ Add ability to add/remove layout tabs
   - ✓ Save all layout data when saving the exam

## Implementation Details

### Database Support
- Added new methods in `exam-layouts-db.ts` for managing layouts by exam
- Updated the `exams-db.ts` file to support both layout-based and exam-based retrieval
- Added ElectronAPI interfaces for all the new methods

### UI Implementation
- Added tab bar to display multiple layouts for an exam
- Implemented ability to add layouts from available layouts
- Implemented ability to remove layouts (except the last one)
- Added active layout highlighting and switching
- Updated save logic to preserve layout data and component associations

### Benefits of New System
- Multiple layouts can be associated with a single exam
- Different components (old refraction, objective, etc.) are tied to specific layouts
- Layouts can be switched dynamically without losing data
- Default layouts can be copied and customized for each exam

### Migration Strategy
For existing data, we handle backward compatibility by:
1. Checking for exam-based components if no layout-specific components exist
2. Creating layouts for exams that don't have them already
3. Copying default layout for new exams

## Future Enhancements
- Add drag-and-drop support for reordering layout tabs
- Allow cloning layouts within the same exam
- Support layout sharing between exams
- Add preview thumbnails for layouts in the dropdown

