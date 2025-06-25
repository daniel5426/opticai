import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, getEyeExamsByExamId, updateExam, updateEyeExam, createExam, createEyeExam } from "@/lib/db/exams-db"
import { OpticalExam, OpticalEyeExam, Client } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"

// Custom label component with underline - This component is not used in the current file.
// function LabelWithUnderline({ children }: { children: React.ReactNode }) {
//   return (
//     <Label className="border-none pb-1 mb-1 inline-block border-black">
//       {children}
//     </Label>
//   )
// }

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

function DateInput({ name, value, onChange, className, disabled }: DateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current && !disabled) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-1">
      <div 
        className={`text-sm text-right pr-10 h-8 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'} ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className="absolute opacity-0 h-0 w-0 overflow-hidden"
      />
      
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-5 w-5 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

// Section Components for Optical Eye Exam

interface EyeSectionProps {
  eye: "R" | "L";
  data: OpticalEyeExam;
  onChange: (eye: "R" | "L", field: keyof OpticalEyeExam, value: string) => void;
  isEditing: boolean;
}

function PreviousObjectiveSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-24 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-old-sph`} type="number" step="0.25" value={data.old_sph?.toString() || ""} onChange={(e) => onChange(eye, "old_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-old-cyl`} type="number" step="0.25" value={data.old_cyl?.toString() || ""} onChange={(e) => onChange(eye, "old_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-old-ax`} type="number" min="0" max="180" value={data.old_ax?.toString() || ""} onChange={(e) => onChange(eye, "old_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-pris`} className="text-[12px] block text-center">PRIS</Label>}
          <Input id={`${eye}-old-pris`} type="number" step="0.5" value={data.old_pris?.toString() || ""} onChange={(e) => onChange(eye, "old_pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-base`} className="text-[12px] block text-center">BASE</Label>}
          <Input id={`${eye}-old-base`} type="number" step="0.1" value={data.old_base?.toString() || ""} onChange={(e) => onChange(eye, "old_base", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-old-va`} type="number" step="0.1" value={data.old_va?.toString() || ""} onChange={(e) => onChange(eye, "old_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-ad`} className="text-[12px] block text-center">ADD</Label>}
          <Input id={`${eye}-old-ad`} type="number" step="0.25" value={data.old_ad?.toString() || ""} onChange={(e) => onChange(eye, "old_ad", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>

        <div className="col-span-1 flex items-end justify-center"><div className="w-px h-full bg-gray-300"></div></div>

        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-obj-sph`} type="number" step="0.25" value={data.obj_sph?.toString() || ""} onChange={(e) => onChange(eye, "obj_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-obj-cyl`} type="number" step="0.25" value={data.obj_cyl?.toString() || ""} onChange={(e) => onChange(eye, "obj_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-obj-ax`} type="number" min="0" max="180" value={data.obj_ax?.toString() || ""} onChange={(e) => onChange(eye, "obj_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-se`} className="text-[12px] block text-center">SE</Label>}
          <Input id={`${eye}-obj-se`} type="number" step="0.25" value={data.obj_se?.toString() || ""} onChange={(e) => onChange(eye, "obj_se", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
}

function CombinedVaFields({ exam, onChange, isEditing, onMultifocalClick, onVHConfirm }: { 
  exam: OpticalExam, 
  onChange: (field: keyof OpticalExam, value: string) => void, 
  isEditing: boolean,
  onMultifocalClick: () => void,
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-24 gap-4 flex-1" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="h-8 text-xs px-2" 
            disabled={!isEditing}
            onClick={onMultifocalClick}
          >
            MUL
          </Button>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-3">
          <div className="relative" dir="ltr">
            <Input id={`comb-old-va`} type="number" step="0.1" value={exam.comb_old_va?.toString() || ""} onChange={(e) => onChange("comb_old_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-1"></div>
        <div className="col-span-6"></div>
      </div>
      <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>
    </div>
  );
}

function SubjectiveSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-fa`} className="text-[12px] block text-center">FA</Label>}
          <Input id={`${eye}-subj-fa`} type="number" step="0.1" value={data.subj_fa?.toString() || ""} onChange={(e) => onChange(eye, "subj_fa", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FA" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-fa-tuning`} className="text-[12px] block text-center">FA TUN</Label>}
          <Input id={`${eye}-subj-fa-tuning`} type="number" step="0.1" value={data.subj_fa_tuning?.toString() || ""} onChange={(e) => onChange(eye, "subj_fa_tuning", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FA TUN" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-subj-sph`} type="number" step="0.25" value={data.subj_sph?.toString() || ""} onChange={(e) => onChange(eye, "subj_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-subj-cyl`} type="number" step="0.25" value={data.subj_cyl?.toString() || ""} onChange={(e) => onChange(eye, "subj_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-subj-ax`} type="number" min="0" max="180" value={data.subj_ax?.toString() || ""} onChange={(e) => onChange(eye, "subj_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pris`} className="text-[12px] block text-center">PRIS</Label>}
          <Input id={`${eye}-subj-pris`} type="number" step="0.5" value={data.subj_pris?.toString() || ""} onChange={(e) => onChange(eye, "subj_pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-base`} className="text-[12px] block text-center">BASE</Label>}
          <Input id={`${eye}-subj-base`} type="number" step="0.1" value={data.subj_base?.toString() || ""} onChange={(e) => onChange(eye, "subj_base", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
        {eye === "R" && <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-old-va`} type="number" step="0.1" value={data.old_va?.toString() || ""} onChange={(e) => onChange(eye, "old_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pd-close`} className="text-[12px] block text-center">PD CLOSE</Label>}
          <Input id={`${eye}-subj-pd-close`} type="number" step="0.5" value={data.subj_pd_close?.toString() || ""} onChange={(e) => onChange(eye, "subj_pd_close", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PD" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pd-far`} className="text-[12px] block text-center">PD FAR</Label>}
          <Input id={`${eye}-subj-pd-far`} type="number" step="0.5" value={data.subj_pd_far?.toString() || ""} onChange={(e) => onChange(eye, "subj_pd_far", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PD" />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
}

function CombinedSubjFields({ exam, onChange, isEditing, onVHConfirm, onMultifocalClick }: { 
  exam: OpticalExam, 
  onChange: (field: keyof OpticalExam, value: string) => void, 
  isEditing: boolean,
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void,
  onMultifocalClick: () => void
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1" dir="ltr">
        <div className="col-span-2">
          <Input type="number" step="0.1" value={exam.comb_fa?.toString() || ""} onChange={(e) => onChange("comb_fa", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FA" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.1" value={exam.comb_fa_tuning?.toString() || ""} onChange={(e) => onChange("comb_fa_tuning", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FA TUN" />
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="h-8 text-xs px-2" 
            disabled={!isEditing}
            onClick={onMultifocalClick}
          >
            MUL
          </Button>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
        </div>

        <div className="col-span-2"></div>
        <div className="col-span-2">
        <div className="relative" dir="ltr">
            <Input id={`comb-subj-va`} type="number" step="0.1" value={exam.comb_subj_va?.toString() || ""} onChange={(e) => onChange("comb_subj_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={exam.comb_pd_close?.toString() || ""} onChange={(e) => onChange("comb_pd_close", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PD Close" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={exam.comb_pd_far?.toString() || ""} onChange={(e) => onChange("comb_pd_far", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PD Far" />
        </div>
      </div>
      <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>  
    </div>
  );
}

function AdditionSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-7 gap-9 flex-1" dir="ltr">
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-fcc`} className="text-[12px] block text-center">FCC</Label>}
          <Input id={`${eye}-ad-fcc`} type="number" step="0.25" value={data.ad_fcc?.toString() || ""} onChange={(e) => onChange(eye, "ad_fcc", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FCC" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-read`} className="text-[12px] block text-center">READ</Label>}
          <Input id={`${eye}-ad-read`} type="number" step="0.25" value={data.ad_read?.toString() || ""} onChange={(e) => onChange(eye, "ad_read", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="READ" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-int`} className="text-[12px] block text-center">INT</Label>}
          <Input id={`${eye}-ad-int`} type="number" step="0.25" value={data.ad_int?.toString() || ""} onChange={(e) => onChange(eye, "ad_int", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="INT" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-bif`} className="text-[12px] block text-center">BIF</Label>}
          <Input id={`${eye}-ad-bif`} type="number" step="0.25" value={data.ad_bif?.toString() || ""} onChange={(e) => onChange(eye, "ad_bif", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="BIF" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-mul`} className="text-[12px] block text-center">MUL</Label>}
          <Input id={`${eye}-ad-mul`} type="number" step="0.25" value={data.ad_mul?.toString() || ""} onChange={(e) => onChange(eye, "ad_mul", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-j`} className="text-[12px] block text-center">J</Label>}
          <Input id={`${eye}-ad-j`} type="number" value={data.ad_j?.toString() || ""} onChange={(e) => onChange(eye, "ad_j", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-iop`} className="text-[12px] block text-center">IOP</Label>}
          <Input id={`${eye}-iop`} type="number" step="0.1" value={data.iop?.toString() || ""} onChange={(e) => onChange(eye, "iop", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="IOP" />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-1" : "pt-4"}`}>{eyeLabel}</span>
    </div>
  );
}

interface VHCalculatorProps {
  onConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  disabled?: boolean;
}

function VHCalculatorModal({ onConfirm, disabled = false }: VHCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rightPrisH, setRightPrisH] = useState<number>(0);
  const [rightBaseH, setRightBaseH] = useState<string>("");
  const [rightPrisV, setRightPrisV] = useState<number>(0);
  const [rightBaseV, setRightBaseV] = useState<string>("");
  const [leftPrisH, setLeftPrisH] = useState<number>(0);
  const [leftBaseH, setLeftBaseH] = useState<string>("");
  const [leftPrisV, setLeftPrisV] = useState<number>(0);
  const [leftBaseV, setLeftBaseV] = useState<string>("");

  const baseOptions = ["IN", "OUT", "UP", "DOWN"];

  const calculateResultingPrism = (prisH: number, baseH: string, prisV: number, baseV: string) => {
    if (!prisH && !prisV) return { pris: 0, base: 0 };
    
    let hComponent = 0, vComponent = 0;
    
    if (baseH === "IN") hComponent = -prisH;
    else if (baseH === "OUT") hComponent = prisH;
    
    if (baseV === "UP") vComponent = prisV;
    else if (baseV === "DOWN") vComponent = -prisV;
    
    const resultingPris = Math.sqrt(hComponent * hComponent + vComponent * vComponent);
    let resultingBase = 0;
    
    if (hComponent !== 0 || vComponent !== 0) {
      resultingBase = Math.atan2(vComponent, hComponent) * (180 / Math.PI);
      if (resultingBase < 0) resultingBase += 360;
    }
    
    return {
      pris: Math.round(resultingPris * 100) / 100,
      base: Math.round(resultingBase)
    };
  };

  const rightResult = calculateResultingPrism(rightPrisH, rightBaseH, rightPrisV, rightBaseV);
  const leftResult = calculateResultingPrism(leftPrisH, leftBaseH, leftPrisV, leftBaseV);

  const handleConfirm = () => {
    onConfirm(rightResult.pris, rightResult.base, leftResult.pris, leftResult.base);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs px-2" type="button" disabled={disabled}>
          V + H
        </Button>
      </DialogTrigger>
      <DialogContent className="!w-[880px] !max-w-[1200px]" dir="rtl" showCloseButton={false}>
        <DialogHeader dir="rtl" className="text-center pb-4">
          <DialogTitle className="text-center text-2xl">חישוב פריזמה</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 w-full" dir="rtl">
          {/* Column Headers */}
          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0"></span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS.H</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE.H</Label>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS.V</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE.V</Label>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE</Label>
              </div>
            </div>
          </div>

          {/* R Row */}
          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0">R</span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={rightPrisH || ""} 
                  onChange={(e) => setRightPrisH(Number(e.target.value))} 
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseH} onValueChange={setRightBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">+</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={rightPrisV || ""} 
                  onChange={(e) => setRightPrisV(Number(e.target.value))} 
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseV} onValueChange={setRightBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">=</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {rightResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {rightResult.base}°
                </div>
              </div>
            </div>
          </div>

          {/* L Row */}
          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0">L</span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={leftPrisH || ""} 
                  onChange={(e) => setLeftPrisH(Number(e.target.value))} 
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseH} onValueChange={setLeftBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">+</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={leftPrisV || ""} 
                  onChange={(e) => setLeftPrisV(Number(e.target.value))} 
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseV} onValueChange={setLeftBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">=</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {leftResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {leftResult.base}°
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <Button onClick={handleConfirm} type="button" className="px-8">אישור</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExamDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, rightEyeExam: OpticalEyeExam, leftEyeExam: OpticalEyeExam) => void;
  onCancel?: () => void;
}

export default function ExamDetailPage({ 
  mode = 'view', 
  clientId: propClientId, 
  examId: propExamId,
  onSave,
  onCancel 
}: ExamDetailPageProps = {}) {
  let routeClientId: string | undefined, routeExamId: string | undefined;
  
  try {
    const params = useParams({ from: "/clients/$clientId/exams/$examId" });
    routeClientId = params.clientId;
    routeExamId = params.examId;
  } catch {
    try {
      const params = useParams({ from: "/clients/$clientId/exams/new" });
      routeClientId = params.clientId;
    } catch {
      routeClientId = undefined;
      routeExamId = undefined;
    }
  }
  
  const clientId = propClientId || routeClientId
  const examId = propExamId || routeExamId
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [exam, setExam] = useState<OpticalExam | null>(null)
  const [rightEyeExam, setRightEyeExam] = useState<OpticalEyeExam | null>(null)
  const [leftEyeExam, setLeftEyeExam] = useState<OpticalEyeExam | null>(null)
  const { currentUser } = useUser()
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('exams')
  
  const [formData, setFormData] = useState<OpticalExam>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    clinic: '',
    user_id: currentUser?.id,
    notes: '',
    dominant_eye: '',
    comb_subj_va: undefined,
    comb_old_va: undefined,
    comb_fa: undefined,
    comb_fa_tuning: undefined,
    comb_pd_close: undefined,
    comb_pd_far: undefined
  } as OpticalExam : {} as OpticalExam)
  const [rightEyeFormData, setRightEyeFormData] = useState<OpticalEyeExam>(isNewMode ? { eye: 'R' } as OpticalEyeExam : {} as OpticalEyeExam)
  const [leftEyeFormData, setLeftEyeFormData] = useState<OpticalEyeExam>(isNewMode ? { eye: 'L' } as OpticalEyeExam : {} as OpticalEyeExam)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return
      
      try {
        setLoading(true)
        
        const clientData = await getClientById(Number(clientId))
        setClient(clientData || null)
        
        if (examId && !isNewMode) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)
          
          if (examData) {
            const eyeExams = await getEyeExamsByExamId(Number(examId))
            const rightEye = eyeExams.find(e => e.eye === "R") || null
            const leftEye = eyeExams.find(e => e.eye === "L") || null
            setRightEyeExam(rightEye)
            setLeftEyeExam(leftEye)
          }
        }
      } catch (error) {
        console.error('Error loading exam data:', error)
        toast.error('שגיאה בטעינת נתוני הבדיקה')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [clientId, examId, isNewMode])
  
  useEffect(() => {
    if (exam) {
      setFormData({ ...exam })
    }
    if (rightEyeExam) {
      setRightEyeFormData({ ...rightEyeExam })
    }
    if (leftEyeExam) {
      setLeftEyeFormData({ ...leftEyeExam })
    }
  }, [exam, rightEyeExam, leftEyeExam])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleExamFieldChange = (field: keyof OpticalExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof OpticalExam)[] = [
      "comb_subj_va", "comb_old_va", "comb_fa", "comb_fa_tuning", "comb_pd_close", "comb_pd_far"
    ];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleEyeFieldChange = (
    eye: 'R' | 'L',
    field: keyof OpticalEyeExam,
    rawValue: string
  ) => {
    let processedValue: string | number | undefined = rawValue;
  
    const numericFields: (keyof OpticalEyeExam)[] = [
      "old_sph", "old_cyl", "old_pris", "old_ad", 
      "obj_sph", "obj_cyl", "obj_se", 
      "subj_fa", "subj_fa_tuning", "subj_sph", "subj_cyl", "subj_pris", 
      "subj_pd_close", "subj_pd_far", "subj_va", "subj_ph",
      "ad_fcc", "ad_read", "ad_int", "ad_bif", "ad_mul", "iop"
    ];
    const integerFields: (keyof OpticalEyeExam)[] = ["old_ax", "obj_ax", "subj_ax", "ad_j"];
  
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') {
        processedValue = undefined;
    }
  
    if (eye === 'R') {
      setRightEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    } else {
      setLeftEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSave = async () => {
    if (formRef.current) {
      if (isNewMode) {
        const newExam = await createExam({
          client_id: Number(clientId),
          exam_date: formData.exam_date,
          test_name: formData.test_name,
          clinic: formData.clinic,
          user_id: formData.user_id,
          notes: formData.notes,
          dominant_eye: formData.dominant_eye,
          comb_subj_va: formData.comb_subj_va,
          comb_old_va: formData.comb_old_va,
          comb_fa: formData.comb_fa,
          comb_fa_tuning: formData.comb_fa_tuning,
          comb_pd_close: formData.comb_pd_close,
          comb_pd_far: formData.comb_pd_far
        })
        
        if (newExam && newExam.id) {
          const newRightEyeExam = await createEyeExam({
            ...rightEyeFormData,
            exam_id: newExam.id,
            eye: 'R',
          })
          
          const newLeftEyeExam = await createEyeExam({
            ...leftEyeFormData,
            exam_id: newExam.id,
            eye: 'L',
          })
          
          if (newRightEyeExam && newLeftEyeExam) {
            toast.success("בדיקה חדשה נוצרה בהצלחה")
            if (onSave) {
              onSave(newExam, newRightEyeExam, newLeftEyeExam)
            }
          } else {
            toast.error("לא הצלחנו ליצור את נתוני העין")
          }
        } else {
          toast.error("לא הצלחנו ליצור את הבדיקה")
        }
      } else {
        const updatedExam = await updateExam(formData)
        
        const updatedRightEyeExam = await updateEyeExam(rightEyeFormData)
        
        const updatedLeftEyeExam = await updateEyeExam(leftEyeFormData)
        
        if (updatedExam && updatedRightEyeExam && updatedLeftEyeExam) {
          setIsEditing(false)
          setExam(updatedExam)
          setRightEyeExam(updatedRightEyeExam)
          setLeftEyeExam(updatedLeftEyeExam)
          setFormData({ ...updatedExam })
          setRightEyeFormData({ ...updatedRightEyeExam })
          setLeftEyeFormData({ ...updatedLeftEyeExam })
          toast.success("פרטי הבדיקה עודכנו בהצלחה")
          if (onSave) {
            onSave(updatedExam, updatedRightEyeExam, updatedLeftEyeExam)
          }
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      }
    }
  }

  const handleVHConfirm = (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
    setRightEyeFormData(prev => ({ 
      ...prev, 
      subj_pris: rightPris,
      subj_base: rightBase 
    }));
    setLeftEyeFormData(prev => ({ 
      ...prev, 
      subj_pris: leftPris,
      subj_base: leftBase 
    }));
    toast.success("ערכי פריזמה עודכנו");
  };

  const handleVHConfirmOldRefraction = (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
    setRightEyeFormData(prev => ({ 
      ...prev, 
      old_pris: rightPris,
      old_base: rightBase 
    }));
    setLeftEyeFormData(prev => ({ 
      ...prev, 
      old_pris: leftPris,
      old_base: leftBase 
    }));
    toast.success("ערכי פריזמה עודכנו (רפרקציה ישנה)");
  };

  const handleMultifocalOldRefraction = () => {
    const rightOldCyl = rightEyeFormData.old_cyl || 0;
    const leftOldCyl = leftEyeFormData.old_cyl || 0;
    
    if (rightOldCyl === 0 && leftOldCyl === 0) {
      toast.info("אין ערכי צילינדר לעדכון");
      return;
    }

    const newRightCyl = Math.max(0, Math.abs(rightOldCyl) - 0.25) * Math.sign(rightOldCyl || 1);
    const newLeftCyl = Math.max(0, Math.abs(leftOldCyl) - 0.25) * Math.sign(leftOldCyl || 1);

    setRightEyeFormData(prev => ({ 
      ...prev, 
      old_cyl: newRightCyl === 0 ? undefined : newRightCyl
    }));
    setLeftEyeFormData(prev => ({ 
      ...prev, 
      old_cyl: newLeftCyl === 0 ? undefined : newLeftCyl
    }));

    toast.success("צילינדר הופחת ב-0.25D להתאמה מולטיפוקלית");
  };

  const handleMultifocalSubjective = () => {
    const rightSubjCyl = rightEyeFormData.subj_cyl || 0;
    const leftSubjCyl = leftEyeFormData.subj_cyl || 0;
    
    if (rightSubjCyl === 0 && leftSubjCyl === 0) {
      toast.info("אין ערכי צילינדר לעדכון");
      return;
    }

    const newRightCyl = Math.max(0, Math.abs(rightSubjCyl) - 0.25) * Math.sign(rightSubjCyl || 1);
    const newLeftCyl = Math.max(0, Math.abs(leftSubjCyl) - 0.25) * Math.sign(leftSubjCyl || 1);

    setRightEyeFormData(prev => ({ 
      ...prev, 
      subj_cyl: newRightCyl === 0 ? undefined : newRightCyl
    }));
    setLeftEyeFormData(prev => ({ 
      ...prev, 
      subj_cyl: newLeftCyl === 0 ? undefined : newLeftCyl
    }));

    toast.success("צילינדר הופחת ב-0.25D להתאמה מולטיפוקלית");
  };
  
  const handleTabChange = (value: string) => {
    if (clientId && value !== 'exams') {
      navigate({ 
        to: "/clients/$clientId", 
        params: { clientId: String(clientId) },
        search: { tab: value } 
      })
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">טוען נתונים...</h1>
        </div>
      </>
    )
  }
  
  if (!client || (!isNewMode && (!exam || !rightEyeExam || !leftEyeExam))) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "בדיקה לא נמצאה"}</h1>
        </div>
      </>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientName={fullName}
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "בדיקה חדשה" : `בדיקה מס' ${examId}`}
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isNewMode ? "בדיקה חדשה" : "פרטי בדיקה"}</h2>
            <div className="flex gap-2">
              {!isNewMode && !isEditing && exam?.id && (
                <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }} search={{ examId: String(exam.id) }}>
                  <Button variant="outline">
                    יצירת הזמנה
                  </Button>
                </Link>
              )}
              {isNewMode && onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  ביטול
                </Button>
              )}
              <Button 
                variant={isEditing ? "outline" : "default"} 
                onClick={() => {
                  if (isEditing) {
                    handleSave();
                  } else {
                    // When starting to edit, ensure formData is based on the latest DB state
                    // This is already handled by useEffect, but good to be mindful
                    if (exam) setFormData({ ...exam });
                    if (rightEyeExam) setRightEyeFormData({ ...rightEyeExam });
                    if (leftEyeExam) setLeftEyeFormData({ ...leftEyeExam });
                    setIsEditing(true);
                  }
                }}
              >
                {isNewMode ? "שמור בדיקה" : (isEditing ? "שמור שינויים" : "ערוך בדיקה")}
              </Button>
            </div>
          </div>
          
          <form ref={formRef} className="pt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className=" rounded-md">
                <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                  <div className="col-span-1">
                    <label className="font-semibold text-base">תאריך בדיקה</label>
                    <DateInput
                      name="exam_date"
                      className="h-9"
                      value={formData.exam_date}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">שם הבדיקה</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="test_name"
                        value={formData.test_name || ''}
                        onChange={handleInputChange}
                        className="text-sm pt-1"
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{isNewMode ? formData.test_name : exam?.test_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">מרפאה</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="clinic"
                        value={formData.clinic || ''}
                        onChange={handleInputChange}
                        className="text-sm"
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{isNewMode ? formData.clinic : exam?.clinic}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">בודק</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <UserSelect
                        value={formData.user_id}
                        onValueChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">
                        {formData.user_id ? 'משתמש נבחר' : 'לא נבחר בודק'}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">עין דומיננטית</label>
                    <div className="h-1 w-full"></div>
                    
                      <Select dir="rtl"
                      disabled={!isEditing}
                        value={formData.dominant_eye || ''} 
                        onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                      >
                        <SelectTrigger className="h-6 text-sm w-full">
                          <SelectValue placeholder="בחר עין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R" className="text-sm">ימין</SelectItem>
                          <SelectItem value="L" className="text-sm">שמאל</SelectItem>
                        </SelectContent>
                      </Select>
                    
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="previous-objective" className="w-full pt-2">
                <div className="flex flex-row-reverse gap-4">
                  <TabsList className="flex flex-col py-4 h-fit min-w-[140px] bg-sidebar/50 gap-2">
                    <TabsTrigger value="previous-objective" className="justify-start">Old refraction<br />& objective</TabsTrigger>
                    <TabsTrigger value="subjective" className="justify-start">Subjective</TabsTrigger>
                    <TabsTrigger value="addition" className="justify-start">Addition</TabsTrigger>
                  </TabsList>

                  <div className="flex-1">
                    <TabsContent value="previous-objective">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-4 pt-2" dir="rtl">
                            <div className="absolute top-[-27px] left-[calc(100%*20/27)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                              Objective
                            </div>
                            <div className="absolute top-[-27px] left-[calc(100%*6/29)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                            Old refraction
                            </div>
                          </div>
                          <PreviousObjectiveSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <CombinedVaFields exam={formData} onChange={handleExamFieldChange} isEditing={isEditing} onMultifocalClick={handleMultifocalOldRefraction} onVHConfirm={handleVHConfirmOldRefraction} />
                          <PreviousObjectiveSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="subjective">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-4 pt-2">
                            <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                Subjective
                            </div>
                          </div>
                          <SubjectiveSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <CombinedSubjFields exam={formData} onChange={handleExamFieldChange} isEditing={isEditing} onVHConfirm={handleVHConfirm} onMultifocalClick={handleMultifocalSubjective} />
                          <SubjectiveSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="addition">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-1 pt-2">
                            <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                              Addition
                            </div>
                          </div>
                          <AdditionSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <AdditionSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
              
              {/* Notes Section */}
              <div className=" rounded-md ">
                <label className="block text-base font-semibold mb-2">הערות</label>
                {isEditing ? (
                  <textarea 
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    className="text-sm w-full min-h-[90px] p-3 border shadow-sm rounded-md"
                    rows={4}
                  />
                ) : (
                  <div className="text-sm  border shadow-sm p-3 rounded-md min-h-[106px]">
                    {isNewMode ? (formData.notes || 'אין הערות') : (exam?.notes || 'אין הערות')}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </>
    )
} 