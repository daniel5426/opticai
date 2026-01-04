### Exam Data JSON Structure (ExamLayoutInstance.exam_data)

This document describes the JSON structure stored in `exam_layout_instances.exam_data`.

At a high level, `exam_data` is a single JSON object (dictionary) that aggregates all component data for one layout instance. Each entry corresponds either to a single-instance component (keyed by its component type) or to a multi-instance component (keyed by a composite key). Every component value contains a `layout_instance_id` and the domain fields for that component.

### Top-level shape

- `exam_data`: object where keys are component identifiers and values are component payloads
  - Single-instance component keys: the component type slug, e.g. `"subjective"`, `"final-prescription"`, `"addition"`, etc.
  - Multi-instance component keys:
    - Notes: `"notes-<cardId>"`
    - Cover Test: `"cover-test-<cardId>-<tabId>"`

Notes and Cover Test are special because the same layout can contain multiple Notes cards, and each Cover Test card can contain multiple tabs. The other components are single-instance per layout instance.

### General conventions

- All component payloads include `layout_instance_id: number`.
- Optional `id?: number` may appear when data originated from DB rows that were previously normalized.
- Some components can include helper metadata occasionally used by the UI/workflows. For example, during editing a component might carry `__deleted: true` to flag clearing; treat it as a soft flag, not part of the persisted schema.
- Field names and types below mirror the app’s TypeScript interfaces used in the renderer.

### Key naming

- Single-instance: `<component-type>` (kebab-case), e.g. `"old-refraction"`, `"objective"`, `"subjective"`, `"final-subjective"`, `"final-prescription"`, `"compact-prescription"`, `"addition"`, `"retinoscop"`, `"retinoscop-dilation"`, `"uncorrected-va"`, `"keratometer"`, `"keratometer-full"`, `"corneal-topography"`, `"anamnesis"`, `"schirmer-test"`, `"contact-lens-diameters"`, `"contact-lens-details"`, `"keratometer-contact-lens"`, `"contact-lens-exam"`, `"contact-lens-order"`, `"sensation-vision-stability"`, `"diopter-adjustment-panel"`, `"fusion-range"`, `"maddox-rod"`, `"stereo-test"`, `"rg"`, `"ocular-motor-assessment"`, `"old-contact-lenses"`, `"over-refraction"`.
- Notes: `notes-<cardId>`
  - One entry per Notes card instance in the layout.
- Cover Test: `cover-test-<cardId>-<tabId>`
  - One entry per visible tab of each Cover Test card.

### Component payload schemas

Below are the payload shapes for each component key. All payloads include `layout_instance_id: number`.

- old-ref (OldRefExam)
  - `role?: string`
  - `source?: string`
  - `contacts?: string`

- old-refraction (OldRefractionExam)
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?, r_pris?, l_pris?, r_base?, l_base?, r_va?, l_va?, r_ad?, l_ad?, comb_va?` (numbers)

- old-refraction-extension (OldRefractionExtensionExam)
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_pr_h?, l_pr_h?, r_base_h?, l_base_h?` (base_h are strings)
  - `r_pr_v?, l_pr_v?, r_base_v?, l_base_v?` (base_v are strings)
  - `r_va?, l_va?, r_ad?, l_ad?, r_j?, l_j?`
  - `r_pd_far?, l_pd_far?, r_pd_close?, l_pd_close?, comb_va?, comb_pd_far?, comb_pd_close?`

- objective (ObjectiveExam)
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?, r_se?, l_se?`

- subjective (SubjectiveExam)
  - `r_fa?, l_fa?, r_fa_tuning?, l_fa_tuning?`
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_pris?, l_pris?, r_base?, l_base?`
  - `r_va?, l_va?, r_ph?, l_ph?`
  - `r_pd_close?, l_pd_close?, r_pd_far?, l_pd_far?`
  - `comb_va?, comb_fa?, comb_fa_tuning?, comb_pd_close?, comb_pd_far?`

- final-subjective (FinalSubjectiveExam)
  - `order_id?`
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_pr_h?, l_pr_h?, r_base_h?, l_base_h?` (base_h strings)
  - `r_pr_v?, l_pr_v?, r_base_v?, l_base_v?` (base_v strings)
  - `r_va?, l_va?, r_j?, l_j?`
  - `r_pd_far?, l_pd_far?, r_pd_close?, l_pd_close?, comb_pd_far?, comb_pd_close?, comb_va?`

- final-prescription (FinalPrescriptionExam)
  - `order_id?`
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_pris?, l_pris?, r_base?, l_base?` (base strings)
  - `r_va?, l_va?, r_ad?, l_ad?, r_pd?, l_pd?, r_high?, l_high?, r_diam?, l_diam?, comb_va?, comb_pd?, comb_high?`

- compact-prescription (CompactPrescriptionExam)
  - `referral_id?`
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_pris?, l_pris?, r_base?, l_base?`
  - `r_va?, l_va?, r_ad?, l_ad?, r_pd?, l_pd?, comb_va?, comb_pd?`

- addition (AdditionExam)
  - `r_fcc?, l_fcc?, r_read?, l_read?, r_int?, l_int?, r_bif?, l_bif?, r_mul?, l_mul?, r_j?, l_j?, r_iop?, l_iop?`

- retinoscop (RetinoscopExam)
  - `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?`
  - `r_reflex?, l_reflex?` (strings)

- retinoscop-dilation (RetinoscopDilationExam)
  - Same fields as `retinoscop`

- uncorrected-va (UncorrectedVAExam)
  - `r_fv?, l_fv?, r_iv?, l_iv?, r_nv_j?, l_nv_j?` (strings)

- keratometer (KeratometerExam)
  - `r_k1?, r_k2?, r_axis?, l_k1?, l_k2?, l_axis?`

- keratometer-full (KeratometerFullExam)
  - `r_dpt_k1?, r_dpt_k2?, l_dpt_k1?, l_dpt_k2?`
  - `r_mm_k1?, r_mm_k2?, l_mm_k1?, l_mm_k2?`
  - `r_mer_k1?, r_mer_k2?, l_mer_k1?, l_mer_k2?`
  - `r_astig?, l_astig?` (booleans)

- corneal-topography (CornealTopographyExam)
  - `l_note?, r_note?` (strings)
  - `title?` (string; sourced from layout card title when present)

- cover-test (CoverTestExam) — multi-instance & tabbed
  - Key format: `cover-test-<cardId>-<tabId>` (one entry per tab)
  - Fields:
    - `card_id?: string` (the layout card id)
    - `card_instance_id?: string` (tab id)
    - `tab_index?: number` (0-based position within the card tabs)
    - `deviation_type?: string`
    - `deviation_direction?: string`
    - `fv_1?, fv_2?, nv_1?, nv_2?` (numbers)

- notes (NotesExam) — multi-instance
  - Key format: `notes-<cardId>` (one entry per Notes card in the layout)
  - Fields:
    - `card_instance_id?: string` (equals the layout card id)
    - `title?: string`
    - `note?: string`

- anamnesis (AnamnesisExam)
  - `medications?, allergies?, family_history?, previous_treatments?` (strings)
  - `lazy_eye?` (string)
  - `contact_lens_wear?` (boolean)
  - `contact_lens_type?` (string)
  - `started_wearing_since?, stopped_wearing_since?, additional_notes?` (strings)

- schirmer-test (SchirmerTestExam)
  - `r_mm?, l_mm?, r_but?, l_but?`

- contact-lens-diameters (ContactLensDiameters)
  - `pupil_diameter?, corneal_diameter?, eyelid_aperture?`

- contact-lens-details (ContactLensDetails)
  - Left eye: `l_lens_type?, l_model?, l_supplier?, l_material?, l_color?, l_quantity?, l_order_quantity?, l_dx?`
  - Right eye: `r_lens_type?, r_model?, r_supplier?, r_material?, r_color?, r_quantity?, r_order_quantity?, r_dx?`

- keratometer-contact-lens (KeratometerContactLens)
  - Left eye: `l_rh?, l_rv?, l_avg?, l_cyl?, l_ax?, l_ecc?`
  - Right eye: `r_rh?, r_rv?, r_avg?, r_cyl?, r_ax?, r_ecc?`

- contact-lens-exam (ContactLensExam)
  - `comb_va?`
  - Left eye: `l_bc?, l_bc_2?, l_oz?, l_diam?, l_sph?, l_cyl?, l_ax?, l_read_ad?, l_va?, l_j?`
  - Right eye: `r_bc?, r_bc_2?, r_oz?, r_diam?, r_sph?, r_cyl?, r_ax?, r_read_ad?, r_va?, r_j?`

- contact-lens-order (ContactLensOrder)
  - `branch?, supply_in_branch?, order_status?, advisor?, deliverer?, delivery_date?, priority?, guaranteed_date?, approval_date?, cleaning_solution?, disinfection_solution?, rinsing_solution?` (strings)

- sensation-vision-stability (SensationVisionStabilityExam)
  - Left/Right eye string observations: `r_sensation?, l_sensation?, r_vision?, l_vision?, r_stability?, l_stability?, r_movement?, l_movement?, r_recommendations?, l_recommendations?`

- diopter-adjustment-panel (DiopterAdjustmentPanel)
  - `right_diopter?, left_diopter?`

- fusion-range (FusionRangeExam)
  - Far: `fv_base_in?, fv_base_in_recovery?, fv_base_out?, fv_base_out_recovery?`
  - Near: `nv_base_in?, nv_base_in_recovery?, nv_base_out?, nv_base_out_recovery?`

- maddox-rod (MaddoxRodExam)
  - `c_r_h?, c_r_v?, c_l_h?, c_l_v?, wc_r_h?, wc_r_v?, wc_l_h?, wc_l_v?`

- stereo-test (StereoTestExam)
  - `fly_result?` (boolean)
  - `circle_score?, circle_max?`

- rg (RGExam)
  - `rg_status?: "suppression" | "fusion" | "diplopia"`
  - `suppressed_eye?: "R" | "G" | null`

- ocular-motor-assessment (OcularMotorAssessmentExam)
  - `ocular_motility?: string`
  - `acc_od?, acc_os?, npc_break?, npc_recovery?`

- old-contact-lenses (OldContactLenses)
  - Left eye: `l_bc?, l_diam?, l_sph?, l_cyl?, l_ax?, l_va?, l_j?`
  - Right eye: `r_bc?, r_diam?, r_sph?, r_cyl?, r_ax?, r_va?, r_j?`
  - Common: `r_lens_type?, l_lens_type?, r_model?, l_model?, r_supplier?, l_supplier?, comb_va?, comb_j?`

- over-refraction (OverRefraction)
  - Left/Right refraction: `r_sph?, l_sph?, r_cyl?, l_cyl?, r_ax?, l_ax?, r_va?, l_va?, r_j?, l_j?`
  - Combined: `comb_va?, comb_j?`
  - Adds: `l_add?, r_add?`
  - Biomicro/fluorescent marks: `l_florescent?, r_florescent?, l_bio_m?, r_bio_m?` (strings)

### Examples

Minimal with a few single-instance components and a single Notes card:

```json
{
  "subjective": {
    "layout_instance_id": 123,
    "r_sph": -1.25,
    "l_sph": -1.00
  },
  "final-prescription": {
    "layout_instance_id": 123,
    "r_sph": -1.25,
    "l_sph": -1.00,
    "r_va": 6,
    "l_va": 6
  },
  "notes-notes-1": {
    "layout_instance_id": 123,
    "card_instance_id": "notes-1",
    "title": "הערות",
    "note": "patient prefers lightweight frames"
  }
}
```

Cover Test with tabs (two tabs under one card):

```json
{
  "cover-test-cover-1-1b2c": {
    "layout_instance_id": 123,
    "card_id": "cover-1",
    "card_instance_id": "1b2c",
    "tab_index": 0,
    "deviation_type": "eso",
    "deviation_direction": "horizontal",
    "fv_1": 6,
    "fv_2": 4,
    "nv_1": 10,
    "nv_2": 8
  },
  "cover-test-cover-1-3d4e": {
    "layout_instance_id": 123,
    "card_id": "cover-1",
    "card_instance_id": "3d4e",
    "tab_index": 1,
    "deviation_type": "exo",
    "deviation_direction": "horizontal",
    "fv_1": 8,
    "fv_2": 6,
    "nv_1": 12,
    "nv_2": 10
  }
}
```

Notes on multi-instance behavior:
- Notes: one JSON entry per Notes card in the layout, keyed by `notes-<cardId>`.
- Cover Test: one JSON entry per tab of each Cover Test card, keyed by `cover-test-<cardId>-<tabId>` with `tab_index` ordering.

### Exam-level fields (outside exam_data)

The exam header (date, tester, dominant eye, exam name, etc.) is stored on the exam record itself, not in `exam_data`. Only component bodies live inside `exam_data`.

### Order Data JSON Structure (Order.order_data)

`orders.order_data` follows the same concept: a single JSON object that aggregates component bodies for an order. Unlike `exam_data`, it only contains fixed components (no multi-instance cards/tabs). Order header fields (date, user, type, etc.) are stored on the `orders` row, not inside `order_data`.

Top-level keys used by the app:

- Regular orders
  - `"final-prescription"`: FinalPrescriptionExam — same schema as in `exam_data`
  - `"lens"`: Lens details block
  - `"frame"`: Frame details block
  - `"details"`: Order-level logistics/details block

- Contact lens orders
  - `"contact-lens-details"`: ContactLensDetails
  - `"contact-lens-exam"`: ContactLensExam
  - `"keratometer-contact-lens"`: KeratometerContactLens
  - `"schirmer-test"`: SchirmerTestExam
  - `"contact-lens-diameters"`: ContactLensDiameters

Component payload schemas

- final-prescription (FinalPrescriptionExam)
  - Same fields as defined in the Exam Data section (r_/l_ values, pris/base strings, combined metrics). Does not require `layout_instance_id` here.

- lens (custom lens block for regular orders)
  - `right_model?, left_model?, color?, coating?, material?, supplier?` (strings)

- frame (custom frame block for regular orders)
  - `color?, supplier?, model?, manufacturer?, supplied_by?` (strings)
  - `bridge?, width?, height?, length?` (numbers)

- details (order logistics/info for regular orders)
  - `branch?, supplier_status?, bag_number?, advisor?, delivered_by?, technician?` (strings)
  - `delivered_at?, warranty_expiration?, delivery_location?, manufacturing_lab?` (strings)
  - `order_status?, priority?, promised_date?, approval_date?` (strings)
  - `notes?, lens_order_notes?` (strings)

- contact-lens-details (ContactLensDetails)
  - Same fields as in Exam Data section (left/right lens metadata and quantities)

- contact-lens-exam (ContactLensExam)
  - Same fields as in Exam Data section (left/right parameters plus `comb_va?`)

- keratometer-contact-lens (KeratometerContactLens)
  - Same fields as in Exam Data section (left/right keratometry)

- schirmer-test (SchirmerTestExam)
  - Same fields as in Exam Data section

- contact-lens-diameters (ContactLensDiameters)
  - Same fields as in Exam Data section

Examples

Regular order with final prescription and lens/frame/details:

```json
{
  "final-prescription": {
    "r_sph": -1.25,
    "l_sph": -1.00,
    "r_va": 6,
    "l_va": 6
  },
  "lens": {
    "right_model": "1.6 Aspheric",
    "left_model": "1.6 Aspheric",
    "material": "MR-8",
    "coating": "AR",
    "color": "Clear",
    "supplier": "Hoya"
  },
  "frame": {
    "model": "Classic 200",
    "manufacturer": "Ray-Ban",
    "color": "Black",
    "bridge": 18,
    "width": 52,
    "height": 40,
    "length": 140
  },
  "details": {
    "branch": "Main",
    "order_status": "in_production",
    "priority": "normal",
    "promised_date": "2025-09-01",
    "notes": "Call when ready"
  }
}
```

Contact lens order:

```json
{
  "contact-lens-details": {
    "l_lens_type": "Monthly",
    "l_model": "Biofinity",
    "l_order_quantity": 2,
    "r_lens_type": "Monthly",
    "r_model": "Biofinity",
    "r_order_quantity": 2
  },
  "contact-lens-exam": {
    "l_bc": 8.6,
    "l_diam": 14.0,
    "l_sph": -2.00,
    "r_bc": 8.6,
    "r_diam": 14.0,
    "r_sph": -2.50,
    "comb_va": 6
  },
  "keratometer-contact-lens": {
    "l_rh": 43.25,
    "l_rv": 44.00,
    "r_rh": 43.00,
    "r_rv": 43.75
  },
  "schirmer-test": {
    "r_mm": 12,
    "l_mm": 13,
    "r_but": 10,
    "l_but": 9
  },
  "contact-lens-diameters": {
    "pupil_diameter": 3.2,
    "corneal_diameter": 11.8
  }
}
```


